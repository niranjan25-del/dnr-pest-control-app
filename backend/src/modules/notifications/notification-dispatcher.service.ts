// src/modules/notifications/notification-dispatcher.service.ts
//
// The dispatch core + event triggers. dispatch(): persist the in-app Notification (PENDING),
// push to the user's devices via FCM (honoring preferences), set status SENT/FAILED, and prune
// permanently-invalid tokens. Exported so other modules trigger notifications by calling the
// on* methods (e.g. PaymentsService.onPaymentSuccess) — those wirings are documented seams,
// not edits to approved modules.
//
// STATUS SEMANTICS: SENT once the in-app row is stored and/or FCM accepts the push (FCM accept
// ≠ device delivery; true DELIVERED needs delivery receipts — left as a future enhancement).
// FAILED only when a push-only notification fails entirely. READ is set by the notification
// center. Durable/queued retry is flagged in fcm.service; retryFailed() offers a re-send path.

import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationStatus, NotificationType, Prisma, UserRole,
} from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { FcmService } from './fcm.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationChannel } from './enums';
import { DispatchResult, NotificationPayload } from './interfaces';
import { templates } from './templates';

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
    private readonly prefs: NotificationPreferencesService,
  ) {}

  // ---------------- Core dispatch ----------------
  async dispatch(userId: string, payload: NotificationPayload): Promise<DispatchResult> {
    const wantInApp = this.prefs.isEnabled(userId, payload.type, NotificationChannel.IN_APP);
    const wantPush = this.prefs.isEnabled(userId, payload.type, NotificationChannel.PUSH);

    const notification = await this.prisma.notification.create({
      data: {
        userId, type: payload.type, status: NotificationStatus.PENDING,
        title: payload.title, body: payload.body,
        data: (payload.data ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    let pushed = false;
    let pushStats: { succeeded: number; failed: number } | undefined;
    if (wantPush) {
      const tokens = (await this.prisma.deviceToken.findMany({ where: { userId }, select: { token: true } })).map((t) => t.token);
      if (tokens.length) {
        const res = await this.fcm.sendToTokens(tokens, payload);
        pushed = res.succeeded > 0;
        pushStats = { succeeded: res.succeeded, failed: res.failed };
        if (res.invalidTokens.length) {
          await this.prisma.deviceToken.deleteMany({ where: { token: { in: res.invalidTokens } } });
          this.logger.log(`Pruned ${res.invalidTokens.length} invalid device token(s)`);
        }
      }
    }

    const delivered = wantInApp || pushed;
    await this.prisma.notification.update({
      where: { id: notification.id },
      data: { status: delivered ? NotificationStatus.SENT : NotificationStatus.FAILED },
    });
    this.logger.log(`Notification ${notification.id} → ${delivered ? 'SENT' : 'FAILED'} (push ${pushed})`);
    return { notification_id: notification.id, pushed, push: pushStats };
  }

  /** Fan-out to many users (used by broadcasts). Stores in-app rows in bulk, pushes per user. */
  async dispatchMany(userIds: string[], payload: NotificationPayload): Promise<{ created: number; pushed: number }> {
    if (userIds.length === 0) return { created: 0, pushed: 0 };
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId, type: payload.type, status: NotificationStatus.SENT,
        title: payload.title, body: payload.body, data: (payload.data ?? undefined) as Prisma.InputJsonValue | undefined,
      })),
    });
    const tokens = (await this.prisma.deviceToken.findMany({ where: { userId: { in: userIds } }, select: { token: true } })).map((t) => t.token);
    let pushed = 0;
    if (tokens.length) {
      const res = await this.fcm.sendToTokens(tokens, payload);
      pushed = res.succeeded;
      if (res.invalidTokens.length) await this.prisma.deviceToken.deleteMany({ where: { token: { in: res.invalidTokens } } });
    }
    return { created: userIds.length, pushed };
  }

  async broadcast(payload: NotificationPayload, role?: UserRole): Promise<{ created: number; pushed: number }> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, status: 'ACTIVE', ...(role ? { role } : {}) }, select: { id: true },
    });
    const result = await this.dispatchMany(users.map((u) => u.id), payload);
    await this.prisma.auditLog.create({
      data: { action: 'notification.broadcast', entityType: 'notification', entityId: 'broadcast',
        metadata: { role: role ?? 'ALL', recipients: result.created, type: payload.type } },
    });
    this.logger.log(`Broadcast to ${result.created} user(s) [role=${role ?? 'ALL'}]`);
    return result;
  }

  /** Re-attempt FAILED notifications (admin/cron). In-process retry; durable retry is flagged. */
  async retryFailed(limit = 100): Promise<{ retried: number }> {
    const failed = await this.prisma.notification.findMany({ where: { status: NotificationStatus.FAILED }, take: limit });
    let retried = 0;
    for (const n of failed) {
      const tokens = (await this.prisma.deviceToken.findMany({ where: { userId: n.userId }, select: { token: true } })).map((t) => t.token);
      if (!tokens.length) continue;
      const res = await this.fcm.sendToTokens(tokens, { type: n.type, title: n.title, body: n.body, data: (n.data as Record<string, unknown>) ?? undefined });
      if (res.succeeded > 0) {
        await this.prisma.notification.update({ where: { id: n.id }, data: { status: NotificationStatus.SENT } });
        retried++;
      }
    }
    return { retried };
  }

  // ================= Event triggers (call from other modules) =================
  async onBookingCreated(bookingId: string, customerUserId: string, scheduledStart: Date) {
    return this.dispatch(customerUserId, templates.bookingConfirmation({ bookingId, scheduledStart }));
  }
  async onTechnicianAssigned(bookingId: string, customerUserId: string, technicianUserId: string, scheduledStart: Date, technicianName?: string) {
    await this.dispatch(customerUserId, templates.technicianAssigned({ bookingId, technicianName }));
    return this.dispatch(technicianUserId, templates.newAssignment({ bookingId, scheduledStart }));
  }
  async onBookingEnRoute(bookingId: string, customerUserId: string) {
    return this.dispatch(customerUserId, templates.technicianEnRoute({ bookingId }));
  }
  async onBookingCompleted(bookingId: string, customerUserId: string) {
    return this.dispatch(customerUserId, templates.bookingCompleted({ bookingId }));
  }
  async onPaymentSuccess(customerUserId: string, amount: number, currency: string, invoiceNumber?: string) {
    return this.dispatch(customerUserId, templates.paymentSuccess({ amount, currency, invoiceNumber }));
  }
  async onPaymentFailed(customerUserId: string, amount: number, currency: string) {
    return this.dispatch(customerUserId, templates.paymentFailed({ amount, currency }));
  }
  async onSubscriptionRenewal(customerUserId: string, planName: string, date: Date) {
    return this.dispatch(customerUserId, templates.subscriptionReminder({ planName, date }));
  }
  async onNewChatMessage(recipientUserId: string, conversationId: string, preview: string) {
    return this.dispatch(recipientUserId, templates.newChatMessage({ conversationId, preview }));
  }
}
