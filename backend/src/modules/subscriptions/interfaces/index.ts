// src/modules/subscriptions/interfaces/index.ts

import { SubscriptionStatus } from "@prisma/client";

export interface SubscriptionResponse {
  id: string;
  status: SubscriptionStatus;
  plan: { id: string; name: string; price: number; billing_cycle: string };
  start_date: Date;
  next_billing_date: Date | null;
  next_service_date: Date | null;
  paused_at: Date | null;
  cancelled_at: Date | null;
  stripe_subscription_id: string | null;
  created_at: Date;
}
