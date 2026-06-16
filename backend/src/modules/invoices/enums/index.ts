// src/modules/invoices/enums/index.ts
//
// Invoice status machine + tax configuration.
//
// NOTE (schema reconciliation): InvoiceStatus is {DRAFT, ISSUED, PARTIALLY_PAID, PAID,
// OVERDUE, VOID}. The requirement's "Cancelled" maps to VOID; "Refunded" is not an invoice
// status — refunds are tracked on Payment.refundedAmount (Step 9). We don't add enum values.

import { InvoiceStatus } from '@prisma/client';

export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: [InvoiceStatus.ISSUED, InvoiceStatus.VOID],
  ISSUED: [InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.VOID],
  PARTIALLY_PAID: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.VOID],
  OVERDUE: [InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID, InvoiceStatus.VOID],
  PAID: [], // terminal; refunds live on Payment
  VOID: [],
};

export const VOIDABLE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE,
];

// --- Tax configuration framework (multi-region ready) ---
// ⚠ Default rates. Tax treatment is a finance decision — confirm rates/exemptions and move to
// config/DB before go-live. Keyed by ISO-2 region (the customer/booking country).
export const TAX_RATES: Record<string, { label: string; rate: number }> = {
  IN: { label: 'GST', rate: 0.18 },
  DEFAULT: { label: 'Tax', rate: 0.18 },
};
