// src/modules/plans/dto/index.ts
//
// Subscription-plan DTOs.
//
// ⚠ SCHEMA-PENDING (flagged): the requirement lists "Bi-Annual" and "Included services".
//   • billingCycle accepts only the schema's BillingCycle values (WEEKLY/MONTHLY/QUARTERLY/
//     YEARLY) — BI_ANNUAL would need an enum addition.
//   • "Included services" has no relation on SubscriptionPlan; plans carry visitsPerCycle
//     (count of visits) instead. A PlanService join table would be needed to model specific
//     included services.

import { BillingCycle } from '@prisma/client';
import {
  IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class CreatePlanDto {
  @IsString() @IsNotEmpty({ message: 'Plan name is required' }) @MaxLength(120)
  name!: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Price must have at most 2 decimals' }) @Min(0)
  price!: number;

  @IsOptional() @IsString() @MaxLength(3)
  currency?: string;

  @IsEnum(BillingCycle, { message: 'billingCycle must be WEEKLY, MONTHLY, QUARTERLY, or YEARLY' })
  billingCycle!: BillingCycle;

  @IsOptional() @IsInt() @Min(1)
  visitsPerCycle?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdatePlanDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price?: number;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsEnum(BillingCycle) billingCycle?: BillingCycle;
  @IsOptional() @IsInt() @Min(1) visitsPerCycle?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class PlanFilterDto extends PaginationQueryDto {
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
