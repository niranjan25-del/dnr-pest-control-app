// src/modules/service-reports/dto/index.ts

import { ReportStatus } from '@prisma/client';
import {
  IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class CreateServiceReportDto {
  @IsUUID('4', { message: 'A valid bookingId is required' })
  bookingId!: string;

  @IsOptional() @IsString() @MaxLength(4000) summary?: string;
  @IsOptional() @IsString() @MaxLength(4000) recommendations?: string;
}

export class ChemicalUsageDto {
  @IsString() @IsNotEmpty({ message: 'chemicalName is required' }) @MaxLength(200)
  chemicalName!: string;

  @IsOptional() @IsString() @MaxLength(60) quantity?: string;   // free-form, e.g. "50 ml"
  @IsOptional() @IsString() @MaxLength(200) area?: string;      // application area
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

// Each provided field REPLACES that item group on the report (deterministic edit).
export class UpdateServiceReportDto {
  @IsOptional() @IsString() @MaxLength(4000) summary?: string;
  @IsOptional() @IsString() @MaxLength(4000) recommendations?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) findings?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) services?: string[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ChemicalUsageDto)
  chemicals?: ChemicalUsageDto[];

  @IsOptional() @IsArray() @IsUUID('4', { each: true }) beforePhotoMediaIds?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) afterPhotoMediaIds?: string[];

  @IsOptional() @IsArray() @IsString({ each: true }) safetyNotes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) regulatoryNotes?: string[];
}

export class SubmitReportDto {
  // Optional acknowledgement note recorded with submission.
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class UploadSignatureDto {
  // PNG signature as a data URL or raw base64 (captured from a canvas).
  @IsString() @IsNotEmpty({ message: 'A signature image is required' })
  imageBase64!: string;

  @IsOptional() @IsString() @MaxLength(160)
  signerName?: string;
}

export class RejectReportDto {
  @IsString() @IsNotEmpty({ message: 'A rejection reason is required' }) @MaxLength(500)
  reason!: string;
}

export class ReportFilterDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(ReportStatus) status?: ReportStatus;
  @IsOptional() @IsUUID('4') bookingId?: string;
  @IsOptional() @IsUUID('4') technicianId?: string;
}
