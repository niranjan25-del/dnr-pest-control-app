// src/modules/promotions/coupons/coupons.service.ts
//
// Coupon management + redemption. Redemption runs in a transaction: re-validate, create the
// CouponUsage (the @@unique([couponId,customerId,bookingId]) blocks duplicate redemption on
// the same booking), increment timesRedeemed, and — for a booking — write Booking.discountAmount
// (which the invoice/payment flow already consumes). Subscription discounts are recorded as
// usages and previewed, but NOT applied to Stripe billing (see flags). Actions are audited.

import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { DiscountType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { paginate } from 'src/common/utils/pagination.util';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { CouponValidationService } from './coupon-validation.service';
import {
  CouponFilterDto, CreateCouponDto, RedeemCouponDto, UpdateCouponDto, ValidateCouponDto,
} from './dto';
import { computeStatus } from './enums';
import { CampaignPerformance, DiscountContext, ValidationPreview } from './interfaces';

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: CouponValidationService,
  ) {}

  // ---------------- Admin CRUD ----------------
  async create(dto: CreateCouponDto, actorId: string) {
    if (dto.discountType === DiscountType.PERCENTAGE && dto.discountValue > 100) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Percentage discount cannot exceed 100' });
    }
    if (new Date(dto.validUntil) <= new Date(dto.validFrom)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'validUntil must be after validFrom' });
    }
    const exists = await this.prisma.coupon.findUnique({ where: { code: dto.code.toUpperCase() } });
    if (exists) throw new ConflictException({ code: 'COUPON_EXISTS', message: 'Coupon code already exists' });

    const coupon = await this.prisma.coupon.create({
      data: {
        code: dto.code.toUpperCase(), description: dto.description, discountType: dto.discountType,
        discountValue: dto.discountValue, validFrom: new Date(dto.validFrom), validUntil: new Date(dto.validUntil),
        maxRedemptions: dto.maxRedemptions, perUserLimit: dto.perUserLimit ?? 1, isActive: dto.isActive ?? true,
      },
    });
    await this.audit(actorId, 'coupon.created', coupon.id, { code: coupon.code });
    this.logger.log(`Coupon ${coupon.code} created by ${actorId}`);
    return this.toResponse(coupon);
  }

  async update(id: string, dto: UpdateCouponDto, actorId: string) {
    await this.ensure(id);
    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: {
        description: dto.description, discountType: dto.discountType, discountValue: dto.discountValue,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        maxRedemptions: dto.maxRedemptions, perUserLimit: dto.perUserLimit, isActive: dto.isActive,
      },
    });
    await this.audit(actorId, 'coupon.updated', id);
    return this.toResponse(coupon);
  }

  async setActive(id: string, isActive: boolean, actorId: string) {
    await this.ensure(id);
    const coupon = await this.prisma.coupon.update({ where: { id }, data: { isActive } });
    await this.audit(actorId, isActive ? 'coupon.activated' : 'coupon.deactivated', id);
    return this.toResponse(coupon);
  }

  async remove(id: string, actorId: string) {
    await this.ensure(id);
    await this.prisma.coupon.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    await this.audit(actorId, 'coupon.deleted', id);
    return { success: true };
  }

  async findOne(id: string) {
    const coupon = await this.prisma.coupon.findFirst({ where: { id, deletedAt: null } });
    if (!coupon) throw new NotFoundException({ code: 'INVALID_COUPON', message: 'Coupon not found' });
    return this.toResponse(coupon);
  }

  async list(filter: CouponFilterDto) {
    const where: Prisma.CouponWhereInput = {
      deletedAt: null,
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter.search ? { code: { contains: filter.search.toUpperCase() } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.coupon.findMany({ where, orderBy: { createdAt: filter.order }, skip: filter.skip, take: filter.limit }),
      this.prisma.coupon.count({ where }),
    ]);
    return paginate(rows.map((r) => this.toResponse(r)), total, filter.page, filter.limit);
  }

  // ---------------- Validate (preview) ----------------
  async validate(actor: AuthenticatedUser, dto: ValidateCouponDto): Promise<ValidationPreview> {
    const customerId = await this.resolveCustomerId(actor);
    const ctx = await this.resolveContext(dto, customerId);
    return this.validation.preview(dto.code, customerId, ctx);
  }

  // ---------------- Redeem ----------------
  async redeem(actor: AuthenticatedUser, dto: RedeemCouponDto) {
    const customerId = await this.resolveCustomerId(actor);
    const ctx = await this.resolveContext(dto, customerId);

    // Prevent stacking: a booking may carry only one coupon.
    if (ctx.bookingId) {
      const existing = await this.prisma.couponUsage.findFirst({ where: { bookingId: ctx.bookingId } });
      if (existing) throw new ConflictException({ code: 'USAGE_LIMIT_EXCEEDED', message: 'A coupon is already applied to this booking' });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const { coupon, discount } = await this.validation.assertRedeemable(dto.code, customerId, ctx);

      const usage = await tx.couponUsage.create({
        data: { couponId: coupon.id, customerId, bookingId: ctx.bookingId, discountApplied: discount },
      });
      await tx.coupon.update({ where: { id: coupon.id }, data: { timesRedeemed: { increment: 1 } } });

      // Apply to the booking (feeds the invoice/payment discount).
      if (ctx.bookingId) {
        await tx.booking.update({ where: { id: ctx.bookingId }, data: { discountAmount: discount } });
      }
      await tx.auditLog.create({
        data: { actorId: actor.id, action: 'coupon.redeemed', entityType: 'coupon', entityId: coupon.id,
          metadata: { usageId: usage.id, bookingId: ctx.bookingId, subscriptionId: ctx.subscriptionId, discount } },
      });
      return { code: coupon.code, discount_amount: discount, final_amount: Math.max(0, ctx.base - discount) };
    });

    this.logger.log(`Coupon ${result.code} redeemed by customer ${customerId} (discount ${result.discount_amount})`);
    return result;
  }

  // ---------------- Campaign performance ----------------
  async performance(id: string): Promise<CampaignPerformance> {
    const coupon = await this.prisma.coupon.findFirst({ where: { id, deletedAt: null } });
    if (!coupon) throw new NotFoundException({ code: 'INVALID_COUPON', message: 'Coupon not found' });
    const [agg, distinct] = await this.prisma.$transaction([
      this.prisma.couponUsage.aggregate({ where: { couponId: id }, _sum: { discountApplied: true }, _count: true }),
      this.prisma.couponUsage.findMany({ where: { couponId: id }, distinct: ['customerId'], select: { customerId: true } }),
    ]);
    return {
      coupon_id: id, code: coupon.code,
      redemptions: agg._count, unique_customers: distinct.length,
      total_discount: Number(agg._sum.discountApplied ?? 0),
    };
    // ⚠ Conversion metrics (views→redemptions) need impression tracking, which isn't modeled.
  }

  // ================= helpers =================
  private async resolveContext(dto: ValidateCouponDto, customerId: string): Promise<DiscountContext> {
    if (dto.bookingId) {
      const booking = await this.prisma.booking.findFirst({ where: { id: dto.bookingId, customerId, deletedAt: null }, select: { id: true, price: true } });
      if (!booking) throw new BadRequestException({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found for this customer' });
      return { base: Number(booking.price), bookingId: booking.id };
    }
    if (dto.subscriptionId) {
      const sub = await this.prisma.subscription.findFirst({
        where: { id: dto.subscriptionId, customerId, deletedAt: null },
        select: { id: true, plan: { select: { price: true } } },
      });
      if (!sub) throw new BadRequestException({ code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found for this customer' });
      // NOTE: discount is previewed/recorded but NOT pushed to Stripe billing (no schema field
      // / Stripe coupon integration) — flagged.
      return { base: Number(sub.plan.price), subscriptionId: sub.id };
    }
    // Pre-booking preview: caller passes the known price directly.
    if (dto.amount !== undefined && dto.amount >= 0) {
      return { base: dto.amount };
    }
    return { base: 0 };
  }

  private async resolveCustomerId(actor: AuthenticatedUser): Promise<string> {
    const p = await this.prisma.customerProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
    if (!p) {
      if (actor.role === UserRole.ADMIN) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Admins redeem on behalf via booking flows' });
      throw new BadRequestException({ code: 'PROFILE_NOT_FOUND', message: 'Customer profile required' });
    }
    return p.id;
  }

  private async ensure(id: string) {
    const exists = await this.prisma.coupon.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!exists) throw new NotFoundException({ code: 'INVALID_COUPON', message: 'Coupon not found' });
  }

  private audit(actorId: string, action: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    return this.prisma.auditLog.create({ data: { actorId, action, entityType: 'coupon', entityId, metadata } });
  }

  private toResponse(c: {
    id: string; code: string; description: string | null; discountType: DiscountType; discountValue: Prisma.Decimal;
    maxRedemptions: number | null; perUserLimit: number; timesRedeemed: number; validFrom: Date; validUntil: Date;
    isActive: boolean; createdAt: Date; updatedAt: Date;
  }) {
    return {
      id: c.id, code: c.code, description: c.description,
      discount_type: c.discountType, discount_value: Number(c.discountValue),
      max_redemptions: c.maxRedemptions, per_user_limit: c.perUserLimit, times_redeemed: c.timesRedeemed,
      valid_from: c.validFrom, valid_until: c.validUntil, is_active: c.isActive,
      status: computeStatus(c),
      created_at: c.createdAt, updated_at: c.updatedAt,
    };
  }
}
