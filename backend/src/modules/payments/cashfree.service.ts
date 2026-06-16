// src/modules/payments/cashfree.service.ts
//
// Thin wrapper over the Cashfree PG SDK v6. v6 uses an instance pattern:
//   new Cashfree(CFEnvironment, clientId, clientSecret)
// No API-version string is passed per call — it's fixed in the SDK at the x-api-version
// header level. No card data is ever stored locally.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Cashfree, CFEnvironment, PGCustomerFetchInstrumentsInstrumentTypeEnum,
  type CreateOrderRequest, type OrderCreateRefundRequest, type InstrumentEntityForAllSavedCard,
} from 'cashfree-pg';

export interface CashfreeOrder {
  orderId: string;
  paymentSessionId: string;
  orderStatus: string;
}

export interface CashfreeOrderStatus {
  orderStatus: string;   // ACTIVE | PAID | EXPIRED | CANCELLED
  orderAmount: number;
}

export interface CashfreeInstrument {
  instrumentId: string;
  instrumentType: string;
  cardNetwork: string;
  cardDisplay: string;   // last-4 display string, e.g. "XXXX XXXX XXXX 1234"
}

@Injectable()
export class CashfreeService {
  private readonly logger = new Logger(CashfreeService.name);
  private readonly cf: Cashfree;

  constructor(private readonly config: ConfigService) {
    const clientId = config.get<string>('cashfree.clientId')!;
    const clientSecret = config.get<string>('cashfree.clientSecret')!;
    const env = config.get<string>('cashfree.environment') === 'production'
      ? CFEnvironment.PRODUCTION
      : CFEnvironment.SANDBOX;
    this.cf = new Cashfree(env, clientId, clientSecret);
  }

  async createOrder(params: {
    orderId: string;
    amount: number;       // major units (INR)
    currency: string;
    customerId: string;   // our CustomerProfile.id — Cashfree uses it as customer identifier
    customerEmail: string;
    customerPhone: string;
    notifyUrl?: string;
    tags?: Record<string, string>;
  }): Promise<CashfreeOrder> {
    const req: CreateOrderRequest = {
      order_id: params.orderId,
      order_amount: params.amount,
      order_currency: params.currency,
      customer_details: {
        customer_id: params.customerId,
        customer_email: params.customerEmail,
        customer_phone: params.customerPhone,
      },
      order_meta: params.notifyUrl ? { notify_url: params.notifyUrl } : undefined,
      order_tags: params.tags,
    };
    const { data } = await this.cf.PGCreateOrder(req);
    return {
      orderId: data.order_id!,
      paymentSessionId: data.payment_session_id!,
      orderStatus: data.order_status!,
    };
  }

  async fetchOrder(orderId: string): Promise<CashfreeOrderStatus> {
    const { data } = await this.cf.PGFetchOrder(orderId);
    return {
      orderStatus: data.order_status!,
      orderAmount: data.order_amount!,
    };
  }

  async createRefund(params: {
    orderId: string;
    refundId: string;   // idempotency key
    amount: number;     // major units
    note?: string;
  }): Promise<void> {
    const req: OrderCreateRefundRequest = {
      refund_amount: params.amount,
      refund_id: params.refundId,
      refund_note: params.note,
    };
    await this.cf.PGOrderCreateRefund(params.orderId, req);
  }

  async listInstruments(customerId: string): Promise<CashfreeInstrument[]> {
    try {
      const { data } = await this.cf.PGCustomerFetchInstruments(
        customerId,
        PGCustomerFetchInstrumentsInstrumentTypeEnum.CARD,
      );
      const rows = (Array.isArray(data) ? data : []) as InstrumentEntityForAllSavedCard[];
      return rows.map((i) => ({
        instrumentId: i.instrument_id ?? '',
        instrumentType: i.instrument_type ?? 'card',
        cardNetwork: i.instrument_meta?.card_network ?? 'unknown',
        cardDisplay: i.instrument_display ?? '****',
      }));
    } catch {
      return [];
    }
  }

  async deleteInstrument(customerId: string, instrumentId: string): Promise<void> {
    await this.cf.PGCustomerDeleteInstrument(customerId, instrumentId);
  }

  /** Verify Cashfree webhook signature. Throws if the signature is invalid. */
  verifyWebhookSignature(signature: string, rawBody: string, timestamp: string): void {
    this.cf.PGVerifyWebhookSignature(signature, rawBody, timestamp);
  }
}
