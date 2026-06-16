// src/modules/bookings/booking-status.service.ts
//
// Owns the booking state machine. Validates a transition against BOOKING_TRANSITIONS, applies
// it, and writes both a BookingStatusHistory row (audit trail) and an AuditLog entry — all in
// the caller's transaction so status + history move atomically. Role eligibility is enforced
// by BookingsService; this service guards the graph itself.

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { isTransitionAllowed } from './enums';

@Injectable()
export class BookingStatusService {
  private readonly logger = new Logger(BookingStatusService.name);

  /** Validate + apply a status change within an existing transaction client. */
  async transition(
    tx: Prisma.TransactionClient,
    params: {
      bookingId: string;
      current: BookingStatus;
      next: BookingStatus;
      changedById: string;
      note?: string;
    },
  ): Promise<void> {
    const { bookingId, current, next, changedById, note } = params;

    if (current === next) {
      throw new BadRequestException({ code: 'INVALID_STATUS_TRANSITION', message: `Booking is already ${current}` });
    }
    if (!isTransitionAllowed(current, next)) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Cannot move a booking from ${current} to ${next}`,
      });
    }

    await tx.booking.update({ where: { id: bookingId }, data: { status: next } });
    await tx.bookingStatusHistory.create({
      data: { bookingId, previousStatus: current, newStatus: next, note, changedById },
    });
    await tx.auditLog.create({
      data: {
        actorId: changedById, action: 'booking.status_changed', entityType: 'booking',
        entityId: bookingId, metadata: { from: current, to: next, note },
      },
    });
    this.logger.log(`Booking ${bookingId} status ${current} → ${next} by ${changedById}`);
  }
}
