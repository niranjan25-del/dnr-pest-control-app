// src/config/env.validation.ts
//
// Validates process.env at application boot using class-validator. If any required variable
// is missing or malformed, the process throws before listening — fail fast, never run a
// half-configured production server. Wired into ConfigModule.forRoot({ validate }).

import { plainToInstance, Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from "class-validator";

export enum NodeEnv {
  Development = "development",
  Test = "test",
  Production = "production",
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  API_PREFIX = "api";

  @IsString()
  @IsNotEmpty()
  API_VERSION = "1";

  @IsString()
  @IsNotEmpty()
  CORS_ALLOWED_ORIGINS!: string; // comma-separated

  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_TTL_SECONDS = 60;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT = 120;

  @IsString()
  LOG_LEVEL = "info";

  // --- Database ---
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  // --- JWT ---
  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;
  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;
  @IsString() JWT_ACCESS_TTL = "15m";
  @Type(() => Number) @IsInt() @Min(1) JWT_REFRESH_TTL_DAYS = 30;
  @IsString() JWT_ISSUER = "dnr-pest-control";
  @IsString() JWT_AUDIENCE = "dnr-clients";

  // --- Firebase ---
  @IsString()
  @IsNotEmpty()
  FIREBASE_PROJECT_ID!: string;
  @IsString()
  @IsNotEmpty()
  FIREBASE_CLIENT_EMAIL!: string;
  @IsString()
  @IsNotEmpty()
  FIREBASE_PRIVATE_KEY!: string;

  // --- AWS ---
  @IsString()
  @IsNotEmpty()
  AWS_REGION!: string;
  @IsString()
  @IsNotEmpty()
  AWS_S3_MEDIA_BUCKET!: string;
  @IsOptional()
  @IsString()
  AWS_CLOUDFRONT_DOMAIN?: string;
  @IsOptional()
  @IsString()
  AWS_ACCESS_KEY_ID?: string;
  @IsOptional()
  @IsString()
  AWS_SECRET_ACCESS_KEY?: string;

  // --- Cashfree ---
  @IsString()
  @IsNotEmpty()
  CASHFREE_CLIENT_ID!: string;
  @IsString()
  @IsNotEmpty()
  CASHFREE_CLIENT_SECRET!: string;
  @IsString()
  @IsNotEmpty()
  CASHFREE_WEBHOOK_SECRET!: string;
  @IsOptional()
  @IsString()
  CASHFREE_ENVIRONMENT?: string;

  // --- FCM ---
  @IsOptional()
  @IsString()
  FCM_ENABLED = "true";
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true, // "3000" -> 3000
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map(
        (e) =>
          `${e.property}: ${Object.values(e.constraints ?? {}).join(", ")}`,
      )
      .join("\n  ");
    throw new Error(`❌ Invalid environment configuration:\n  ${details}`);
  }
  return validated;
}
