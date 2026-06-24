// src/modules/subscriptions/recurring-booking.service.ts
//
// Generates the recurring service visits for a subscription as Booking rows (linked via
// Booking.subscriptionId). A subscription visit has no service/package linkage (the schema's
// SubscriptionPlan doesn't model included services) — it represents a scheduled covered visit
// at price 0 (billing is handled by the subscription itself). Uses the customer's chosen/
// default address. Runs inside the caller's transaction when provided.

import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import {
  BookingStatus,
  Prisma,
  Subscription,
  SubscriptionPlan,
} from "@prisma/client";
import { PrismaService } from "src/database/prisma.service";

const DEFAULT_VISIT_DURATION_MIN = 60;

@Injectable()
export class RecurringBookingService {
  private readonly logger = new Logger(RecurringBookingService.name);
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve the address to use for a subscription's visits. */
  async resolveAddressId(
    customerId: string,
    preferredAddressId?: string,
  ): Promise<string> {
    if (preferredAddressId) {
      const a = await this.prisma.address.findFirst({
        where: { id: preferredAddressId, customerId, deletedAt: null },
        select: { id: true },
      });
      if (!a)
        throw new BadRequestException({
          code: "ADDRESS_NOT_FOUND",
          message: "Address not found for this customer",
        });
      return a.id;
    }
    const def = await this.prisma.address.findFirst({
      where: { customerId, deletedAt: null },
      orderBy: { isDefault: "desc" },
      select: { id: true },
    });
    if (!def)
      throw new BadRequestException({
        code: "ADDRESS_REQUIRED",
        message: "A service address is required to subscribe",
      });
    return def.id;
  }

  /** Create the next subscription visit at `scheduledStart`. */
  async generateVisit(
    tx: Prisma.TransactionClient,
    params: {
      subscription: Subscription;
      plan: SubscriptionPlan;
      addressId: string;
      scheduledStart: Date;
      changedById: string;
    },
  ): Promise<string> {
    const { subscription, plan, addressId, scheduledStart, changedById } =
      params;
    const end = new Date(
      scheduledStart.getTime() + DEFAULT_VISIT_DURATION_MIN * 60_000,
    );
    const booking = await tx.booking.create({
      data: {
        customerId: subscription.customerId,
        subscriptionId: subscription.id,
        addressId,
        status: BookingStatus.PENDING,
        scheduledWindowStart: scheduledStart,
        scheduledWindowEnd: end,
        price: 0,
        currency: plan.currency,
        notes: `Subscription visit (${plan.name})`,
      },
    });
    await tx.bookingStatusHistory.create({
      data: {
        bookingId: booking.id,
        previousStatus: null,
        newStatus: BookingStatus.PENDING,
        changedById,
        note: "Recurring subscription visit",
      },
    });
    this.logger.log(
      `Generated subscription visit ${booking.id} for subscription ${subscription.id}`,
    );
    return booking.id;
  }
}
