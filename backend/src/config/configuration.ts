// src/config/configuration.ts
//
// Namespaced, typed configuration built from the (already-validated) environment. Inject
// with ConfigService and the namespace key, e.g. `config.get('jwt.accessSecret')`, or use
// the typed `ConfigType<typeof jwtConfig>` pattern for full type-safety in services.

import { registerAs } from "@nestjs/config";

export const appConfig = registerAs("app", () => ({
  env: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "3000", 10),
  apiPrefix: process.env.API_PREFIX ?? "api",
  apiVersion: process.env.API_VERSION ?? "1",
  corsOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  throttleTtlSeconds: parseInt(process.env.THROTTLE_TTL_SECONDS ?? "60", 10),
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT ?? "120", 10),
  logLevel: process.env.LOG_LEVEL ?? "info",
}));

export const databaseConfig = registerAs("database", () => ({
  url: process.env.DATABASE_URL,
}));

export const jwtConfig = registerAs("jwt", () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
  refreshTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS ?? "30", 10),
  issuer: process.env.JWT_ISSUER ?? "dnr-pest-control",
  audience: process.env.JWT_AUDIENCE ?? "dnr-clients",
}));

export const firebaseConfig = registerAs("firebase", () => ({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // Newlines arrive escaped in env — restore them for the SDK.
  privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
}));

export const awsConfig = registerAs("aws", () => ({
  region: process.env.AWS_REGION,
  mediaBucket: process.env.AWS_S3_MEDIA_BUCKET,
  cloudfrontDomain: process.env.AWS_CLOUDFRONT_DOMAIN,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
}));

export const cashfreeConfig = registerAs("cashfree", () => ({
  clientId: process.env.CASHFREE_CLIENT_ID,
  clientSecret: process.env.CASHFREE_CLIENT_SECRET,
  webhookSecret: process.env.CASHFREE_WEBHOOK_SECRET,
  environment: process.env.CASHFREE_ENVIRONMENT ?? "sandbox",
}));

export const fcmConfig = registerAs("fcm", () => ({
  enabled: (process.env.FCM_ENABLED ?? "true") === "true",
}));

export const configurations = [
  appConfig,
  databaseConfig,
  jwtConfig,
  firebaseConfig,
  awsConfig,
  cashfreeConfig,
  fcmConfig,
];
