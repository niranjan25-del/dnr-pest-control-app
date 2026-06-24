// src/modules/promotions/coupons/coupon-validation.service.ts
//
// Coupon eligibility checks + the discount engine. `preview` returns a non-throwing result
// (so the validate endpoint can show a friendly reason); `assertRedeemable` throws the
// standardized error and is used on the redeem path. Anti-abuse: per-user limit + total usage
// limit, plus duplicate-per-booking prevention (enforced by the unique constraint at write).

import { BadRequestException, Injectable } from "@nestjs/common";
import { Coupon } from "@prisma/client";
import { PrismaService } from "src/database/prisma.service";
import { CouponDerivedStatus, computeDiscount, computeStatus } from "./enums";
import { DiscountContext, ValidationPreview } from "./interfaces";

@Injectable()
export class CouponValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async loadByCode(code: string): Promise<Coupon | null> {
    return this.prisma.coupon.findFirst({
      where: { code: code.toUpperCase(), deletedAt: null },
    });
  }

  /** Non-throwing validity + discount preview for the given context. */
  async preview(
    code: string,
    customerId: string,
    ctx: DiscountContext,
  ): Promise<ValidationPreview> {
    const coupon = await this.loadByCode(code);
    if (!coupon) return this.invalid(code, "Coupon not found");

    const status = computeStatus(coupon);
    if (status !== CouponDerivedStatus.ACTIVE) {
      return this.invalid(code, this.reasonFor(status));
    }
    if (await this.perUserExceeded(coupon, customerId)) {
      return this.invalid(
        code,
        "You have already used this coupon the maximum number of times",
      );
    }
    const discount = computeDiscount(
      coupon.discountType,
      Number(coupon.discountValue),
      ctx.base,
    );
    return {
      valid: true,
      code: coupon.code,
      discount_amount: discount,
      final_amount: Math.max(0, Math.round((ctx.base - discount) * 100) / 100),
    };
  }

  /** Throwing validation for redemption; returns the loaded coupon + computed discount. */
  async assertRedeemable(
    code: string,
    customerId: string,
    ctx: DiscountContext,
  ): Promise<{ coupon: Coupon; discount: number }> {
    const coupon = await this.loadByCode(code);
    if (!coupon)
      throw new BadRequestException({
        code: "INVALID_COUPON",
        message: "Coupon not found",
      });

    const status = computeStatus(coupon);
    if (status === CouponDerivedStatus.EXPIRED)
      throw new BadRequestException({
        code: "EXPIRED_COUPON",
        message: "Coupon has expired",
      });
    if (status === CouponDerivedStatus.EXHAUSTED)
      throw new BadRequestException({
        code: "USAGE_LIMIT_EXCEEDED",
        message: "Coupon usage limit reached",
      });
    if (status !== CouponDerivedStatus.ACTIVE)
      throw new BadRequestException({
        code: "INVALID_COUPON",
        message: this.reasonFor(status),
      });
    if (await this.perUserExceeded(coupon, customerId)) {
      throw new BadRequestException({
        code: "INELIGIBLE_USER",
        message: "Per-user usage limit reached",
      });
    }
    const discount = computeDiscount(
      coupon.discountType,
      Number(coupon.discountValue),
      ctx.base,
    );
    return { coupon, discount };
  }

  private async perUserExceeded(
    coupon: Coupon,
    customerId: string,
  ): Promise<boolean> {
    const used = await this.prisma.couponUsage.count({
      where: { couponId: coupon.id, customerId },
    });
    return used >= coupon.perUserLimit;
  }

  private reasonFor(status: CouponDerivedStatus): string {
    switch (status) {
      case CouponDerivedStatus.EXPIRED:
        return "Coupon has expired";
      case CouponDerivedStatus.DISABLED:
        return "Coupon is not active";
      case CouponDerivedStatus.EXHAUSTED:
        return "Coupon usage limit reached";
      case CouponDerivedStatus.SCHEDULED:
        return "Coupon is not yet valid";
      default:
        return "Coupon is not valid";
    }
  }

  private invalid(code: string, reason: string): ValidationPreview {
    return { valid: false, code, reason, discount_amount: 0, final_amount: 0 };
  }
}
