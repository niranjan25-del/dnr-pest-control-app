// src/modules/subscriptions/cashfree-subscription.service.ts
//
// Subscription-related Cashfree helpers. Unlike Stripe, Cashfree does not expose a
// fully-managed recurring subscription object that mirrors our plan model cleanly.
// Subscriptions are therefore managed locally: status is set to ACTIVE immediately on
// creation and renewals are driven by processDueRenewals() (cron). Each billing cycle
// triggers a new Cashfree order that the customer pays via the app or a payment link.

import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { CashfreeService } from '../payments/cashfree.service';

@Injectable()
export class CashfreeSubscriptionService {
  private readonly logger = new Logger(CashfreeSubscriptionService.name);

  constructor(private readonly cashfree: CashfreeService) {}

  /**
   * Create a Cashfree order for the first billing cycle of a subscription.
   * Returns the order details so the caller can present a payment sheet.
   */
  async createInitialPaymentOrder(params: {
    orderId: string;
    plan: SubscriptionPlan;
    customerId: string;       // our CustomerProfile.id
    customerEmail: string;
    customerPhone: string;
    subscriptionId: string;
  }) {
    const order = await this.cashfree.createOrder({
      orderId: params.orderId,
      amount: Number(params.plan.price),
      currency: params.plan.currency,
      customerId: params.customerId,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      tags: { subscriptionId: params.subscriptionId, planId: params.plan.id },
    });
    this.logger.log(`Cashfree order ${order.orderId} created for subscription ${params.subscriptionId}`);
    return order;
  }
}
