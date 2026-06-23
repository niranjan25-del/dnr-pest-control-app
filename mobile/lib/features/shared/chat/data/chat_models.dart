// lib/features/shared/chat/data/chat_models.dart
//
// Chat domain models: a conversation summary and a message. Status mirrors the backend
// MessageStatus (SENT/DELIVERED/READ); a local `pending` state covers optimistic sends.

class Conversation {
  final String id;
  final String? bookingId;
  final String title; // counterpart name (technician/customer/support)
  final String? lastMessage;
  final DateTime? lastMessageAt;
  final int unreadCount;
  final String status; // OPEN/CLOSED

  const Conversation({
    required this.id,
    required this.title,
    this.bookingId,
    this.lastMessage,
    this.lastMessageAt,
    this.unreadCount = 0,
    this.status = 'OPEN',
  });

  factory Conversation.fromJson(Map<String, dynamic> j) => Conversation(
        id: j['id'].toString(),
        bookingId: j['booking_id']?.toString(),
        title: (j['title'] ?? j['counterpart_name'] ?? 'Conversation').toString(),
        lastMessage: j['last_message']?.toString() ?? (j['last_message'] is Map ? j['last_message']['body'] : null)?.toString(),
        lastMessageAt: j['last_message_at'] == null ? null : DateTime.tryParse(j['last_message_at'].toString()),
        unreadCount: (j['unread_count'] as num?)?.toInt() ?? 0,
        status: j['status']?.toString() ?? 'OPEN',
      );
}

enum MessageDelivery { pending, sent, delivered, read, failed }

MessageDelivery deliveryFrom(String? raw) {
  switch (raw?.toUpperCase()) {
    case 'SENT':
      return MessageDelivery.sent;
    case 'DELIVERED':
      return MessageDelivery.delivered;
    case 'READ':
      return MessageDelivery.read;
    default:
      return MessageDelivery.sent;
  }
}

class ChatMessage {
  final String id; // server id or local temp id
  final String conversationId;
  final String senderId;
  final String? body;
  final String? attachmentFileId;
  final String? attachmentUrl;
  final MessageDelivery delivery;
  final DateTime createdAt;
  final bool mine;

  const ChatMessage({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.createdAt,
    this.body,
    this.attachmentFileId,
    this.attachmentUrl,
    this.delivery = MessageDelivery.sent,
    this.mine = false,
  });

  ChatMessage copyWith({String? id, MessageDelivery? delivery}) => ChatMessage(
        id: id ?? this.id,
        conversationId: conversationId,
        senderId: senderId,
        body: body,
        attachmentFileId: attachmentFileId,
        attachmentUrl: attachmentUrl,
        delivery: delivery ?? this.delivery,
        createdAt: createdAt,
        mine: mine,
      );

  factory ChatMessage.fromJson(Map<String, dynamic> j, {required String currentUserId}) {
    final sender = j['sender_id']?.toString() ?? (j['sender'] is Map ? j['sender']['id']?.toString() : '') ?? '';
    return ChatMessage(
      id: j['id'].toString(),
      conversationId: (j['conversation_id'] ?? j['conversationId']).toString(),
      senderId: sender,
      body: j['body']?.toString(),
      attachmentFileId: j['attachment_file_id']?.toString(),
      attachmentUrl: j['attachment_url']?.toString(),
      delivery: deliveryFrom(j['status']?.toString()),
      createdAt: DateTime.tryParse((j['created_at'] ?? '').toString())?.toLocal() ?? DateTime.now(),
      mine: sender == currentUserId,
    );
  }
}
