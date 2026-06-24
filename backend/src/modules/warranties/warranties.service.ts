// src/modules/warranties/warranties.service.ts
// Read-only warranty service for the customer portal. Warranties are auto-created by
// BookingsService when a booking transitions to COMPLETED. Backfill runs on list so
// historical completed bookings also surface warranties.

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BookingStatus, UserRole } from "@prisma/client";
import { PrismaService } from "src/database/prisma.service";
import { AuthenticatedUser } from "../auth/interfaces/auth.interfaces";

@Injectable()
export class WarrantiesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCustomer(actor: AuthenticatedUser) {
    const customerId = await this.resolveCustomerId(actor);
    // Create warranty records for any completed bookings that don't have one yet.
    await this.backfillMissingWarranties(customerId);
    const rows = await this.prisma.serviceWarranty.findMany({
      where: { booking: { customerId } },
      include: { booking: { select: { id: true } } },
      orderBy: { expiresAt: "asc" },
    });
    return rows.map((w) => this.toResponse(w));
  }

  async findByBooking(bookingId: string, actor: AuthenticatedUser) {
    const warranty = await this.prisma.serviceWarranty.findFirst({
      where: { bookingId },
      include: { booking: { select: { id: true, customerId: true } } },
    });
    if (!warranty)
      throw new NotFoundException({
        code: "WARRANTY_NOT_FOUND",
        message: "No warranty for this booking",
      });

    if (actor.role === UserRole.CUSTOMER) {
      const profile = await this.prisma.customerProfile.findUnique({
        where: { userId: actor.id },
        select: { id: true },
      });
      if (!profile || warranty.booking.customerId !== profile.id) {
        throw new ForbiddenException({
          code: "FORBIDDEN",
          message: "Not your booking",
        });
      }
    }

    return this.toResponse(warranty);
  }

  // ---- helpers ----

  /**
   * For any COMPLETED booking that has a service with warrantyDays > 0 but no warranty
   * record yet, create the record now. This covers bookings completed before the warranty
   * feature was introduced.
   */
  private async backfillMissingWarranties(customerId: string): Promise<void> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        customerId,
        status: BookingStatus.COMPLETED,
        serviceId: { not: null },
        warranty: null,
      },
      select: {
        id: true,
        updatedAt: true,
        service: { select: { name: true, warrantyDays: true } },
      },
    });

    for (const b of bookings) {
      if (!b.service || b.service.warrantyDays <= 0) continue;
      const expiresAt = new Date(b.updatedAt);
      expiresAt.setDate(expiresAt.getDate() + b.service.warrantyDays);
      await this.prisma.serviceWarranty
        .upsert({
          where: { bookingId: b.id },
          create: {
            bookingId: b.id,
            serviceName: b.service.name,
            warrantyDays: b.service.warrantyDays,
            expiresAt,
          },
          update: {},
        })
        .catch(() => {
          /* concurrent request already created it */
        });
    }
  }

  private async resolveCustomerId(actor: AuthenticatedUser): Promise<string> {
    if (actor.role === UserRole.CUSTOMER) {
      const p = await this.prisma.customerProfile.findUnique({
        where: { userId: actor.id },
        select: { id: true },
      });
      return p?.id ?? "00000000-0000-0000-0000-000000000000";
    }
    return "00000000-0000-0000-0000-000000000000";
  }

  private toResponse(w: {
    id: string;
    bookingId: string;
    serviceName: string;
    warrantyDays: number;
    expiresAt: Date;
    isActive: boolean;
    claimedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const now = new Date();
    const msLeft = w.expiresAt.getTime() - now.getTime();
    const daysRemaining = Math.max(
      0,
      Math.ceil(msLeft / (1000 * 60 * 60 * 24)),
    );
    return {
      id: w.id,
      booking_id: w.bookingId,
      service_name: w.serviceName,
      warranty_days: w.warrantyDays,
      expires_at: w.expiresAt,
      is_active: w.isActive && w.expiresAt > now,
      claimed_at: w.claimedAt,
      days_remaining: daysRemaining,
      created_at: w.createdAt,
    };
  }
}
