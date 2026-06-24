// src/modules/promotions/promotions/dto/index.ts
//
// Promotion (campaign) DTOs.
//
// ⚠ SCHEMA RECONCILIATION: there is no Promotion/Campaign model in the schema. A promotion
// here IS a coupon-backed campaign — these DTOs map onto Coupon fields, and the promotions
// service delegates to CouponsService. A dedicated Promotion model (banner/landing content,
// multiple coupons per campaign, impression tracking) is the recommended schema addition.

import { DiscountType } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreatePromotionDto {
  @IsString()
  @IsNotEmpty({ message: "Campaign name is required" })
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsNotEmpty({ message: "A promo code is required" })
  @MaxLength(40)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: "Code may contain only A–Z, 0–9, hyphen, underscore",
  })
  code!: string;

  @IsEnum(DiscountType, { message: "discountType must be PERCENTAGE or FIXED" })
  discountType!: DiscountType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  discountValue!: number;

  @IsDateString() validFrom!: string;
  @IsDateString() validUntil!: string;

  @IsOptional() @IsInt() @Min(1) usageLimit?: number;
  @IsOptional() @IsInt() @Min(1) perUserLimit?: number;
}

export class UpdatePromotionDto {
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  discountValue?: number;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsInt() @Min(1) usageLimit?: number;
  @IsOptional() @IsInt() @Min(1) perUserLimit?: number;
}
