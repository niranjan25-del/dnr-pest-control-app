// lib/features/shared/chat/data/chat_socket_service.dart
//
// Socket.IO client for the backend /chat namespace (Step 29). Authenticates with the app
// JWT on the handshake, joins conversation rooms, and exposes streams for incoming
// messages, typing, and read receipts. Emits send/typing/read events.
//
// NOTE: event names below must match the gateway's @SubscribeMessage handlers. Adjust the
// constants if the backend uses different names.

import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../../../config/app_environment.dart';
import '../../../../services/secure_storage_service.dart';
import '../../../../utils/app_logger.dart';
import 'chat_models.dart';

class ChatSocketEvents {
  static const join = 'conversation:join';
  static const leave = 'conversation:leave';
  static const sendMessage = 'message:send';
  static const newMessage = 'message:new';
  static const typing = 'typing';
  static const typingStart = 'typing:start';
  static const typingStop = 'typing:stop';
  static const read = 'message:read';
}

class TypingEvent {
  final String conversationId;
  final String userId;
  final bool isTyping;
  TypingEvent(this.conversationId, this.userId, this.isTyping);
}

class ReadEvent {
  final String conversationId;
  final String messageId;
  ReadEvent(this.conversationId, this.messageId);
}

class ChatSocketService {
  final AppEnvironment _env;
  final SecureStorageService _storage;
  final String currentUserId;
  io.Socket? _socket;

  final _messages = StreamController<ChatMessage>.broadcast();
  final _typing = StreamController<TypingEvent>.broadcast();
  final _reads = StreamController<ReadEvent>.broadcast();
  final _connected = StreamController<bool>.broadcast();

  ChatSocketService(this._env, this._storage, this.currentUserId);

  Stream<ChatMessage> get onMessage => _messages.stream;
  Stream<TypingEvent> get onTyping => _typing.stream;
  Stream<ReadEvent> get onRead => _reads.stream;
  Stream<bool> get onConnected => _connected.stream;
  bool get isConnected => _socket?.connected ?? false;

  Future<void> connect() async {
    if (_socket != null) return;
    final token = await _storage.readAccessToken();
    _socket = io.io(
      '${_env.wsBaseUrl}/chat',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': token})
          .setExtraHeaders({'Authorization': 'Bearer $token'})
          .build(),
    );

    _socket!
      ..onConnect((_) {
        AppLogger.i('Chat socket connected');
        _connected.add(true);
      })
      ..onDisconnect((_) => _connected.add(false))
      ..onConnectError((e) => AppLogger.w('Chat socket error: $e'))
      ..on(ChatSocketEvents.newMessage, (data) {
        if (data is Map) _messages.add(ChatMessage.fromJson(Map<String, dynamic>.from(data), currentUserId: currentUserId));
      })
      ..on(ChatSocketEvents.typing, (data) {
        if (data is Map) _typing.add(TypingEvent(data['conversation_id']?.toString() ?? '', data['user_id']?.toString() ?? '', data['is_typing'] == true));
      })
      ..on(ChatSocketEvents.read, (data) {
        if (data is Map) _reads.add(ReadEvent(data['conversation_id']?.toString() ?? '', data['message_id']?.toString() ?? ''));
      });

    _socket!.connect();
  }

  void joinConversation(String conversationId) => _socket?.emit(ChatSocketEvents.join, {'conversation_id': conversationId});
  void leaveConversation(String conversationId) => _socket?.emit(ChatSocketEvents.leave, {'conversation_id': conversationId});

  void sendMessage(String conversationId, {String? body, String? attachmentFileId}) {
    _socket?.emit(ChatSocketEvents.sendMessage, {
      'conversation_id': conversationId,
      if (body != null) 'body': body,
      if (attachmentFileId != null) 'attachment_file_id': attachmentFileId,
    });
  }

  void setTyping(String conversationId, bool typing) =>
      _socket?.emit(typing ? ChatSocketEvents.typingStart : ChatSocketEvents.typingStop, {'conversation_id': conversationId});

  void markRead(String conversationId, String messageId) =>
      _socket?.emit(ChatSocketEvents.read, {'conversation_id': conversationId, 'message_id': messageId});

  Future<void> dispose() async {
    _socket?.dispose();
    _socket = null;
    await _messages.close();
    await _typing.close();
    await _reads.close();
    await _connected.close();
  }
}
