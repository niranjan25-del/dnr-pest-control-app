// src/modules/payments/payments.service.ts
//
// Payment orchestration. Charge amounts are computed server-side from the booking's invoice
// (never trusted from the client). Paying a booking ensures an Invoice exists first.
// Cashfree orders are created with our CustomerProfile.id as the customer identifier —
// no separate gateway customer record is needed. Webhook handlers are idempotent.
// Refunds and payment lifecycle changes are audited.

import {
  BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, PaymentMethod, PaymentStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { paginate } from 'src/common/utils/pagination.util';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { CashfreeService } from './cashfree.service';
import { CreatePaymentIntentDto, RefundPaymentDto } from './dto';
import { PaymentOrderResult, SavedInstrument } from './interfaces';
import { TAX_RATE } from './enums';
import {
  CASHFREE_PAYMENT_SUCCESS, CASHFREE_PAYMENT_FAILED, CASHFREE_PAYMENT_DROPPED,
  CASHFREE_REFUND_STATUS,
} from './enums';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cashfree: CashfreeService,
  ) {}

  // ===================== Create order =====================
  async createIntent(
    actor: AuthenticatedUser,
    dto: CreatePaymentIntentDto,
    idempotencyKey?: string,
  ): Promise<PaymentOrderResult> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, deletedAt: null },
      include: {
        invoice: true,
        customer: { include: { user: { select: { email: true, fullName: true, phone: true } } } },
      },
    });
    if (!booking) throw new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });

    if (actor.role === UserRole.CUSTOMER) {
      const profile = await this.prisma.customerProfile.findUnique({
        where: { userId: actor.id }, select: { id: true },
      });
      if (!profile || profile.id !== booking.customerId) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your booking' });
      }
    }

    const invoice = await this.ensureInvoice(booking);
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException({ code: 'ALREADY_PAID', message: 'This booking is already paid' });
    }

    // Reuse an in-flight order for this invoice (idempotency on retries).
    const existing = await this.prisma.payment.findFirst({
      where: { invoiceId: invoice.id, status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] } },
    });
    if (existing?.providerTransactionId && existing.providerSessionToken) {
      try {
        const order = await this.cashfree.fetchOrder(existing.providerTransactionId);
        if (order.orderStatus === 'ACTIVE') {
          return this.orderResult(existing.id, existing.providerTransactionId, existing.providerSessionToken, Number(invoice.totalAmount), invoice.currency);
        }
      } catch { /* expired or not found — create a new order below */ }
    }

    // Use idempotencyKey or invoice id to derive a stable Cashfree order_id.
    const cfOrderId = idempotencyKey ? `dnr_${idempotencyKey}` : `dnr_${invoice.id}`;
    const amount = Number(invoice.totalAmount);

    const order = await this.cashfree.createOrder({
      orderId: cfOrderId,
      amount,
      currency: invoice.currency,
      customerId: booking.customerId,          // our CustomerProfile.id
      customerEmail: booking.customer.user.email,
      customerPhone: booking.customer.user.phone ?? '9999999999',
      tags: { bookingId: booking.id, invoiceId: invoice.id },
    });

    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: invoice.id, customerId: booking.customerId,
        status: PaymentStatus.PENDING, method: PaymentMethod.CARD,
        amount: invoice.totalAmount, currency: invoice.currency,
        provider: 'CASHFREE',
        providerTransactionId: order.orderId,
        providerSessionToken: order.paymentSessionId,
      },
    });
    this.logger.log(`Cashfree order ${order.orderId} created for invoice ${invoice.id} (payment ${payment.id})`);
    return this.orderResult(payment.id, order.orderId, order.paymentSessionId, amount, invoice.currency);
  }

  // ===================== Confirm (server-side sync) =====================
  async confirm(actor: AuthenticatedUser, orderId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { providerTransactionId: orderId, ...(await this.scope(actor)) },
    });
    if (!payment) throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' });

    const order = await this.cashfree.fetchOrder(orderId);
    await this.syncFromOrder(orderId, order.orderStatus);
    return this.findById(payment.id, actor);
  }

  // ===================== Refund (admin) =====================
  async refund(actor: AuthenticatedUser, dto: RefundPaymentDto) {
    const payment = await this.prisma.payment.findUnique({ where: { id: dto.paymentId } });
    if (!payment) throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' });
    if (payment.status !== PaymentStatus.SUCCEEDED && payment.status !== PaymentStatus.PARTIALLY_REFUNDED) {
      throw new BadRequestException({ code: 'REFUND_FAILED', message: 'Only a succeeded payment can be refunded' });
    }
    if (!payment.providerTransactionId) {
      throw new BadRequestException({ code: 'REFUND_FAILED', message: 'No provider transaction to refund' });
    }

    const alreadyRefunded = Number(payment.refundedAmount);
    const refundable = Number(payment.amount) - alreadyRefunded;
    const refundAmount = dto.amount ?? refundable;
    if (refundAmount <= 0 || refundAmount > refundable + 1e-6) {
      throw new BadRequestException({ code: 'REFUND_FAILED', message: 'Refund amount exceeds the refundable balance' });
    }

    try {
      await this.cashfree.createRefund({
        orderId: payment.providerTransactionId,
        refundId: `refund_${payment.id}_${Date.now()}`,
        amount: refundAmount,
        note: dto.reason,
      });
    } catch (err) {
      this.logger.error(`Cashfree refund failed for payment ${payment.id}: ${(err as Error).message}`);
      throw new BadRequestException({ code: 'REFUND_FAILED', message: 'Refund could not be processed' });
    }

    const newRefunded = alreadyRefunded + refundAmount;
    const fullyRefunded = newRefunded >= Number(payment.amount) - 1e-6;
    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: payment.id },
        data: {
          refundedAmount: newRefunded,
          status: fullyRefunded ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id, action: 'payment.refunded', entityType: 'payment', entityId: payment.id,
          metadata: { amount: refundAmount, full: fullyRefunded, reason: dto.reason },
        },
      });
      return p;
    });
    this.logger.warn(`Payment ${payment.id} refunded ${refundAmount} (full=${fullyRefunded}) by ${actor.id}`);
    return this.toResponse(updated);
  }

  // ===================== Saved instruments (Cashfree-backed) =====================
  async listPaymentMethods(actor: AuthenticatedUser): Promise<SavedInstrument[]> {
    const profile = await this.requireCustomerProfile(actor);
    const instruments = await this.cashfree.listInstruments(profile.id);
    return instruments.map((i) => ({
      id: i.instrumentId,
      type: i.instrumentType,
      brand: i.cardNetwork,
      card_display: i.cardDisplay,
    }));
  }

  async removePaymentMethod(actor: AuthenticatedUser, instrumentId: string) {
    const profile = await this.requireCustomerProfile(actor);
    await this.cashfree.deleteInstrument(profile.id, instrumentId);
    return { success: true };
  }

  // ===================== History / reads =====================
  async history(actor: AuthenticatedUser, filter: import('./dto').PaymentFilterDto) {
    const where: Prisma.PaymentWhereInput = {
      ...(await this.scope(actor)),
      ...(filter.status ? { status: filter.status } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where, orderBy: { createdAt: filter.order }, skip: filter.skip, take: filter.limit,
        include: { invoice: { select: { invoiceNumber: true, bookingId: true } } },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginate(rows.map((r) => this.toResponse(r)), total, filter.page, filter.limit);
  }

  async findById(id: string, actor: AuthenticatedUser) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, ...(await this.scope(actor)) },
      include: { invoice: { select: { invoiceNumber: true, bookingId: true } } },
    });
    if (!payment) throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' });
    return this.toResponse(payment);
  }

  // ===================== Webhook handler =====================
  async handleWebhookEvent(event: { type: string; data: Record<string, unknown> }): Promise<void> {
    switch (event.type) {
      case CASHFREE_PAYMENT_SUCCESS:
        await this.syncFromOrder(this.extractOrderId(event), 'PAID');
        break;
      case CASHFREE_PAYMENT_FAILED:
      case CASHFREE_PAYMENT_DROPPED: {
        const payment = event.data.payment as Record<string, unknown> | undefined;
        await this.syncFromOrder(this.extractOrderId(event), 'FAILED', String(payment?.payment_message ?? 'Payment failed'));
        break;
      }
      case CASHFREE_REFUND_STATUS:
        await this.handleRefundWebhook(event.data);
        break;
      default:
        this.logger.debug(`Unhandled Cashfree event ${event.type}`);
    }
  }

  // ===================== private helpers =====================
  async syncFromOrder(orderId: string, orderStatus: string, failureMessage?: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { providerTransactionId: orderId } });
    if (!payment) {
      this.logger.warn(`No local payment for Cashfree order ${orderId}`);
      return;
    }
    if (orderStatus === 'PAID' && payment.status !== PaymentStatus.SUCCEEDED) {
      await this.prisma.$transaction([
        this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.SUCCEEDED } }),
        this.prisma.invoice.update({ where: { id: payment.invoiceId }, data: { status: InvoiceStatus.PAID } }),
        this.prisma.auditLog.create({
          data: { actorId: payment.customerId, action: 'payment.succeeded', entityType: 'payment', entityId: payment.id },
        }),
      ]);
      this.logger.log(`Payment ${payment.id} SUCCEEDED (invoice ${payment.invoiceId} PAID)`);
    } else if ((orderStatus === 'FAILED' || orderStatus === 'EXPIRED') && payment.status !== PaymentStatus.FAILED) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED, failureReason: failureMessage ?? 'Payment failed' },
      });
      this.logger.warn(`Payment ${payment.id} FAILED: ${failureMessage}`);
    }
  }

  private async handleRefundWebhook(data: Record<string, unknown>): Promise<void> {
    const refund = data.refund as Record<string, unknown> | undefined;
    const order = data.order as Record<string, unknown> | undefined;
    if (!refund || !order) return;
    const orderId = String(order.order_id ?? '');
    const refundStatus = String(refund.refund_status ?? '');
    if (refundStatus !== 'SUCCESS') return;

    const payment = await this.prisma.payment.findUnique({ where: { providerTransactionId: orderId } });
    if (!payment) return;
    const refundedAmount = Number(refund.refund_amount ?? 0);
    const fullyRefunded = refundedAmount >= Number(payment.amount) - 1e-6;
    if (Number(payment.refundedAmount) !== refundedAmount) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          refundedAmount,
          status: fullyRefunded ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
        },
      });
      this.logger.log(`Payment ${payment.id} refund reconciled to ${refundedAmount} via webhook`);
    }
  }

  private extractOrderId(event: { data: Record<string, unknown> }): string {
    const order = event.data.order as Record<string, unknown> | undefined;
    return String(order?.order_id ?? '');
  }

  private orderResult(
    paymentId: string, orderId: string, sessionId: string, amount: number, currency: string,
  ): PaymentOrderResult {
    return {
      payment_id: paymentId,
      order_id: orderId,
      payment_session_id: sessionId,
      amount,
      currency: currency.toUpperCase(),
      status: 'ACTIVE',
    };
  }

  private async ensureInvoice(booking: Prisma.BookingGetPayload<{ include: { invoice: true } }>) {
    if (booking.invoice && booking.invoice.status !== InvoiceStatus.VOID) return booking.invoice;
    const subtotal = Number(booking.price);
    const discount = Number(booking.discountAmount);
    const taxable = Math.max(0, subtotal - discount);
    const tax = Math.round(taxable * TAX_RATE * 100) / 100;
    const total = taxable + tax;
    const invoiceNumber = await this.uniqueInvoiceNumber();
    return this.prisma.invoice.create({
      data: {
        invoiceNumber, customerId: booking.customerId, bookingId: booking.id,
        status: InvoiceStatus.ISSUED, subtotalAmount: subtotal, taxAmount: tax,
        discountAmount: discount, totalAmount: total, currency: booking.currency,
      },
    });
  }

  private async uniqueInvoiceNumber(): Promise<string> {
    const d = new Date();
    const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
    for (let i = 0; i < 5; i++) {
      const candidate = `INV-${ymd}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const exists = await this.prisma.invoice.findUnique({ where: { invoiceNumber: candidate }, select: { id: true } });
      if (!exists) return candidate;
    }
    return `INV-${ymd}-${Date.now().toString(36).toUpperCase()}`;
  }

  private async requireCustomerProfile(actor: AuthenticatedUser) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId: actor.id }, select: { id: true },
    });
    if (!profile) throw new BadRequestException({ code: 'PROFILE_NOT_FOUND', message: 'Customer profile required' });
    return profile;
  }

  private async scope(actor: AuthenticatedUser): Promise<Prisma.PaymentWhereInput> {
    if (actor.role === UserRole.ADMIN) return {};
    if (actor.role === UserRole.CUSTOMER) {
      const p = await this.prisma.customerProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
      return { customerId: p?.id ?? '00000000-0000-0000-0000-000000000000' };
    }
    if (actor.role === UserRole.TECHNICIAN) {
      const p = await this.prisma.technicianProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
      return { invoice: { booking: { assignments: { some: { technicianId: p?.id ?? '0' } } } } };
    }
    return { id: '00000000-0000-0000-0000-000000000000' };
  }

  private toResponse(
    p: Prisma.PaymentGetPayload<{ include: { invoice: { select: { invoiceNumber: true; bookingId: true } } } }>
      | Prisma.PaymentGetPayload<object>,
  ) {
    const invoice = 'invoice' in p
      ? (p as { invoice?: { invoiceNumber: string; bookingId: string | null } }).invoice
      : undefined;
    return {
      id: p.id,
      status: p.status,
      method: p.method,
      amount: Number(p.amount),
      refunded_amount: Number(p.refundedAmount),
      currency: p.currency,
      provider: p.provider,
      order_id: p.providerTransactionId,
      payment_session_id: p.providerSessionToken,
      failure_reason: p.failureReason,
      invoice_number: invoice?.invoiceNumber ?? null,
      booking_id: invoice?.bookingId ?? null,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    };
  }
}
