// lib/features/shared/chat/presentation/chat_screens.dart
//
// Conversation list + the chat thread (bubbles, attachments, typing indicator, read
// receipts, composer with image attach). Grouped since they share models/providers.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../../../core/extensions/context_extensions.dart';
import '../../../../shared/widgets/state_views.dart';
import '../../uploads/application/upload_controller.dart';
import '../../uploads/presentation/upload_widgets.dart';
import '../application/chat_controller.dart';
import '../data/chat_models.dart';

class ConversationListScreen extends ConsumerWidget {
  const ConversationListScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversations = ref.watch(conversationsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Messages')),
      body: AsyncValueView<List<Conversation>>(
        value: conversations,
        onRetry: () => ref.invalidate(conversationsProvider),
        isEmpty: (d) => d.isEmpty,
        empty: const EmptyView(icon: Icons.forum_outlined, title: 'No conversations yet'),
        data: (list) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(conversationsProvider),
          child: ListView.separated(
            itemCount: list.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final c = list[i];
              return ListTile(
                leading: CircleAvatar(child: Text(c.title.isNotEmpty ? c.title[0].toUpperCase() : '?')),
                title: Text(c.title),
                subtitle: Text(c.lastMessage ?? 'No messages yet', maxLines: 1, overflow: TextOverflow.ellipsis),
                trailing: c.unreadCount > 0 ? Badge(label: Text('${c.unreadCount}')) : (c.lastMessageAt != null ? Text(DateFormat.jm().format(c.lastMessageAt!.toLocal()), style: context.text.bodySmall) : null),
                onTap: () => context.push('/chat/${c.id}', extra: c.title),
              );
            },
          ),
        ),
      ),
    );
  }
}

class ChatScreen extends ConsumerStatefulWidget {
  final String conversationId;
  final String title;
  const ChatScreen({super.key, required this.conversationId, this.title = 'Chat'});
  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  ChatController get _controller => ref.read(chatControllerProvider(widget.conversationId).notifier);

  Future<void> _attach() async {
    final source = await showImageSourceSheet(context);
    if (source == null) return;
    final file = await ref.read(uploadControllerProvider.notifier).pick(source);
    if (file == null) return;
    final id = await ref.read(uploadControllerProvider.notifier).upload(relatedType: 'chat_message', relatedId: widget.conversationId);
    if (id != null) {
      await _controller.send(attachmentFileId: id);
      ref.read(uploadControllerProvider.notifier).reset();
    } else if (mounted) {
      context.showSnack('Image upload failed');
    }
  }

  void _send() {
    final text = _input.text.trim();
    if (text.isEmpty) return;
    _controller.send(body: text);
    _input.clear();
    _controller.onTextChanged('');
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chatControllerProvider(widget.conversationId));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent);
    });

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.title),
            if (state.counterpartTyping) Text('typing…', style: context.text.bodySmall?.copyWith(color: context.colors.primary)),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: state.loading
                ? const LoadingView()
                : state.messages.isEmpty
                    ? const EmptyView(icon: Icons.chat_bubble_outline, title: 'Say hello 👋')
                    : ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.all(12),
                        itemCount: state.messages.length,
                        itemBuilder: (_, i) => _MessageBubble(state.messages[i]),
                      ),
          ),
          const UploadProgressTile(relatedType: 'chat_message', relatedId: ''),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Row(children: [
                IconButton(icon: const Icon(Icons.attach_file), onPressed: _attach),
                Expanded(
                  child: TextField(
                    controller: _input,
                    minLines: 1,
                    maxLines: 4,
                    textInputAction: TextInputAction.send,
                    decoration: const InputDecoration(hintText: 'Message…'),
                    onChanged: _controller.onTextChanged,
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(icon: const Icon(Icons.send), onPressed: _send),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final ChatMessage m;
  const _MessageBubble(this.m);
  @override
  Widget build(BuildContext context) {
    final align = m.mine ? Alignment.centerRight : Alignment.centerLeft;
    final color = m.mine ? context.colors.primary : context.colors.surfaceContainerHighest;
    final textColor = m.mine ? context.colors.onPrimary : context.colors.onSurface;
    return Align(
      alignment: align,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: const BoxConstraints(maxWidth: 280),
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(16)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (m.attachmentFileId != null && m.body == null)
              Icon(Icons.image_outlined, color: textColor)
            else if (m.body != null)
              Text(m.body!, style: TextStyle(color: textColor)),
            const SizedBox(height: 2),
            Row(mainAxisSize: MainAxisSize.min, children: [
              Text(DateFormat.jm().format(m.createdAt), style: TextStyle(color: textColor.withValues(alpha: 0.7), fontSize: 10)),
              if (m.mine) ...[const SizedBox(width: 4), Icon(_statusIcon(m.delivery), size: 12, color: textColor.withValues(alpha: 0.7))],
            ]),
          ],
        ),
      ),
    );
  }

  IconData _statusIcon(MessageDelivery d) => switch (d) {
        MessageDelivery.pending => Icons.schedule,
        MessageDelivery.sent => Icons.check,
        MessageDelivery.delivered => Icons.done_all,
        MessageDelivery.read => Icons.done_all,
        MessageDelivery.failed => Icons.error_outline,
      };
}
