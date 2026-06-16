// src/modules/subscriptions/dto/index.ts

import { SubscriptionStatus } from '@prisma/client';
import {
  IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class CreateSubscriptionDto {
  @IsUUID('4', { message: 'A valid planId is required' })
  planId!: string;

  // Address used for the recurring service visits (defaults to the customer's default address).
  @IsOptional() @IsUUID('4')
  addressId?: string;

  @IsOptional() @IsDateString()
  startDate?: string;
}

export class PauseSubscriptionDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ResumeSubscriptionDto {}

export class CancelSubscriptionDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
  // Cancel immediately vs. at the end of the current billing period (default: period end).
  @IsOptional() @IsBoolean() immediate?: boolean;
}

// Used for both upgrade and downgrade (the target plan determines the direction).
export class ChangePlanDto {
  @IsUUID('4', { message: 'A valid target planId is required' })
  planId!: string;
}

export class SubscriptionFilterDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;
}
