// src/modules/technician-assignment/technician-assignment.service.ts
//
// Dispatch orchestration. Assign/reassign/accept/reject/cancel run in transactions and write
// assignment-status history (via AuditLog) atomically. Accepting an assignment confirms the
// booking (PENDING → CONFIRMED) through the Step-6 BookingStatusService. Reads are scoped:
// customers see assignments on their bookings, technicians their own, admins all.

import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { AssignmentStatus, BookingStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { paginate } from 'src/common/utils/pagination.util';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { BookingStatusService } from '../bookings/booking-status.service';
import { AssignmentEngineService } from './assignment-engine.service';
import { TechnicianAvailabilityService } from './availability.service';
import { WorkloadService } from './workload.service';
import {
  AssignmentFilterDto, AssignTechnicianDto, ReassignTechnicianDto, TechnicianAvailabilityDto,
} from './dto';
import { ACTIVE_ASSIGNMENT_STATUSES, isAssignmentTransitionAllowed } from './enums';

const ASSIGNMENT_INCLUDE = {
  technician: { select: { id: true, user: { select: { fullName: true, phone: true } } } },
  booking: {
    select: { id: true, status: true, scheduledWindowStart: true, scheduledWindowEnd: true, customerId: true },
  },
} satisfies Prisma.TechnicianAssignmentInclude;

@Injectable()
export class TechnicianAssignmentService {
  private readonly logger = new Logger(TechnicianAssignmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: AssignmentEngineService,
    private readonly availability: TechnicianAvailabilityService,
    private readonly workload: WorkloadService,
    private readonly bookingStatus: BookingStatusService,
  ) {}

  // ---------------- Assign (manual or auto) ----------------
  async assign(actor: AuthenticatedUser, dto: AssignTechnicianDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, deletedAt: null },
      select: { id: true, status: true, scheduledWindowStart: true, scheduledWindowEnd: true },
    });
    if (!booking) throw new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });

    // Reject if there's already a live assignment (use reassign instead).
    const active = await this.prisma.technicianAssignment.findFirst({
      where: { bookingId: booking.id, status: { in: ACTIVE_ASSIGNMENT_STATUSES } }, select: { id: true },
    });
    if (active) throw new ConflictException({ code: 'ASSIGNMENT_CONFLICT', message: 'Booking already has an active assignment' });

    const technicianId = await this.resolveTechnician(dto, booking.id);
    const window = { start: booking.scheduledWindowStart, end: booking.scheduledWindowEnd };
    if (!dto.overrideConstraints) await this.availability.assertAvailable(technicianId, window);

    const created = await this.prisma.$transaction(async (tx) => {
      const a = await tx.technicianAssignment.create({
        data: {
          bookingId: booking.id, technicianId, status: AssignmentStatus.ASSIGNED,
          assignedById: actor.id, reason: dto.reason,
        },
      });
      await this.audit(tx, actor.id, 'assignment.created', a.id, { bookingId: booking.id, technicianId });
      return a.id;
    });
    this.logger.log(`Assignment ${created} created for booking ${booking.id} → tech ${technicianId} by ${actor.id}`);
    return this.findById(created, actor);
  }

  // ---------------- Reassign ----------------
  async reassign(id: string, actor: AuthenticatedUser, dto: ReassignTechnicianDto) {
    const current = await this.prisma.technicianAssignment.findUnique({ where: { id }, include: ASSIGNMENT_INCLUDE });
    if (!current) throw new NotFoundException({ code: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found' });
    if (!ACTIVE_ASSIGNMENT_STATUSES.includes(current.status)) {
      throw new BadRequestException({ code: 'INVALID_ASSIGNMENT_STATUS', message: `Cannot reassign a ${current.status} assignment` });
    }

    const newTechId = await this.resolveTechnician(
      { bookingId: current.bookingId, technicianId: dto.technicianId, auto: dto.auto },
      current.bookingId,
      current.technicianId,
    );
    const window = { start: current.booking.scheduledWindowStart, end: current.booking.scheduledWindowEnd };
    if (!dto.overrideConstraints) await this.availability.assertAvailable(newTechId, window);

    const newId = await this.prisma.$transaction(async (tx) => {
      this.assertTransition(current.status, AssignmentStatus.REASSIGNED);
      await tx.technicianAssignment.update({
        where: { id }, data: { status: AssignmentStatus.REASSIGNED, reason: dto.reason, respondedAt: new Date() },
      });
      const next = await tx.technicianAssignment.create({
        data: {
          bookingId: current.bookingId, technicianId: newTechId, status: AssignmentStatus.ASSIGNED,
          assignedById: actor.id, reason: dto.reason,
        },
      });
      await this.audit(tx, actor.id, 'assignment.reassigned', next.id,
        { from: current.technicianId, to: newTechId, previousAssignmentId: id });
      return next.id;
    });
    this.logger.log(`Assignment ${id} reassigned → ${newId} (tech ${newTechId}) by ${actor.id}`);
    return this.findById(newId, actor);
  }

  // ---------------- Accept (technician) ----------------
  async accept(id: string, actor: AuthenticatedUser) {
    const assignment = await this.requireOwnTechnician(id, actor);
    this.assertTransition(assignment.status, AssignmentStatus.ACCEPTED);

    await this.prisma.$transaction(async (tx) => {
      await tx.technicianAssignment.update({
        where: { id }, data: { status: AssignmentStatus.ACCEPTED, respondedAt: new Date() },
      });
      // Confirm the booking if still pending (uses the Step-6 state machine).
      if (assignment.booking.status === BookingStatus.PENDING) {
        await this.bookingStatus.transition(tx, {
          bookingId: assignment.bookingId, current: BookingStatus.PENDING, next: BookingStatus.CONFIRMED,
          changedById: actor.id, note: 'Assignment accepted',
        });
      }
      await this.audit(tx, actor.id, 'assignment.accepted', id, { bookingId: assignment.bookingId });
    });
    this.logger.log(`Assignment ${id} accepted by tech (user ${actor.id})`);
    return this.findById(id, actor);
  }

  // ---------------- Reject (technician) ----------------
  async reject(id: string, actor: AuthenticatedUser, reason?: string) {
    const assignment = await this.requireOwnTechnician(id, actor);
    this.assertTransition(assignment.status, AssignmentStatus.DECLINED);

    await this.prisma.$transaction(async (tx) => {
      await tx.technicianAssignment.update({
        where: { id }, data: { status: AssignmentStatus.DECLINED, reason, respondedAt: new Date() },
      });
      await this.audit(tx, actor.id, 'assignment.rejected', id, { bookingId: assignment.bookingId, reason });
    });
    this.logger.warn(`Assignment ${id} rejected by tech (user ${actor.id})`);
    return this.findById(id, actor);
  }

  // ---------------- Remove / cancel (admin) ----------------
  async cancel(id: string, actor: AuthenticatedUser) {
    const assignment = await this.prisma.technicianAssignment.findUnique({ where: { id } });
    if (!assignment) throw new NotFoundException({ code: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found' });
    this.assertTransition(assignment.status, AssignmentStatus.CANCELLED);
    await this.prisma.$transaction(async (tx) => {
      await tx.technicianAssignment.update({ where: { id }, data: { status: AssignmentStatus.CANCELLED, respondedAt: new Date() } });
      await this.audit(tx, actor.id, 'assignment.cancelled', id, { bookingId: assignment.bookingId });
    });
    return { success: true };
  }

  // ---------------- Reads ----------------
  async findById(id: string, actor: AuthenticatedUser) {
    const a = await this.prisma.technicianAssignment.findFirst({
      where: { id, ...(await this.scope(actor)) }, include: ASSIGNMENT_INCLUDE,
    });
    if (!a) throw new NotFoundException({ code: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found' });
    return this.toResponse(a);
  }

  async list(actor: AuthenticatedUser, filter: AssignmentFilterDto) {
    const where: Prisma.TechnicianAssignmentWhereInput = {
      ...(await this.scope(actor)),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.technicianId ? { technicianId: filter.technicianId } : {}),
      ...(filter.bookingId ? { bookingId: filter.bookingId } : {}),
      ...(filter.dateFrom || filter.dateTo
        ? { booking: { scheduledWindowStart: {
            ...(filter.dateFrom ? { gte: new Date(filter.dateFrom) } : {}),
            ...(filter.dateTo ? { lte: new Date(filter.dateTo) } : {}),
          } } }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.technicianAssignment.findMany({
        where, include: ASSIGNMENT_INCLUDE, orderBy: { createdAt: filter.order }, skip: filter.skip, take: filter.limit,
      }),
      this.prisma.technicianAssignment.count({ where }),
    ]);
    return paginate(rows.map((r) => this.toResponse(r)), total, filter.page, filter.limit);
  }

  // ---------------- Dispatch dashboard (admin) ----------------
  async unassignedBookings(filter: AssignmentFilterDto) {
    const where: Prisma.BookingWhereInput = {
      deletedAt: null,
      status: BookingStatus.PENDING,
      assignments: { none: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } } },
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        select: {
          id: true, status: true, scheduledWindowStart: true, scheduledWindowEnd: true,
          service: { select: { name: true } },
          address: { select: { city: true, postalCode: true } },
          customer: { select: { user: { select: { fullName: true } } } },
        },
        orderBy: { scheduledWindowStart: 'asc' }, skip: filter.skip, take: filter.limit,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return paginate(rows, total, filter.page, filter.limit);
  }

  workloads() {
    return this.workload.summaries();
  }

  async availableTechnicians(bookingId?: string) {
    if (bookingId) return this.engine.rankCandidates(bookingId); // ranked for a specific booking
    return (await this.workload.summaries()).filter((w) => w.isAvailable && w.dailyCapacityRemaining > 0);
  }

  // ---------------- Technician self availability (additive) ----------------
  async setOwnAvailability(actor: AuthenticatedUser, dto: TechnicianAvailabilityDto) {
    const profile = await this.prisma.technicianProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
    if (!profile) throw new BadRequestException({ code: 'PROFILE_NOT_FOUND', message: 'Technician profile not found' });
    await this.prisma.technicianProfile.update({ where: { id: profile.id }, data: { isAvailable: dto.isAvailable } });
    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: 'technician.availability_changed', entityType: 'technician_profile',
        entityId: profile.id, metadata: { isAvailable: dto.isAvailable } },
    });
    this.logger.log(`Technician ${profile.id} availability → ${dto.isAvailable}`);
    return { success: true, is_available: dto.isAvailable };
  }

  // ================= helpers =================
  private assertTransition(from: AssignmentStatus, to: AssignmentStatus) {
    if (!isAssignmentTransitionAllowed(from, to)) {
      throw new BadRequestException({ code: 'INVALID_ASSIGNMENT_STATUS', message: `Cannot move assignment ${from} → ${to}` });
    }
  }

  private async resolveTechnician(
    dto: { bookingId: string; technicianId?: string; auto?: boolean },
    bookingId: string,
    excludeTechnicianId?: string,
  ): Promise<string> {
    if (dto.technicianId && !dto.auto) return dto.technicianId;
    const best = await this.engine.pickBest(bookingId, excludeTechnicianId);
    return best.technicianId;
  }

  private async requireOwnTechnician(id: string, actor: AuthenticatedUser) {
    const assignment = await this.prisma.technicianAssignment.findUnique({ where: { id }, include: ASSIGNMENT_INCLUDE });
    if (!assignment) throw new NotFoundException({ code: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found' });
    if (actor.role !== UserRole.ADMIN) {
      const profile = await this.prisma.technicianProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
      if (!profile || profile.id !== assignment.technicianId) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your assignment' });
      }
    }
    return assignment;
  }

  private async scope(actor: AuthenticatedUser): Promise<Prisma.TechnicianAssignmentWhereInput> {
    if (actor.role === UserRole.ADMIN) return {};
    if (actor.role === UserRole.TECHNICIAN) {
      const p = await this.prisma.technicianProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
      return { technicianId: p?.id ?? '00000000-0000-0000-0000-000000000000' };
    }
    if (actor.role === UserRole.CUSTOMER) {
      const p = await this.prisma.customerProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
      return { booking: { customerId: p?.id ?? '00000000-0000-0000-0000-000000000000' } };
    }
    return { id: '00000000-0000-0000-0000-000000000000' };
  }

  private audit(tx: Prisma.TransactionClient, actorId: string, action: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    return tx.auditLog.create({ data: { actorId, action, entityType: 'technician_assignment', entityId, metadata } });
  }

  private toResponse(a: Prisma.TechnicianAssignmentGetPayload<{ include: typeof ASSIGNMENT_INCLUDE }>) {
    return {
      id: a.id,
      status: a.status,
      reason: a.reason,
      responded_at: a.respondedAt,
      technician: { id: a.technicianId, name: a.technician.user.fullName, phone: a.technician.user.phone },
      booking: {
        id: a.bookingId, status: a.booking.status,
        scheduled_start: a.booking.scheduledWindowStart, scheduled_end: a.booking.scheduledWindowEnd,
      },
      created_at: a.createdAt,
      updated_at: a.updatedAt,
    };
  }
}
