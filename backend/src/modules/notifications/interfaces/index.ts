// src/modules/notifications/interfaces/index.ts

import { NotificationType } from '@prisma/client';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushResult {
  attempted: number;
  succeeded: number;
  failed: number;
  invalidTokens: string[];
}

export interface DispatchResult {
  notification_id: string;
  pushed: boolean;
  push?: { succeeded: number; failed: number };
}
