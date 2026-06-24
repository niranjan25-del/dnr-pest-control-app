// test/support/setup-e2e.ts
//
// Boots integration/e2e specs against the REAL AppModule but with every external SDK mocked at
// the module level, so the app exercises real controllers/services/guards/Prisma while never
// hitting Stripe/Firebase/AWS/Google. Requires a Prisma test database (DATABASE_URL → a
// disposable schema); run `npx prisma migrate deploy` against it first (see setup-integration).

import {
  stripeModuleMock,
  createFirebaseAdminMock,
  createS3Mock,
  presignMock,
} from "./mocks/external";

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret";
process.env.JWT_ACCESS_TTL ??= "900s";
process.env.JWT_REFRESH_TTL_DAYS ??= "30";
process.env.STRIPE_SECRET_KEY ??= "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET ??= "whsec_test_dummy";
process.env.FCM_ENABLED ??= "false";
process.env.AWS_REGION ??= "ap-south-1";
process.env.AWS_S3_MEDIA_BUCKET ??= "dnr-test";
// DATABASE_URL must be provided by the CI/test environment (a disposable Postgres schema).

jest.mock("stripe", () => stripeModuleMock());
jest.mock("firebase-admin", () => createFirebaseAdminMock());
jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(() => createS3Mock()),
  PutObjectCommand: jest.fn((a) => ({ __type: "PutObjectCommand", ...a })),
  GetObjectCommand: jest.fn((a) => ({ __type: "GetObjectCommand", ...a })),
  DeleteObjectCommand: jest.fn((a) => ({
    __type: "DeleteObjectCommand",
    ...a,
  })),
}));
jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: presignMock,
}));
