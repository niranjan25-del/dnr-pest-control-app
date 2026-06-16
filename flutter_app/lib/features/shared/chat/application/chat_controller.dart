// lib/features/shared/chat/application/chat_controller.dart
//
// Chat DI + the per-conversation controller. The controller loads history (REST), connects
// the socket + joins the room, merges incoming socket messages, sends optimistically
// (temp message → reconciled on echo), tracks the counterpart's typing, and emits read
// receipts. Conversation list is a simple FutureProvider with offline cache.

import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/result.dart';
import '../../../../providers/auth_controller.dart';
import '../../../../providers/core_providers.dart';
import '../../../../shared/cache/simple_cache.dart';
import '../data/chat_models.dart';
import '../data/chat_repository.dart';
import '../data/chat_socket_service.dart';

final chatRepositoryProvider = Provider((ref) => ChatRepository(ref.watch(dioProvider)));

final chatSocketServiceProvider = Provider<ChatSocketService>((ref) {
  final env = ref.watch(environmentProvider);
  final storage = ref.watch(secureStorageProvider);
  final userId = ref.watch(authControllerProvider).userId ?? '';
  final service = ChatSocketService(env, storage, userId);
  ref.onDispose(service.dispose);
  return service;
});

/// Conversation list with offline cache fallback.
final conversationsProvider = FutureProvider.autoDispose<List<Conversation>>((ref) async {
  final cache = ref.watch(simpleCacheProvider);
  final result = await ref.watch(chatRepositoryProvider).conversations();
  return result.when(
    success: (list) async {
      await cache.put('conversations', list.map((c) => {'id': c.id, 'title': c.title, 'last_message': c.lastMessage}).toList());
      return list;
    },
    failure: (f) async {
      final cached = await cache.get('conversations', allowStale: true);
      if (cached is List) {
        return cached.whereType<Map<String, dynamic>>().map(Conversation.fromJson).toList();
      }
      throw f;
    },
  );
});

class ChatState {
  final List<ChatMessage> messages;
  final bool loading;
  final bool counterpartTyping;
  const ChatState({this.messages = const [], this.loading = true, this.counterpartTyping = false});
  ChatState copyWith({List<ChatMessage>? messages, bool? loading, bool? counterpartTyping}) =>
      ChatState(messages: messages ?? this.messages, loading: loading ?? this.loading, counterpartTyping: counterpartTyping ?? this.counterpartTyping);
}

class ChatController extends StateNotifier<ChatState> {
  final Ref _ref;
  final String conversationId;
  final String _userId;
  final List<StreamSubscription> _subs = [];
  Timer? _typingDebounce;

  ChatController(this._ref, this.conversationId)
      : _userId = _ref.read(authControllerProvider).userId ?? '',
        super(const ChatState()) {
    _init();
  }

  Future<void> _init() async {
    // 1) History.
    final res = await _ref.read(chatRepositoryProvider).messages(conversationId, currentUserId: _userId);
    res.when(
      success: (msgs) => state = state.copyWith(messages: msgs..sort((a, b) => a.createdAt.compareTo(b.createdAt)), loading: false),
      failure: (_) => state = state.copyWith(loading: false),
    );

    // 2) Socket: connect + join + listen.
    final socket = _ref.read(chatSocketServiceProvider);
    await socket.connect();
    socket.joinConversation(conversationId);

    _subs.add(socket.onMessage.listen((m) {
      if (m.conversationId != conversationId) return;
      // Reconcile optimistic temp message, else append.
      final list = [...state.messages];
      final tempIdx = list.indexWhere((x) => x.delivery == MessageDelivery.pending && x.body == m.body && x.mine);
      if (tempIdx >= 0) {
        list[tempIdx] = m;
      } else if (!list.any((x) => x.id == m.id)) {
        list.add(m);
      }
      list.sort((a, b) => a.createdAt.compareTo(b.createdAt));
      state = state.copyWith(messages: list);
      if (!m.mine) socket.markRead(conversationId, m.id);
    }));

    _subs.add(socket.onTyping.listen((t) {
      if (t.conversationId == conversationId && t.userId != _userId) {
        state = state.copyWith(counterpartTyping: t.isTyping);
      }
    }));

    _subs.add(socket.onRead.listen((r) {
      if (r.conversationId != conversationId) return;
      state = state.copyWith(messages: [
        for (final m in state.messages) if (m.id == r.messageId) m.copyWith(delivery: MessageDelivery.read) else m,
      ]);
    }));
  }

  Future<void> send({String? body, String? attachmentFileId}) async {
    if ((body == null || body.trim().isEmpty) && attachmentFileId == null) return;
    final socket = _ref.read(chatSocketServiceProvider);
    final temp = ChatMessage(
      id: 'temp-${DateTime.now().microsecondsSinceEpoch}',
      conversationId: conversationId,
      senderId: _userId,
      body: body,
      attachmentFileId: attachmentFileId,
      delivery: MessageDelivery.pending,
      createdAt: DateTime.now(),
      mine: true,
    );
    state = state.copyWith(messages: [...state.messages, temp]);

    if (socket.isConnected) {
      socket.sendMessage(conversationId, body: body, attachmentFileId: attachmentFileId);
    } else {
      // Fallback to REST; mark failed if it errors.
      final res = await _ref.read(chatRepositoryProvider).send(conversationId, currentUserId: _userId, body: body, attachmentFileId: attachmentFileId);
      res.when(
        success: (m) => state = state.copyWith(messages: [
          for (final x in state.messages) if (x.id == temp.id) m else x,
        ]),
        failure: (_) => state = state.copyWith(messages: [
          for (final x in state.messages) if (x.id == temp.id) x.copyWith(delivery: MessageDelivery.failed) else x,
        ]),
      );
    }
  }

  void onTextChanged(String text) {
    final socket = _ref.read(chatSocketServiceProvider);
    socket.setTyping(conversationId, text.isNotEmpty);
    _typingDebounce?.cancel();
    _typingDebounce = Timer(const Duration(seconds: 2), () => socket.setTyping(conversationId, false));
  }

  @override
  void dispose() {
    _typingDebounce?.cancel();
    for (final s in _subs) {
      s.cancel();
    }
    _ref.read(chatSocketServiceProvider).leaveConversation(conversationId);
    super.dispose();
  }
}

final chatControllerProvider = StateNotifierProvider.autoDispose.family<ChatController, ChatState, String>(
  (ref, conversationId) => ChatController(ref, conversationId),
);
