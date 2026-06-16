// src/modules/promotions/coupons/dto/index.ts
//
// Coupon DTOs.
//
// ⚠ SCHEMA-PENDING (flagged): the schema has no eligibility-scoping columns on Coupon
// (min order amount, eligible service ids, subscription-only flag). Service/subscription
// "eligibility validation" is therefore structural-only here; data-driven scoping would need
// those columns. A "Free Service" coupon = PERCENTAGE with discountValue 100.

import { DiscountType } from '@prisma/client';
import {
  IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID,
  Matches, Max, MaxLength, Min,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class CreateCouponDto {
  @IsString() @IsNotEmpty({ message: 'Coupon code is required' }) @MaxLength(40)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Code may contain only A–Z, 0–9, hyphen, underscore' })
  code!: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsEnum(DiscountType, { message: 'discountType must be PERCENTAGE or FIXED' })
  discountType!: DiscountType;

  // For PERCENTAGE: 0–100. For FIXED: a positive currency amount.
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000)
  discountValue!: number;

  @IsDateString({}, { message: 'validFrom must be an ISO date' })
  validFrom!: string;

  @IsDateString({}, { message: 'validUntil must be an ISO date' })
  validUntil!: string;

  @IsOptional() @IsInt() @Min(1)
  maxRedemptions?: number;

  @IsOptional() @IsInt() @Min(1)
  perUserLimit?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateCouponDto {
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsEnum(DiscountType) discountType?: DiscountType;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000) discountValue?: number;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsInt() @Min(1) maxRedemptions?: number;
  @IsOptional() @IsInt() @Min(1) perUserLimit?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// Validate (preview) or redeem against a booking or subscription (base amount derived from it).
export class ValidateCouponDto {
  @IsString() @IsNotEmpty({ message: 'Coupon code is required' })
  code!: string;

  @IsOptional() @IsUUID('4')
  bookingId?: string;

  @IsOptional() @IsUUID('4')
  subscriptionId?: string;
}

export class RedeemCouponDto extends ValidateCouponDto {}

export class CouponFilterDto extends PaginationQueryDto {
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
