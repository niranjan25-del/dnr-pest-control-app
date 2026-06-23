// src/modules/bookings/bookings.service.ts
//
// Core booking orchestration. Authorization is scoped by role (defense in depth):
//   • CUSTOMER → only bookings owned by their CustomerProfile
//   • TECHNICIAN → only bookings they're assigned to
//   • ADMIN → all
// Creation, reschedule, cancel, and status changes run in transactions so booking + status
// history + audit move atomically. Prices/durations are snapshotted onto the booking at
// creation. A human-readable booking_number is derived (display-only) for responses.

import {
  BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { BookingPriority, BookingStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { paginate } from 'src/common/utils/pagination.util';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { AvailabilityService } from './availability.service';
import { BookingStatusService } from './booking-status.service';
import {
  BookingFilterDto, CancelBookingDto, CreateBookingDto, RescheduleBookingDto, UpdateBookingDto,
  UpdateBookingStatusDto,
} from './dto';
import {
  ACTIVE_STATUSES, CANCELLABLE_BY_CUSTOMER, TECHNICIAN_SETTABLE, formatBookingNumber,
} from './enums';

const BOOKING_INCLUDE = {
  service: { select: { id: true, name: true, basePrice: true, estimatedDurationMin: true } },
  package: { select: { id: true, name: true, price: true } },
  address: true,
  customer: { select: { id: true, user: { select: { id: true, fullName: true, email: true, phone: true } } } },
  assignments: {
    where: { status: { not: 'CANCELLED' as const } },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: {
      id: true, technicianId: true, status: true,
      technician: { select: { user: { select: { fullName: true } } } },
    },
  },
} satisfies Prisma.BookingInclude;

const BOOKING_DETAIL_INCLUDE = {
  ...BOOKING_INCLUDE,
  statusHistory: {
    orderBy: { createdAt: 'asc' as const },
    select: { id: true, previousStatus: true, newStatus: true, note: true, createdAt: true },
  },
} satisfies Prisma.BookingInclude;

type BookingRow = Prisma.BookingGetPayload<{ include: typeof BOOKING_INCLUDE }>;
type BookingDetailRow = Prisma.BookingGetPayload<{ include: typeof BOOKING_DETAIL_INCLUDE }>;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly status: BookingStatusService,
  ) {}

  // ---------- Create ----------
  async create(actor: AuthenticatedUser, dto: CreateBookingDto) {
    if (!dto.serviceId && !dto.packageId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'A service or package is required' });
    }

    const customerId = await this.resolveCustomerId(actor, dto.customerId);

    // Validate address ownership.
    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, customerId, deletedAt: null }, select: { id: true },
    });
    if (!address) throw new BadRequestException({ code: 'ADDRESS_NOT_FOUND', message: 'Address not found for this customer' });

    // Resolve price + duration from the chosen service/package (snapshotted onto the booking).
    const { price, durationMin } = await this.resolvePricing(dto);

    const isAdmin = actor.role === UserRole.ADMIN;
    const window = this.availability.resolveWindow(dto.scheduledStart, durationMin, isAdmin);
    if (!isAdmin) await this.availability.assertSlotAvailable(window);

    const created = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          customerId, serviceId: dto.serviceId, packageId: dto.packageId, addressId: dto.addressId,
          status: BookingStatus.PENDING, scheduledWindowStart: window.start, scheduledWindowEnd: window.end,
          price, currency: 'INR', notes: dto.notes,
          priority: dto.priority ?? BookingPriority.NORMAL,
        },
      });
      await tx.bookingStatusHistory.create({
        data: { bookingId: booking.id, previousStatus: null, newStatus: BookingStatus.PENDING, changedById: actor.id },
      });
      // Attach uploaded images via the MediaFile polymorphic owner.
      if (dto.imageMediaIds?.length) {
        await tx.mediaFile.updateMany({
          where: { id: { in: dto.imageMediaIds } },
          data: { ownerType: 'booking', ownerId: booking.id },
        });
      }
      await tx.auditLog.create({
        data: { actorId: actor.id, action: 'booking.created', entityType: 'booking', entityId: booking.id },
      });
      return booking.id;
    });

    this.logger.log(`Booking ${created} created by ${actor.id}`);
    return this.findOne(created, actor);
  }

  // ---------- Read ----------
  async findOne(id: string, actor: AuthenticatedUser) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null, ...(await this.scope(actor)) },
      include: BOOKING_DETAIL_INCLUDE,
    });
    if (!booking) throw new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
    return this.toResponse(booking);
  }

  async list(actor: AuthenticatedUser, filter: BookingFilterDto) {
    const where: Prisma.BookingWhereInput = {
      deletedAt: null,
      ...(await this.scope(actor)),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.serviceId ? { serviceId: filter.serviceId } : {}),
      ...(filter.categoryId ? { service: { categoryId: filter.categoryId } } : {}),
      ...(filter.technicianId ? { assignments: { some: { technicianId: filter.technicianId } } } : {}),
      ...(filter.customer_id ? { customer: { userId: filter.customer_id } } : {}),
      ...(this.dateRange(filter.dateFrom, filter.dateTo)),
      ...(filter.search
        ? { customer: { user: { OR: [
            { fullName: { contains: filter.search, mode: 'insensitive' } },
            { email: { contains: filter.search, mode: 'insensitive' } },
          ] } } }
        : {}),
    };
    const sort = filter.sort === 'scheduledWindowStart' || filter.sort === 'createdAt' ? filter.sort : 'scheduledWindowStart';
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where, include: BOOKING_INCLUDE, orderBy: { [sort]: filter.order }, skip: filter.skip, take: filter.limit,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return paginate(rows.map((r) => this.toResponse(r)), total, filter.page, filter.limit);
  }

  // ---------- Update (notes; admin may change address) ----------
  async update(id: string, actor: AuthenticatedUser, dto: UpdateBookingDto) {
    const booking = await this.requireAccessible(id, actor);
    const isAdmin = actor.role === UserRole.ADMIN;
    if (!isAdmin && !ACTIVE_STATUSES.includes(booking.status)) {
      throw new BadRequestException({ code: 'INVALID_BOOKING_STATUS', message: 'This booking can no longer be edited' });
    }
    if (dto.addressId && !isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only an admin can change the address' });
    }
    const updated = await this.prisma.booking.update({
      where: { id },
      data: { notes: dto.notes, ...(dto.addressId ? { addressId: dto.addressId } : {}) },
      include: BOOKING_INCLUDE,
    });
    this.logger.log(`Booking ${id} updated by ${actor.id}`);
    return this.toResponse(updated);
  }

  // ---------- Reschedule ----------
  async reschedule(id: string, actor: AuthenticatedUser, dto: RescheduleBookingDto) {
    const booking = await this.requireAccessible(id, actor);
    if (actor.role !== UserRole.ADMIN && !CANCELLABLE_BY_CUSTOMER.includes(booking.status)) {
      throw new BadRequestException({ code: 'INVALID_BOOKING_STATUS', message: `Cannot reschedule a ${booking.status} booking` });
    }
    const durationMin = Math.max(
      30,
      Math.round((booking.scheduledWindowEnd.getTime() - booking.scheduledWindowStart.getTime()) / 60_000),
    );
    const window = this.availability.resolveWindow(dto.scheduledStart, durationMin);
    await this.availability.assertSlotAvailable(window, id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id },
        data: { scheduledWindowStart: window.start, scheduledWindowEnd: window.end },
        include: BOOKING_INCLUDE,
      });
      // Reschedule is recorded in history as a note (no RESCHEDULED status in the schema).
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id, previousStatus: booking.status, newStatus: booking.status,
          note: `Rescheduled to ${window.start.toISOString()}${dto.reason ? ` — ${dto.reason}` : ''}`,
          changedById: actor.id,
        },
      });
      await tx.auditLog.create({
        data: { actorId: actor.id, action: 'booking.rescheduled', entityType: 'booking', entityId: id,
          metadata: { start: window.start.toISOString(), reason: dto.reason } },
      });
      return b;
    });
    this.logger.log(`Booking ${id} rescheduled by ${actor.id}`);
    return this.toResponse(updated);
  }

  // ---------- Cancel ----------
  async cancel(id: string, actor: AuthenticatedUser, dto: CancelBookingDto) {
    const booking = await this.requireAccessible(id, actor);
    const isAdmin = actor.role === UserRole.ADMIN;
    if (!isAdmin && !CANCELLABLE_BY_CUSTOMER.includes(booking.status)) {
      throw new BadRequestException({ code: 'INVALID_BOOKING_STATUS', message: `Cannot cancel a ${booking.status} booking` });
    }
    // Late-cancellation fee if within 24h of the scheduled start.
    const feeApplied = booking.scheduledWindowStart.getTime() - Date.now() < 24 * 3600_000;

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.status.transition(tx, {
        bookingId: id, current: booking.status, next: BookingStatus.CANCELLED,
        changedById: actor.id, note: dto.reason,
      });
      return tx.booking.update({
        where: { id },
        data: { cancellationReason: dto.reason, cancellationFeeApplied: feeApplied },
        include: BOOKING_INCLUDE,
      });
    });
    this.logger.warn(`Booking ${id} cancelled by ${actor.id} (fee=${feeApplied})`);
    return this.toResponse(updated);
  }

  // ---------- Status change (technician on assigned; admin any valid) ----------
  async changeStatus(id: string, actor: AuthenticatedUser, dto: UpdateBookingStatusDto) {
    const booking = await this.requireAccessible(id, actor);
    if (actor.role === UserRole.TECHNICIAN && !TECHNICIAN_SETTABLE.includes(dto.status)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Technicians cannot set this status' });
    }
    if (actor.role === UserRole.CUSTOMER) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Use cancel/reschedule instead' });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.status.transition(tx, {
        bookingId: id, current: booking.status, next: dto.status, changedById: actor.id, note: dto.note,
      });
      if (dto.status === BookingStatus.COMPLETED) {
        await this.createWarrantyIfApplicable(tx, booking);
      }
      return tx.booking.findUniqueOrThrow({ where: { id }, include: BOOKING_INCLUDE });
    });
    return this.toResponse(updated);
  }

  // ---------- Customer history ----------
  async customerHistory(actor: AuthenticatedUser, filter: BookingFilterDto) {
    const customerId = await this.resolveCustomerId(actor);
    const where: Prisma.BookingWhereInput = {
      deletedAt: null, customerId, ...(filter.status ? { status: filter.status } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where, include: BOOKING_INCLUDE, orderBy: { scheduledWindowStart: 'desc' }, skip: filter.skip, take: filter.limit,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return paginate(rows.map((r) => this.toResponse(r)), total, filter.page, filter.limit);
  }

  // ---------- Technician schedule ----------
  async technicianSchedule(actor: AuthenticatedUser, filter: BookingFilterDto) {
    const technicianId = await this.resolveTechnicianId(actor);
    const where: Prisma.BookingWhereInput = {
      deletedAt: null,
      assignments: { some: { technicianId } },
      ...(filter.status ? { status: filter.status } : {}),
      ...(this.dateRange(filter.dateFrom, filter.dateTo)),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where, include: BOOKING_INCLUDE, orderBy: { scheduledWindowStart: 'asc' }, skip: filter.skip, take: filter.limit,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return paginate(rows.map((r) => this.toResponse(r)), total, filter.page, filter.limit);
  }

  // ================= helpers =================

  private dateRange(from?: string, to?: string): Prisma.BookingWhereInput {
    if (!from && !to) return {};
    return {
      scheduledWindowStart: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    };
  }

  /** Role-based row filter. */
  private async scope(actor: AuthenticatedUser): Promise<Prisma.BookingWhereInput> {
    if (actor.role === UserRole.ADMIN) return {};
    if (actor.role === UserRole.CUSTOMER) return { customerId: await this.resolveCustomerId(actor) };
    if (actor.role === UserRole.TECHNICIAN) {
      return { assignments: { some: { technicianId: await this.resolveTechnicianId(actor) } } };
    }
    return { id: '00000000-0000-0000-0000-000000000000' }; // deny by default
  }

  private async requireAccessible(id: string, actor: AuthenticatedUser) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null, ...(await this.scope(actor)) },
    });
    if (!booking) throw new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
    return booking;
  }

  private async resolveCustomerId(actor: AuthenticatedUser, override?: string): Promise<string> {
    if (actor.role === UserRole.ADMIN && override) return override;
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId: actor.id }, select: { id: true },
    });
    if (!profile) throw new BadRequestException({ code: 'PROFILE_NOT_FOUND', message: 'Customer profile required to book' });
    return profile.id;
  }

  private async resolveTechnicianId(actor: AuthenticatedUser): Promise<string> {
    const profile = await this.prisma.technicianProfile.findUnique({
      where: { userId: actor.id }, select: { id: true },
    });
    if (!profile) throw new BadRequestException({ code: 'PROFILE_NOT_FOUND', message: 'Technician profile not found' });
    return profile.id;
  }

  private async resolvePricing(dto: CreateBookingDto): Promise<{ price: Prisma.Decimal | number; durationMin: number }> {
    if (dto.packageId) {
      const pkg = await this.prisma.servicePackage.findFirst({
        where: { id: dto.packageId, deletedAt: null, isActive: true },
        include: { packageServices: { include: { service: { select: { estimatedDurationMin: true } } } } },
      });
      if (!pkg) throw new BadRequestException({ code: 'SERVICE_UNAVAILABLE', message: 'Package is unavailable' });
      const durationMin = pkg.packageServices.reduce((s, ps) => s + ps.service.estimatedDurationMin * ps.quantity, 0) || 60;
      return { price: pkg.price, durationMin };
    }
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId!, deletedAt: null, isActive: true },
      select: { basePrice: true, estimatedDurationMin: true },
    });
    if (!service) throw new BadRequestException({ code: 'SERVICE_UNAVAILABLE', message: 'Service is unavailable' });
    return { price: service.basePrice, durationMin: service.estimatedDurationMin };
  }

  private toResponse(b: BookingRow | BookingDetailRow) {
    const activeAssignment = b.assignments?.[0] ?? null;
    return {
      id: b.id,
      booking_number: formatBookingNumber(b.id, b.createdAt),
      status: b.status,
      // Use scheduled_window_* to match frontend expectations
      scheduled_window_start: b.scheduledWindowStart,
      scheduled_window_end: b.scheduledWindowEnd,
      price: Number(b.price),
      discount_amount: Number(b.discountAmount),
      currency: b.currency,
      notes: b.notes,
      cancellation_reason: b.cancellationReason,
      cancellation_fee_applied: b.cancellationFeeApplied,
      // Flat fields for list + technician portal
      service_name: b.service?.name ?? null,
      customer_name: b.customer?.user?.fullName ?? null,
      customer_phone: b.customer?.user?.phone ?? null,
      technician_name: activeAssignment?.technician?.user?.fullName ?? null,
      address_line: b.address
        ? [b.address.line1, b.address.line2, b.address.city, b.address.state].filter(Boolean).join(', ')
        : null,
      access_notes: b.address?.accessNotes ?? null,
      needs_acceptance: b.status === BookingStatus.PENDING,
      // Nested objects for detail view
      service: b.service ? { id: b.service.id, name: b.service.name } : null,
      package: b.package ? { id: b.package.id, name: b.package.name } : null,
      address: b.address
        ? {
            id: b.address.id,
            line1: b.address.line1,
            line2: b.address.line2,
            city: b.address.city,
            state: b.address.state,
            postal_code: b.address.postalCode,
            country: b.address.country,
            access_notes: b.address.accessNotes,
          }
        : null,
      customer: b.customer
        ? {
            id: b.customer.id,
            full_name: b.customer.user.fullName,
            email: b.customer.user.email,
            phone: b.customer.user.phone,
          }
        : null,
      technician: activeAssignment
        ? { id: activeAssignment.technicianId, full_name: activeAssignment.technician?.user?.fullName ?? null }
        : null,
      assignments: b.assignments,
      status_history: (b as BookingDetailRow).statusHistory?.map((h) => ({
        id: String(h.id),
        previous_status: h.previousStatus,
        new_status: h.newStatus,
        note: h.note,
        created_at: h.createdAt,
      })),
      priority: b.priority,
      created_at: b.createdAt,
      updated_at: b.updatedAt,
    };
  }

  private async createWarrantyIfApplicable(
    tx: Prisma.TransactionClient,
    booking: { id: string; serviceId: string | null },
  ): Promise<void> {
    if (!booking.serviceId) return;
    const service = await tx.service.findUnique({
      where: { id: booking.serviceId },
      select: { name: true, warrantyDays: true },
    });
    if (!service || service.warrantyDays <= 0) return;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + service.warrantyDays);
    await tx.serviceWarranty.upsert({
      where: { bookingId: booking.id },
      create: { bookingId: booking.id, serviceName: service.name, warrantyDays: service.warrantyDays, expiresAt },
      update: { expiresAt, isActive: true },
    });
  }
}
