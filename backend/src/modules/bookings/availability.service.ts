// src/modules/bookings/availability.service.ts
//
// Scheduling validation: future-date + lead time, business-hours window, and a pre-assignment
// conflict/capacity check (no more than MAX_CONCURRENT_PER_SLOT overlapping live bookings).
// True per-technician conflict detection happens at assignment time (Step 7); this guards the
// customer-facing create/reschedule flow. Throws standardized errors.

import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/database/prisma.service";
import { ACTIVE_STATUSES, SCHEDULING } from "./enums";

export interface ResolvedWindow {
  start: Date;
  end: Date;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate the requested start and compute the window end from duration + buffer.
   * When `skipBusinessRules` is true (admin manual bookings) only the date parse is
   * validated — lead time and business-hours checks are bypassed.
   */
  resolveWindow(
    scheduledStart: string,
    durationMin: number,
    skipBusinessRules = false,
  ): ResolvedWindow {
    const start = new Date(scheduledStart);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException({
        code: "INVALID_DATE",
        message: "Invalid scheduled start",
      });
    }

    const end = new Date(
      start.getTime() + (durationMin + SCHEDULING.SLOT_BUFFER_MIN) * 60_000,
    );

    if (!skipBusinessRules) {
      const now = Date.now();
      if (start.getTime() < now + SCHEDULING.MIN_LEAD_TIME_MIN * 60_000) {
        throw new BadRequestException({
          code: "INVALID_DATE",
          message: `Bookings must be at least ${SCHEDULING.MIN_LEAD_TIME_MIN / 60} hours in advance`,
        });
      }

      // Business hours (local time of the server/region — ap-south-1 / IST in production).
      const startHour = start.getHours();
      const endHour = end.getHours() + (end.getMinutes() > 0 ? 1 : 0);
      if (
        startHour < SCHEDULING.WORKING_HOUR_START ||
        endHour > SCHEDULING.WORKING_HOUR_END
      ) {
        throw new BadRequestException({
          code: "OUTSIDE_BUSINESS_HOURS",
          message: `Service window must fall within ${SCHEDULING.WORKING_HOUR_START}:00–${SCHEDULING.WORKING_HOUR_END}:00`,
        });
      }
    }

    return { start, end };
  }

  /** Reject if the slot is already at capacity (overlapping live bookings). */
  async assertSlotAvailable(
    window: ResolvedWindow,
    excludeBookingId?: string,
  ): Promise<void> {
    const where: Prisma.BookingWhereInput = {
      deletedAt: null,
      status: { in: ACTIVE_STATUSES },
      // Overlap: existing.start < new.end AND existing.end > new.start
      scheduledWindowStart: { lt: window.end },
      scheduledWindowEnd: { gt: window.start },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    };
    const overlapping = await this.prisma.booking.count({ where });
    if (overlapping >= SCHEDULING.MAX_CONCURRENT_PER_SLOT) {
      throw new BadRequestException({
        code: "SCHEDULE_CONFLICT",
        message:
          "The selected time slot is fully booked. Please choose another time.",
      });
    }
  }
}
