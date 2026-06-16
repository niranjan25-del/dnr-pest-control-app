// src/modules/location/location.service.ts
//
// Location orchestration. Technicians manage their own location (start/stop/update, check-in/
// out); customers view the technician tracking their assigned booking; admins see all. Updates
// persist a TechnicianLocation fix, update the live session, run geofence proximity detection,
// and broadcast over the socket. Check-in/out validate GPS against the job address and drive
// the booking state machine (ARRIVED/COMPLETED) — there are no dedicated check-in columns.

import {
  BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, forwardRef,
} from '@nestjs/common';
import { BookingStatus, NotificationType, UserRole } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { BookingStatusService } from '../bookings/booking-status.service';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { TrackingService } from './tracking.service';
import { RouteService } from './route.service';
import { GeofenceService } from './geofence.service';
import { EtaService } from './eta.service';
import { LocationGateway } from './location.gateway';
import { CheckInDto, CheckOutDto, StartTrackingDto, TrackingFilterDto, UpdateLocationDto } from './dto';
import {
  CHECK_IN_RADIUS_M, GEOFENCE_ARRIVAL_RADIUS_M, LocationEvent, TechnicianTrackingStatus,
} from './enums';
import { EtaResult, TrackingSnapshot } from './interfaces';

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tracking: TrackingService,
    private readonly route: RouteService,
    private readonly geofence: GeofenceService,
    private readonly eta: EtaService,
    private readonly bookingStatus: BookingStatusService,
    private readonly dispatcher: NotificationDispatcherService,
    @Inject(forwardRef(() => LocationGateway)) private readonly gateway: LocationGateway,
  ) {}

  // ---------------- Tracking session ----------------
  async startTracking(actor: AuthenticatedUser, dto: StartTrackingDto) {
    const technicianId = await this.requireTechnician(actor);
    if (dto.bookingId) await this.assertAssigned(technicianId, dto.bookingId);
    const session = this.tracking.start(technicianId, dto.bookingId);
    this.gateway.broadcastStatus(technicianId, LocationEvent.ONLINE, { status: session.status, bookingId: dto.bookingId ?? null });
    await this.audit(actor.id, 'tracking.started', technicianId, { bookingId: dto.bookingId });
    this.logger.log(`Tracking started for technician ${technicianId}`);
    return { status: session.status };
  }

  async stopTracking(actor: AuthenticatedUser) {
    const technicianId = await this.requireTechnician(actor);
    this.tracking.stop(technicianId);
    this.gateway.broadcastStatus(technicianId, LocationEvent.OFFLINE, { status: TechnicianTrackingStatus.OFFLINE });
    await this.audit(actor.id, 'tracking.stopped', technicianId);
    return { status: TechnicianTrackingStatus.OFFLINE };
  }

  // ---------------- Location update ----------------
  async updateLocation(actor: AuthenticatedUser, dto: UpdateLocationDto) {
    const technicianId = await this.requireTechnician(actor);
    const recordedAt = new Date();
    if (dto.bookingId) await this.assertAssigned(technicianId, dto.bookingId);

    await this.route.record(this.prisma, { technicianId, bookingId: dto.bookingId, latitude: dto.latitude, longitude: dto.longitude, accuracy: dto.accuracy });
    const session = this.tracking.updatePosition(technicianId, { latitude: dto.latitude, longitude: dto.longitude, accuracy: dto.accuracy, recordedAt });

    // Geofence proximity → soft ARRIVED signal (booking status still requires explicit check-in).
    if (dto.bookingId) {
      const arrived = await this.detectArrival(technicianId, dto.bookingId, { latitude: dto.latitude, longitude: dto.longitude });
      if (arrived && !session.arrivedNotified) {
        this.tracking.setStatus(technicianId, TechnicianTrackingStatus.ARRIVED);
        this.tracking.markArrivedNotified(technicianId);
        this.gateway.broadcastToBooking(dto.bookingId, LocationEvent.ARRIVED, { technicianId });
        await this.notifyCustomer(dto.bookingId, 'Technician nearby', 'Your technician is arriving now.');
      }
    }

    this.gateway.broadcastLocation(technicianId, dto.bookingId ?? null, { latitude: dto.latitude, longitude: dto.longitude, accuracy: dto.accuracy, recordedAt });
    return { ok: true, status: this.tracking.get(technicianId)?.status };
  }

  // ---------------- Check-in ----------------
  async checkIn(actor: AuthenticatedUser, dto: CheckInDto) {
    const technicianId = await this.requireTechnician(actor);
    const booking = await this.loadAssignedBooking(technicianId, dto.bookingId);

    const center = this.geofence.centerFromAddress(booking.address);
    if (center) {
      const dist = this.geofence.distanceMeters({ latitude: dto.latitude, longitude: dto.longitude }, center);
      if (dist > CHECK_IN_RADIUS_M) {
        throw new BadRequestException({ code: 'CHECK_IN_OUTSIDE_RADIUS', message: `You are ${Math.round(dist)}m from the job site (limit ${CHECK_IN_RADIUS_M}m)` });
      }
    } else {
      this.logger.warn(`Booking ${dto.bookingId} address has no coordinates — skipping check-in radius check`);
    }

    await this.prisma.$transaction(async (tx) => {
      await this.bookingStatus.transition(tx, { bookingId: booking.id, current: booking.status, next: BookingStatus.ARRIVED, changedById: actor.id, note: 'GPS check-in' });
      await this.route.record(tx, { technicianId, bookingId: booking.id, latitude: dto.latitude, longitude: dto.longitude });
    });
    this.tracking.setStatus(technicianId, TechnicianTrackingStatus.ARRIVED);
    this.gateway.broadcastToBooking(booking.id, LocationEvent.ARRIVED, { technicianId });
    await this.notifyCustomer(booking.id, 'Technician arrived', 'Your technician has arrived for your service.');
    this.logger.log(`Technician ${technicianId} checked in to booking ${booking.id}`);
    return { status: TechnicianTrackingStatus.ARRIVED };
  }

  // ---------------- Check-out ----------------
  async checkOut(actor: AuthenticatedUser, dto: CheckOutDto) {
    const technicianId = await this.requireTechnician(actor);
    const booking = await this.loadAssignedBooking(technicianId, dto.bookingId);

    await this.prisma.$transaction(async (tx) => {
      await this.bookingStatus.transition(tx, { bookingId: booking.id, current: booking.status, next: BookingStatus.COMPLETED, changedById: actor.id, note: dto.notes ?? 'GPS check-out' });
      if (dto.latitude != null && dto.longitude != null) {
        await this.route.record(tx, { technicianId, bookingId: booking.id, latitude: dto.latitude, longitude: dto.longitude });
      }
    });
    this.tracking.setStatus(technicianId, TechnicianTrackingStatus.COMPLETED);
    this.gateway.broadcastToBooking(booking.id, LocationEvent.COMPLETED, { technicianId });
    await this.notifyCustomerCompleted(booking.id);
    this.logger.log(`Technician ${technicianId} checked out of booking ${booking.id}`);
    return { status: TechnicianTrackingStatus.COMPLETED };
  }

  // ---------------- Customer / admin views ----------------
  async getCurrent(actor: AuthenticatedUser, technicianId: string): Promise<TrackingSnapshot> {
    await this.assertCanView(actor, technicianId);
    const session = this.tracking.get(technicianId);
    const position = session?.position ?? (await this.route.lastKnown(technicianId).then((r) => r && { latitude: r.latitude, longitude: r.longitude, accuracy: r.accuracy, recordedAt: r.recorded_at }));
    return {
      technician_id: technicianId,
      status: session?.status ?? TechnicianTrackingStatus.OFFLINE,
      position: position ?? null,
      booking_id: session?.bookingId ?? null,
      updated_at: session?.updatedAt ?? null,
    };
  }

  async getHistory(actor: AuthenticatedUser, technicianId: string, filter: TrackingFilterDto) {
    // History is privacy-sensitive: technician (self) or admin only.
    const selfTechId = actor.role === UserRole.TECHNICIAN ? await this.resolveTechnicianId(actor) : null;
    if (actor.role !== UserRole.ADMIN && selfTechId !== technicianId) {
      throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'Not authorized to view this location history' });
    }
    return this.route.history(technicianId, filter);
  }

  async getEta(actor: AuthenticatedUser, bookingId: string): Promise<EtaResult & { booking_id: string }> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      include: { address: { select: { latitude: true, longitude: true } }, assignments: { select: { technicianId: true }, take: 1, orderBy: { createdAt: 'desc' } } },
    });
    if (!booking) throw new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
    await this.assertCanViewBooking(actor, bookingId);

    const technicianId = booking.assignments[0]?.technicianId;
    if (!technicianId) throw new BadRequestException({ code: 'TRACKING_NOT_ACTIVE', message: 'No technician assigned yet' });
    const session = this.tracking.get(technicianId);
    const origin = session?.position ?? (await this.route.lastKnown(technicianId).then((r) => r && { latitude: r.latitude, longitude: r.longitude }));
    if (!origin) throw new BadRequestException({ code: 'TRACKING_NOT_ACTIVE', message: 'Technician location is not available' });
    const dest = this.geofence.centerFromAddress(booking.address);
    if (!dest) throw new BadRequestException({ code: 'INVALID_COORDINATES', message: 'Job address has no coordinates' });

    const result = await this.eta.estimate(origin, dest);
    return { booking_id: bookingId, ...result };
  }

  // ================= helpers =================
  private async detectArrival(technicianId: string, bookingId: string, point: { latitude: number; longitude: number }): Promise<boolean> {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { address: { select: { latitude: true, longitude: true } } } });
    const center = this.geofence.centerFromAddress(booking?.address ?? null);
    return center ? this.geofence.isWithin(point, center, GEOFENCE_ARRIVAL_RADIUS_M) : false;
  }

  private async loadAssignedBooking(technicianId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null, assignments: { some: { technicianId } } },
      include: { address: { select: { latitude: true, longitude: true } } },
    });
    if (!booking) throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'Booking is not assigned to you' });
    return booking;
  }

  private async assertAssigned(technicianId: string, bookingId: string) {
    const a = await this.prisma.technicianAssignment.findFirst({ where: { bookingId, technicianId }, select: { id: true } });
    if (!a) throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'Booking is not assigned to you' });
  }

  private async assertCanView(actor: AuthenticatedUser, technicianId: string) {
    if (actor.role === UserRole.ADMIN) return;
    if (actor.role === UserRole.TECHNICIAN && (await this.resolveTechnicianId(actor)) === technicianId) return;
    if (actor.role === UserRole.CUSTOMER) {
      const cp = await this.prisma.customerProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
      const linked = cp && await this.prisma.booking.findFirst({
        where: { customerId: cp.id, deletedAt: null, status: { in: [BookingStatus.CONFIRMED, BookingStatus.EN_ROUTE, BookingStatus.ARRIVED, BookingStatus.IN_PROGRESS] }, assignments: { some: { technicianId } } },
        select: { id: true },
      });
      if (linked) return;
    }
    throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'Not authorized to view this technician' });
  }

  private async assertCanViewBooking(actor: AuthenticatedUser, bookingId: string) {
    if (actor.role === UserRole.ADMIN) return;
    if (actor.role === UserRole.CUSTOMER) {
      const cp = await this.prisma.customerProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
      const own = cp && await this.prisma.booking.findFirst({ where: { id: bookingId, customerId: cp.id }, select: { id: true } });
      if (own) return;
    }
    if (actor.role === UserRole.TECHNICIAN) {
      const techId = await this.resolveTechnicianId(actor);
      if (techId) { await this.assertAssigned(techId, bookingId); return; }
    }
    throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'Not authorized for this booking' });
  }

  private async requireTechnician(actor: AuthenticatedUser): Promise<string> {
    if (actor.role !== UserRole.TECHNICIAN && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'Only technicians can share location' });
    }
    const id = await this.resolveTechnicianId(actor);
    if (!id) throw new NotFoundException({ code: 'TECHNICIAN_NOT_FOUND', message: 'Technician profile not found' });
    return id;
  }

  private async resolveTechnicianId(actor: AuthenticatedUser): Promise<string | null> {
    const p = await this.prisma.technicianProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
    return p?.id ?? null;
  }

  private async notifyCustomer(bookingId: string, title: string, body: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { customer: { select: { userId: true } } } });
    if (booking?.customer?.userId) {
      await this.dispatcher.dispatch(booking.customer.userId, { type: NotificationType.BOOKING, title, body, data: { bookingId } });
    }
  }

  private async notifyCustomerCompleted(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { customer: { select: { userId: true } } } });
    if (booking?.customer?.userId) await this.dispatcher.onBookingCompleted(bookingId, booking.customer.userId);
  }

  private audit(actorId: string, action: string, entityId: string, metadata?: Record<string, unknown>) {
    return this.prisma.auditLog.create({ data: { actorId, action, entityType: 'technician_location', entityId, metadata: (metadata ?? undefined) as never } });
  }
}
