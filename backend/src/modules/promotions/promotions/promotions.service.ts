// src/modules/promotions/promotions/promotions.service.ts
//
// Promotions = a management + customer-facing view over coupons (no dedicated Promotion model
// in the schema). Customers see currently-valid coupons as "active promotions"; admins manage
// campaigns by delegating to CouponsService. Campaign performance reuses the coupon analytics.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { CreatePromotionDto, UpdatePromotionDto } from './dto';

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly coupons: CouponsService,
  ) {}

  /** Customer-facing: coupons that are active and valid right now, presented as promotions. */
  async listActive() {
    const now = new Date();
    const rows = await this.prisma.coupon.findMany({
      where: { deletedAt: null, isActive: true, validFrom: { lte: now }, validUntil: { gte: now } },
      orderBy: { validUntil: 'asc' },
    });
    return rows
      .filter((c) => c.maxRedemptions == null || c.timesRedeemed < c.maxRedemptions)
      .map((c) => ({
        id: c.id,
        code: c.code,
        description: c.description,
        discount_type: c.discountType,
        discount_value: Number(c.discountValue),
        valid_until: c.validUntil,
      }));
  }

  // ---- Admin campaign management (delegates to coupons) ----
  create(dto: CreatePromotionDto, actorId: string) {
    this.logger.log(`Promotion campaign "${dto.name}" created by ${actorId}`);
    return this.coupons.create(
      {
        code: dto.code,
        description: dto.description ? `${dto.name} — ${dto.description}` : dto.name,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        validFrom: dto.validFrom,
        validUntil: dto.validUntil,
        maxRedemptions: dto.usageLimit,
        perUserLimit: dto.perUserLimit,
        isActive: true,
      },
      actorId,
    );
  }

  update(id: string, dto: UpdatePromotionDto, actorId: string) {
    return this.coupons.update(id, {
      description: dto.description, discountValue: dto.discountValue,
      validFrom: dto.validFrom, validUntil: dto.validUntil,
      maxRedemptions: dto.usageLimit, perUserLimit: dto.perUserLimit,
    }, actorId);
  }

  setActive(id: string, isActive: boolean, actorId: string) {
    return this.coupons.setActive(id, isActive, actorId);
  }

  remove(id: string, actorId: string) {
    return this.coupons.remove(id, actorId);
  }

  performance(id: string) {
    return this.coupons.performance(id);
  }
}
