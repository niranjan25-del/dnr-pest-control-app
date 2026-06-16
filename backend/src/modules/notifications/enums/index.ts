// src/modules/notifications/enums/index.ts
//
// Channels, default preferences, retry config, and type mapping.
//
// NOTE (schema reconciliation): NotificationType is {BOOKING, PAYMENT, ASSIGNMENT, CHAT,
// PROMOTION, REVIEW, SYSTEM} — there is no SUBSCRIPTION or REMINDER value. Subscription/
// renewal reminders map to PAYMENT; appointment/follow-up reminders map to BOOKING. We don't
// add enum values.

import { NotificationType } from '@prisma/client';

export enum NotificationChannel {
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
}

export interface ChannelPrefs {
  push: boolean;
  inApp: boolean;
}

// Defaults applied when no stored preference exists (see notification-preferences.service).
export const DEFAULT_CHANNEL_PREFS: ChannelPrefs = { push: true, inApp: true };

export const ALL_TYPES: NotificationType[] = [
  NotificationType.BOOKING, NotificationType.PAYMENT, NotificationType.ASSIGNMENT,
  NotificationType.CHAT, NotificationType.PROMOTION, NotificationType.REVIEW, NotificationType.SYSTEM,
];

// In-process retry for transient FCM errors (durable retry would need a queue/outbox — flagged).
export const FCM_MAX_ATTEMPTS = 3;
export const FCM_RETRY_DELAY_MS = 300;
export const FCM_MULTICAST_BATCH = 500; // FCM hard limit per multicast

// FCM error codes that indicate a permanently invalid token (prune these).
export const INVALID_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);
