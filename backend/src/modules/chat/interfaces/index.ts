// src/modules/chat/interfaces/index.ts

import { AdminRole, MessageStatus, MessageType, UserRole } from '@prisma/client';

// Authenticated identity attached to a socket after JWT verification.
export interface SocketUser {
  id: string;
  role: UserRole;
  adminRole?: AdminRole | null;
  email: string;
  permissions: string[];
}

export interface MessageView {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: MessageType;
  status: MessageStatus;
  content: string | null;
  media?: { id: string; url: string | null; content_type: string } | null;
  created_at: Date;
}

export interface ConversationView {
  id: string;
  booking_id: string | null;
  is_active: boolean;
  participants: { user_id: string; role: UserRole; name: string }[];
  last_message: MessageView | null;
  unread_count: number;
  updated_at: Date;
}
