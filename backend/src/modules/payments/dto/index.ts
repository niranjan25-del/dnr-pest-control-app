// src/modules/payments/dto/index.ts
//
// Payment DTOs. Charge amounts are NEVER accepted from the client — the amount is computed
// server-side from the booking invoice. Refund amount (partial) is the only client-supplied
// money value and is bounded by the remaining refundable balance.

import {
  IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min,
} from 'class-validator';
import { PaymentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class CreatePaymentIntentDto {
  @IsUUID('4', { message: 'A valid bookingId is required' })
  bookingId!: string;

  // When true, Cashfree will offer to save the card for future use.
  @IsOptional() @IsBoolean()
  savePaymentMethod?: boolean;
}

export class ConfirmPaymentDto {
  // Cashfree order_id returned by create-intent (Flutter passes this after checkout).
  @IsString() @IsNotEmpty({ message: 'orderId is required' })
  orderId!: string;
}

export class RefundPaymentDto {
  @IsUUID('4', { message: 'A valid paymentId is required' })
  paymentId!: string;

  // Omit for a full refund; provide a value (major units, INR) for a partial refund.
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01)
  amount?: number;

  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

export class AttachPaymentMethodDto {
  // Cashfree instrument_id (from listPaymentMethods response).
  @IsString() @IsNotEmpty({ message: 'instrumentId is required' })
  instrumentId!: string;
}

export class PaymentFilterDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}
