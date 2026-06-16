// src/modules/promotions/coupons/enums/index.ts
//
// Derived coupon status + the discount calculation engine.
//
// NOTE (schema reconciliation): coupon "status" (Active/Expired/Disabled/Exhausted) is not a
// stored column — it's DERIVED from isActive + validFrom/validUntil + maxRedemptions/
// timesRedeemed. DiscountType is only {PERCENTAGE, FIXED}; a "Free Service" promotion is a
// 100% PERCENTAGE coupon (no FREE_SERVICE enum value).

import { DiscountType } from '@prisma/client';

export enum CouponDerivedStatus {
  ACTIVE = 'ACTIVE',
  SCHEDULED = 'SCHEDULED',
  EXPIRED = 'EXPIRED',
  DISABLED = 'DISABLED',
  EXHAUSTED = 'EXHAUSTED',
}

export function computeStatus(c: {
  isActive: boolean; validFrom: Date; validUntil: Date; maxRedemptions: number | null; timesRedeemed: number;
}, now = new Date()): CouponDerivedStatus {
  if (!c.isActive) return CouponDerivedStatus.DISABLED;
  if (now > c.validUntil) return CouponDerivedStatus.EXPIRED;
  if (c.maxRedemptions != null && c.timesRedeemed >= c.maxRedemptions) return CouponDerivedStatus.EXHAUSTED;
  if (now < c.validFrom) return CouponDerivedStatus.SCHEDULED;
  return CouponDerivedStatus.ACTIVE;
}

/** Compute a discount against a base amount; never exceeds the base. Rounded to 2 decimals. */
export function computeDiscount(type: DiscountType, value: number, base: number): number {
  if (base <= 0) return 0;
  const raw = type === DiscountType.PERCENTAGE ? (base * value) / 100 : value;
  return Math.min(base, Math.round(raw * 100) / 100);
}
