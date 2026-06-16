// src/features/coupons/types.ts
export type DiscountType = 'PERCENTAGE' | 'FIXED';

export interface CouponRow {
  id: string;
  code: string;
  description?: string | null;
  discount_type: DiscountType;
  discount_value: number;
  max_redemptions?: number | null;
  times_redeemed: number;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active: boolean;
  status?: string; // derived on the server (ACTIVE/EXPIRED/EXHAUSTED/SCHEDULED)
}

export interface CouponFormValues {
  code: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  max_redemptions?: number;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
}
