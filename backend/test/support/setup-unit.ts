// test/support/setup-unit.ts
// Runs before every unit/integration spec. Sets safe test env defaults and mocks the external
// SDK modules so importing a service never spins up a real Stripe/Firebase/S3 client.

import { stripeModuleMock, createFirebaseAdminMock } from "./mocks/external";

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret";
process.env.STRIPE_SECRET_KEY ??= "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET ??= "whsec_test_dummy";
process.env.FCM_ENABLED ??= "false";

jest.mock("stripe", () => stripeModuleMock());
jest.mock("firebase-admin", () => createFirebaseAdminMock());
