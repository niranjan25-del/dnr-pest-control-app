// src/modules/analytics/dto/index.ts

import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ExportFormat, Granularity, ReportType } from '../enums';

// Shared date-range filter (ISO datetime strings). Defaults applied in the service.
export class DateRangeDto {
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  // Accepted (and ignored) on endpoints that don't use granularity so the frontend can
  // always send a uniform params object without triggering forbidNonWhitelisted errors.
  @IsOptional() @IsEnum(Granularity) granularity?: Granularity;
}

export class DashboardFilterDto extends DateRangeDto {}

export class RevenueReportDto extends DateRangeDto {
  @IsOptional() @IsUUID('4') serviceId?: string;
  @IsOptional() @IsUUID('4') technicianId?: string;
}

export class BookingReportDto extends DateRangeDto {
  @IsOptional() @IsUUID('4') serviceId?: string;
  @IsOptional() @IsUUID('4') technicianId?: string;
}

export class TechnicianReportDto extends DateRangeDto {
  @IsOptional() @IsUUID('4') technicianId?: string;
}

export class CustomerReportDto extends DateRangeDto {}

export class ExportReportDto extends DateRangeDto {
  @IsEnum(ReportType, { message: 'Invalid report type' })
  reportType!: ReportType;

  @IsEnum(ExportFormat, { message: 'format must be CSV, EXCEL, or PDF' })
  format!: ExportFormat;

  @IsOptional() @IsUUID('4') serviceId?: string;
  @IsOptional() @IsUUID('4') technicianId?: string;
}
