// src/modules/location/dto/index.ts

import { IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

class Coordinates {
  @IsNumber({}, { message: 'latitude must be a number' }) @Min(-90, { message: 'Invalid coordinates' }) @Max(90, { message: 'Invalid coordinates' })
  latitude!: number;

  @IsNumber({}, { message: 'longitude must be a number' }) @Min(-180, { message: 'Invalid coordinates' }) @Max(180, { message: 'Invalid coordinates' })
  longitude!: number;
}

export class StartTrackingDto {
  // Optional active job to associate the session with.
  @IsOptional() @IsUUID('4')
  bookingId?: string;
}

export class UpdateLocationDto extends Coordinates {
  @IsOptional() @IsNumber() @Min(0)
  accuracy?: number;

  @IsOptional() @IsUUID('4')
  bookingId?: string;
}

export class CheckInDto extends Coordinates {
  @IsUUID('4', { message: 'A valid bookingId is required' })
  bookingId!: string;
}

export class CheckOutDto {
  @IsUUID('4', { message: 'A valid bookingId is required' })
  bookingId!: string;

  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class TrackingFilterDto extends PaginationQueryDto {
  @IsOptional() @IsString() from?: string; // ISO datetime
  @IsOptional() @IsString() to?: string;
  @IsOptional() @Type(() => String) @IsUUID('4') bookingId?: string;
}
