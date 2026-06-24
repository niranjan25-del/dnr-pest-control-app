// src/modules/payments/enums/index.ts
//
// Money helpers + tax constant + Cashfree webhook event types.

import { Prisma } from "@prisma/client";

// Cashfree expects amounts in major units (INR); no minor-unit conversion needed.
// These helpers are kept for internal arithmetic consistency (e.g. refund bounds).
export function toMinorUnits(amount: number | Prisma.Decimal): number {
  return Math.round(Number(amount) * 100);
}
export function fromMinorUnits(minor: number): number {
  return Math.round(minor) / 100;
}

// ⚠ Default GST rate for services in India. Confirm the correct rate / exemptions
// with your CA before go-live, or move this to config/DB.
export const TAX_RATE = 0.18;

export const CASHFREE_API_VERSION = "2023-08-01";

// Cashfree PG webhook event types we handle.
export const CASHFREE_PAYMENT_SUCCESS = "PAYMENT_SUCCESS_WEBHOOK";
export const CASHFREE_PAYMENT_FAILED = "PAYMENT_FAILED_WEBHOOK";
export const CASHFREE_PAYMENT_DROPPED = "PAYMENT_USER_DROPPED_WEBHOOK";
export const CASHFREE_REFUND_STATUS = "REFUND_STATUS_WEBHOOK";
