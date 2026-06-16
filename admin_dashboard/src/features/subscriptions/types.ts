// src/features/subscriptions/types.ts
export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';

export interface SubscriptionRow {
  id: string;
  customer_name?: string;
  customer_id?: string;
  plan_name?: string;
  status: SubscriptionStatus;
  billing_cycle?: string;
  price?: number;
  next_billing_date?: string | null;
  created_at?: string;
}
