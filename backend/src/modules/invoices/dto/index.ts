// src/modules/invoices/dto/index.ts
//
// Invoice DTOs. Amounts are derived server-side from the booking — clients never set money.

import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsEnum } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class CreateInvoiceDto {
  @IsUUID('4', { message: 'A valid bookingId is required' })
  bookingId!: string;
}

export class RegenerateInvoiceDto {
  // Recompute amounts from the current booking before rebuilding the PDF (default: just rebuild PDF).
  @IsOptional() @IsBoolean()
  recomputeTotals?: boolean;
}

export class VoidInvoiceDto {
  @IsString() @IsNotEmpty({ message: 'A void reason is required' }) @MaxLength(500)
  reason!: string;
}

export class InvoiceFilterDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional() @IsString()
  dateFrom?: string;

  @IsOptional() @IsString()
  dateTo?: string;
}
