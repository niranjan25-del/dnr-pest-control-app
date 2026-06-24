// src/modules/subscriptions/subscriptions.service.ts
//
// Subscription orchestration. Subscriptions are managed locally — status is set to ACTIVE
// immediately on creation without an external gateway subscription object. The first billing
// cycle triggers a Cashfree order for initial payment; subsequent billing is handled by
// processDueRenewals() (cron). Pause/resume/cancel/plan-change update only local DB.
// Reads are role-scoped; transitions validated against the state machine; actions audited.

import {
  BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { Prisma, SubscriptionStatus, UserRole } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { paginate } from 'src/common/utils/pagination.util';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { PlansService } from '../plans/plans.service';
import { RecurringBookingService } from './recurring-booking.service';
import {
  CancelSubscriptionDto, ChangePlanDto, CreateSubscriptionDto, SubscriptionFilterDto,
} from './dto';
import { isSubTransitionAllowed, nextCycleDate } from './enums';

const SUB_INCLUDE = {
  plan: { select: { id: true, name: true, price: true, billingCycle: true } },
} satisfies Prisma.SubscriptionInclude;

type SubRow = Prisma.SubscriptionGetPayload<{ include: typeof SUB_INCLUDE }>;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly recurring: RecurringBookingService,
  ) {}

  // ---------------- Create ----------------
  async create(actor: AuthenticatedUser, dto: CreateSubscriptionDto) {
    const customerId = await this.requireCustomerId(actor);
    const plan = await this.plans.requireActive(dto.planId);
    const addressId = await this.recurring.resolveAddressId(customerId, dto.addressId);
    const start = dto.startDate ? new Date(dto.startDate) : new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.create({
        data: {
          customerId, planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          startDate: start,
          nextBillingDate: nextCycleDate(start, plan.billingCycle),
          nextServiceDate: start,
        },
      });
      await this.recurring.generateVisit(tx, {
        subscription: sub, plan, addressId, scheduledStart: start, changedById: actor.id,
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id, action: 'subscription.created', entityType: 'subscription',
          entityId: sub.id, metadata: { planId: plan.id },
        },
      });
      return sub.id;
    });
    this.logger.log(`Subscription ${created} created for customer ${customerId} (plan ${plan.id})`);
    return this.findById(created, actor);
  }

  // ---------------- Pause / Resume ----------------
  async pause(id: string, actor: AuthenticatedUser, reason?: string) {
    const sub = await this.requireAccessible(id, actor);
    this.assertTransition(sub.status, SubscriptionStatus.PAUSED);
    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id }, data: { status: SubscriptionStatus.PAUSED, pausedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: { actorId: actor.id, action: 'subscription.paused', entityType: 'subscription', entityId: id, metadata: { reason } },
      }),
    ]);
    this.logger.log(`Subscription ${id} paused by ${actor.id}`);
    return this.findById(id, actor);
  }

  async resume(id: string, actor: AuthenticatedUser) {
    const sub = await this.requireAccessible(id, actor);
    this.assertTransition(sub.status, SubscriptionStatus.ACTIVE);
    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id }, data: { status: SubscriptionStatus.ACTIVE, pausedAt: null },
      }),
      this.prisma.auditLog.create({
        data: { actorId: actor.id, action: 'subscription.resumed', entityType: 'subscription', entityId: id },
      }),
    ]);
    this.logger.log(`Subscription ${id} resumed by ${actor.id}`);
    return this.findById(id, actor);
  }

  // ---------------- Cancel ----------------
  async cancel(id: string, actor: AuthenticatedUser, dto: CancelSubscriptionDto) {
    const sub = await this.requireAccessible(id, actor);
    this.assertTransition(sub.status, SubscriptionStatus.CANCELLED);
    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id }, data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: actor.id, action: 'subscription.cancelled', entityType: 'subscription', entityId: id,
          metadata: { reason: dto.reason, immediate: Boolean(dto.immediate) },
        },
      }),
    ]);
    this.logger.warn(`Subscription ${id} cancelled by ${actor.id}`);
    return this.findById(id, actor);
  }

  // ---------------- Upgrade / Downgrade ----------------
  async changePlan(id: string, actor: AuthenticatedUser, dto: ChangePlanDto) {
    const sub = await this.requireAccessible(id, actor);
    if (sub.status !== SubscriptionStatus.ACTIVE && sub.status !== SubscriptionStatus.PAUSED) {
      throw new BadRequestException({
        code: 'INVALID_SUBSCRIPTION_STATUS',
        message: `Cannot change the plan of a ${sub.status} subscription`,
      });
    }
    const newPlan = await this.plans.requireActive(dto.planId);
    if (newPlan.id === sub.planId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Already on this plan' });
    }
    const direction = Number(newPlan.price) >= Number(sub.plan.price) ? 'upgraded' : 'downgraded';
    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id },
        data: { planId: newPlan.id, nextBillingDate: nextCycleDate(new Date(), newPlan.billingCycle) },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: actor.id, action: `subscription.${direction}`, entityType: 'subscription', entityId: id,
          metadata: { from: sub.planId, to: newPlan.id },
        },
      }),
    ]);
    this.logger.log(`Subscription ${id} ${direction} to plan ${newPlan.id} by ${actor.id}`);
    return this.findById(id, actor);
  }

  // ---------------- Reads ----------------
  async findById(id: string, actor: AuthenticatedUser) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, deletedAt: null, ...(await this.scope(actor)) },
      include: SUB_INCLUDE,
    });
    if (!sub) throw new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' });
    return this.toResponse(sub);
  }

  async list(actor: AuthenticatedUser, filter: SubscriptionFilterDto) {
    const where: Prisma.SubscriptionWhereInput = {
      deletedAt: null,
      ...(await this.scope(actor)),
      ...(filter.status ? { status: filter.status } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        where, include: SUB_INCLUDE, orderBy: { createdAt: filter.order }, skip: filter.skip, take: filter.limit,
      }),
      this.prisma.subscription.count({ where }),
    ]);
    return paginate(rows.map((r) => this.toResponse(r)), total, filter.page, filter.limit);
  }

  // ================= helpers =================
  private assertTransition(from: SubscriptionStatus, to: SubscriptionStatus) {
    if (!isSubTransitionAllowed(from, to)) {
      throw new BadRequestException({
        code: 'INVALID_SUBSCRIPTION_STATUS',
        message: `Cannot move subscription ${from} → ${to}`,
      });
    }
  }

  private async requireCustomerId(actor: AuthenticatedUser): Promise<string> {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId: actor.id }, select: { id: true },
    });
    if (!profile) throw new BadRequestException({ code: 'PROFILE_NOT_FOUND', message: 'Customer profile required' });
    return profile.id;
  }

  private async requireAccessible(id: string, actor: AuthenticatedUser) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, deletedAt: null, ...(await this.scope(actor)) },
      include: SUB_INCLUDE,
    });
    if (!sub) throw new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' });
    return sub;
  }

  private async scope(actor: AuthenticatedUser): Promise<Prisma.SubscriptionWhereInput> {
    if (actor.role === UserRole.ADMIN) return {};
    if (actor.role === UserRole.CUSTOMER) {
      const p = await this.prisma.customerProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
      return { customerId: p?.id ?? '00000000-0000-0000-0000-000000000000' };
    }
    if (actor.role === UserRole.TECHNICIAN) {
      const p = await this.prisma.technicianProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
      return { bookings: { some: { assignments: { some: { technicianId: p?.id ?? '00000000-0000-0000-0000-000000000000' } } } } };
    }
    return { id: '00000000-0000-0000-0000-000000000000' };
  }

  private toResponse(s: SubRow) {
    return {
      id: s.id,
      status: s.status,
      plan: { id: s.plan.id, name: s.plan.name, price: Number(s.plan.price), billing_cycle: s.plan.billingCycle },
      start_date: s.startDate,
      next_billing_date: s.nextBillingDate,
      next_service_date: s.nextServiceDate,
      paused_at: s.pausedAt,
      cancelled_at: s.cancelledAt,
      created_at: s.createdAt,
    };
  }
}
