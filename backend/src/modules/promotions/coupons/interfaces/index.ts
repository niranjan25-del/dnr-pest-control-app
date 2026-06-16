// src/modules/promotions/coupons/interfaces/index.ts

export interface DiscountContext {
  base: number;
  bookingId?: string;
  subscriptionId?: string;
}

export interface ValidationPreview {
  valid: boolean;
  code: string;
  reason?: string;          // present when valid=false
  discount_amount: number;
  final_amount: number;
}

export interface CampaignPerformance {
  coupon_id: string;
  code: string;
  redemptions: number;
  unique_customers: number;
  total_discount: number;   // revenue impact (discount given)
}
