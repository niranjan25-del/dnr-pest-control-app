// src/modules/subscriptions/enums/index.ts
//
// Subscription state machine, billing-cycle → Stripe interval mapping, and cycle date math.
//
// NOTE (schema reconciliation):
//   • SubscriptionStatus has no TRIALING — Stripe manages trial periods; our row stays
//     ACTIVE (or PENDING until the first payment). We don't add the enum value.
//   • BillingCycle has no BI_ANNUAL — only WEEKLY/MONTHLY/QUARTERLY/YEARLY. "Bi-Annual"
//     plans aren't representable without an enum addition (flagged in the plans DTO).

import { BillingCycle, SubscriptionStatus } from '@prisma/client';

export const SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  PENDING: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED],
  ACTIVE: [SubscriptionStatus.PAUSED, SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED],
  PAUSED: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED],
  CANCELLED: [],
  EXPIRED: [],
};

export function isSubTransitionAllowed(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return SUBSCRIPTION_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Advance a date by one billing cycle. */
export function nextCycleDate(from: Date, cycle: BillingCycle): Date {
  const d = new Date(from);
  switch (cycle) {
    case 'WEEKLY': d.setDate(d.getDate() + 7); break;
    case 'MONTHLY': d.setMonth(d.getMonth() + 1); break;
    case 'QUARTERLY': d.setMonth(d.getMonth() + 3); break;
    case 'YEARLY': d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
}

