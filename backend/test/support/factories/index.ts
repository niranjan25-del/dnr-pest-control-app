// test/support/factories/index.ts
//
// Deterministic-but-overridable factories producing plain objects shaped like the Prisma
// models (snake_case-free, camelCase as Prisma returns). Used by both unit tests (as fixtures)
// and integration tests (as `prisma.create` inputs after stripping ids/timestamps).
//
// Money is Decimal in the DB; factories use numbers/strings and the integration layer wraps
// them with Prisma.Decimal as needed.

import { randomUUID } from 'crypto';
import {
  BookingStatus, PaymentStatus, UserRole, DiscountType,
} from '@prisma/client';

let seq = 0;
const next = () => ++seq;

export function userFactory(overrides: Partial<Record<string, unknown>> = {}) {
  const n = next();
  return {
    id: randomUUID(),
    email: `user${n}@dnr.test`,
    fullName: `Test User ${n}`,
    phone: `+9198${String(1000000 + n).slice(0, 8)}`,
    role: UserRole.CUSTOMER,
    passwordHash: '$2b$10$testhashtesthashtesthashtesthashtesthashtesthashghi', // bcrypt-shaped
    firebaseUid: null,
    status: 'ACTIVE',
    createdAt: new Date(),
    ...overrides,
  };
}

export function technicianUserFactory(overrides = {}) {
  return userFactory({ role: UserRole.TECHNICIAN, email: `tech${next()}@dnr.test`, ...overrides });
}

export function serviceFactory(overrides: Partial<Record<string, unknown>> = {}) {
  const n = next();
  return {
    id: randomUUID(),
    name: `Pest Control ${n}`,
    slug: `pest-control-${n}`,
    description: 'General pest treatment',
    basePrice: 1500, // ₹
    durationMinutes: 60,
    isActive: true,
    pestCategoryId: null,
    ...overrides,
  };
}

export function bookingFactory(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: randomUUID(),
    customerId: randomUUID(),
    serviceId: randomUUID(),
    addressId: randomUUID(),
    status: BookingStatus.PENDING,
    scheduledWindowStart: new Date(Date.now() + 86400_000),
    scheduledWindowEnd: new Date(Date.now() + 90000_000),
    notes: null,
    discountAmount: 0,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function paymentFactory(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: randomUUID(),
    invoiceId: randomUUID(),
    customerId: randomUUID(),
    amount: 1770, // 1500 + 18% GST
    refundedAmount: 0,
    currency: 'INR',
    status: PaymentStatus.PENDING,
    provider: 'stripe',
    providerTransactionId: 'pi_test_123',
    createdAt: new Date(),
    ...overrides,
  };
}

export function couponFactory(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: randomUUID(),
    code: `SAVE${next()}`,
    description: 'Test coupon',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 10,
    maxRedemptions: 100,
    timesRedeemed: 0,
    validFrom: new Date(Date.now() - 86400_000),
    validUntil: new Date(Date.now() + 30 * 86400_000),
    isActive: true,
    deletedAt: null,
    ...overrides,
  };
}
