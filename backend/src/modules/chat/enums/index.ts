// src/modules/chat/enums/index.ts
//
// Socket event names + attachment policy.
//
// NOTE (schema reconciliation): MessageStatus is {SENT, DELIVERED, READ} — there is no FAILED.
// Delivery tracking uses these three; a client-side send failure is a client concern (the
// message simply never reaches the server). ChatMessage has no deletedAt, so "soft delete" is
// a content tombstone (see message.service).

export const CHAT_NAMESPACE = '/chat';

// WebSocket event names (client ⇄ server).
export const ChatEvent = {
  JOIN: 'joinConversation',
  LEAVE: 'leaveConversation',
  SEND: 'sendMessage',
  RECEIVE: 'receiveMessage',
  READ: 'messageRead',
  TYPING_START: 'typingStart',
  TYPING_STOP: 'typingStop',
  USER_ONLINE: 'userOnline',
  USER_OFFLINE: 'userOffline',
  ERROR: 'chatError',
} as const;

export const roomForConversation = (id: string) => `conv:${id}`;
export const roomForUser = (id: string) => `user:${id}`;

// Attachment validation policy (enforced when minting upload URLs).
export const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
  'application/pdf', 'text/plain',
]);
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
