// src/modules/bookings/dto/index.ts
//
// Booking DTOs. A booking targets either a service OR a package (validated in the service).
// Scheduling is expressed as an ISO start datetime; the window end is computed from the
// service/package duration + buffer. Customer/address ids are validated for ownership.

import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique, IsArray, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID,
  MaxLength,
} from 'class-validator';
import { BookingPriority, BookingStatus } from '@prisma/client';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class CreateBookingDto {
  // Admin may book on behalf of a customer; for CUSTOMER callers this is ignored and the
  // caller's own profile is used.
  @IsOptional() @IsUUID('4')
  customerId?: string;

  @IsOptional() @IsUUID('4', { message: 'serviceId must be a valid id' })
  serviceId?: string;

  @IsOptional() @IsUUID('4', { message: 'packageId must be a valid id' })
  packageId?: string;

  @IsUUID('4', { message: 'A valid addressId is required' })
  addressId!: string;

  // Preferred start of the service window (ISO 8601, e.g. 2026-06-10T10:00:00+05:30).
  @IsDateString({}, { message: 'scheduledStart must be a valid ISO datetime' })
  scheduledStart!: string;

  @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;

  @IsOptional() @IsEnum(BookingPriority)
  priority?: BookingPriority;

  // References to already-uploaded MediaFile rows to attach to this booking.
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true })
  imageMediaIds?: string[];
}

export class UpdateBookingDto {
  @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;

  // Admin-only address change (validated in service).
  @IsOptional() @IsUUID('4')
  addressId?: string;
}

export class RescheduleBookingDto {
  @IsDateString({}, { message: 'scheduledStart must be a valid ISO datetime' })
  scheduledStart!: string;

  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

export class CancelBookingDto {
  @IsString() @IsNotEmpty({ message: 'A cancellation reason is required' }) @MaxLength(500)
  reason!: string;
}

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus, { message: 'Invalid booking status' })
  status!: BookingStatus;

  @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

export class BookingFilterDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional() @IsUUID('4')
  serviceId?: string;

  @IsOptional() @IsUUID('4')
  categoryId?: string;

  @IsOptional() @IsUUID('4')
  technicianId?: string;

  @IsOptional() @IsDateString()
  dateFrom?: string;

  @IsOptional() @IsDateString()
  dateTo?: string;

  // Admin-only: filter by customer User.id
  @IsOptional() @IsString()
  customer_id?: string;
}
