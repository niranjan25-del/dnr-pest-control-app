// src/modules/subscriptions/renewal.service.ts
//
// Renewal lifecycle:
//   • sendRenewalReminders(daysAhead) — notify customers whose next billing is approaching.
//   • processDueRenewals() — generate the next service visit and advance the schedule for
//     subscriptions whose billing date has passed. The actual payment is collected separately
//     via a Cashfree order (initiated by the customer in-app or via payment link).
//
// ⚠ SCHEDULING: processDueRenewals / sendRenewalReminders must be invoked on a schedule.
// Wire @nestjs/schedule (@Cron) or an external cron/SQS to call them.

import { Injectable, Logger } from '@nestjs/common';
import { NotificationStatus, NotificationType, Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { RecurringBookingService } from './recurring-booking.service';
import { nextCycleDate } from './enums';

@Injectable()
export class RenewalService {
  private readonly logger = new Logger(RenewalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recurring: RecurringBookingService,
  ) {}

  async sendRenewalReminders(daysAhead = 3): Promise<{ notified: number }> {
    const until = new Date(Date.now() + daysAhead * 86400_000);
    const due = await this.prisma.subscription.findMany({
      where: {
        deletedAt: null, status: SubscriptionStatus.ACTIVE,
        nextBillingDate: { lte: until, gte: new Date() },
      },
      include: { plan: { select: { name: true } }, customer: { select: { userId: true } } },
    });
    for (const sub of due) {
      await this.prisma.notification.create({
        data: {
          userId: sub.customer.userId, type: NotificationType.PAYMENT, status: NotificationStatus.PENDING,
          title: 'Upcoming subscription renewal',
          body: `Your ${sub.plan.name} plan renews on ${sub.nextBillingDate?.toISOString().slice(0, 10)}.`,
          data: { subscriptionId: sub.id } as Prisma.InputJsonValue,
        },
      });
    }
    this.logger.log(`Renewal reminders queued: ${due.length}`);
    return { notified: due.length };
  }

  async processDueRenewals(): Promise<{ processed: number }> {
    const now = new Date();
    const due = await this.prisma.subscription.findMany({
      where: { deletedAt: null, status: SubscriptionStatus.ACTIVE, nextBillingDate: { lte: now } },
      include: { plan: true },
    });
    let processed = 0;
    for (const sub of due) {
      try {
        const addressId = await this.recurring.resolveAddressId(sub.customerId);
        const serviceDate = sub.nextServiceDate ?? now;
        await this.prisma.$transaction(async (tx) => {
          await this.recurring.generateVisit(tx, {
            subscription: sub, plan: sub.plan, addressId, scheduledStart: serviceDate,
            changedById: sub.customerId,
          });
          await tx.subscription.update({
            where: { id: sub.id },
            data: {
              nextBillingDate: nextCycleDate(sub.nextBillingDate ?? now, sub.plan.billingCycle),
              nextServiceDate: nextCycleDate(serviceDate, sub.plan.billingCycle),
            },
          });
          await tx.auditLog.create({
            data: { action: 'subscription.renewed', entityType: 'subscription', entityId: sub.id },
          });
        });
        processed++;
      } catch (err) {
        this.logger.error(`Renewal failed for subscription ${sub.id}: ${(err as Error).message}`);
      }
    }
    this.logger.log(`Renewals processed: ${processed}/${due.length}`);
    return { processed };
  }
}
