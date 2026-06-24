// src/modules/service-areas/dto/index.ts
//
// Service-area DTOs, mapped to the APPROVED schema (name, postalCodes[], optional technician).
//
// ⚠ SCHEMA-PENDING (flagged, not accepted here): the requirements mention coverage radius,
// center coordinates, active status, and restricted areas — none exist as columns on
// ServiceArea. To support radius coverage + an explicit active flag, add to schema.prisma:
//     centerLatitude  Decimal?  @db.Decimal(9,6)
//     centerLongitude Decimal?  @db.Decimal(9,6)
//     coverageRadiusKm Decimal? @db.Decimal(6,2)
//     isActive        Boolean   @default(true)
//     isRestricted    Boolean   @default(false)
// Until then: coverage = postal-code membership, and activate/deactivate use deletedAt.

import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";

export class CreateServiceAreaDto {
  @IsString()
  @IsNotEmpty({ message: "Area name is required" })
  @MaxLength(120)
  name!: string;

  @IsArray()
  @ArrayMinSize(1, { message: "At least one postal code is required" })
  @ArrayUnique()
  @IsString({ each: true })
  postalCodes!: string[];

  @IsOptional()
  @IsUUID("4", { message: "technicianId must be a valid id" })
  technicianId?: string;
}

export class UpdateServiceAreaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  postalCodes?: string[];

  @IsOptional()
  @IsUUID("4")
  technicianId?: string;
}

export class ServiceAreaFilterDto extends PaginationQueryDto {}

export class CoverageQueryDto {
  @IsString()
  @IsNotEmpty({ message: "postalCode is required" })
  @MaxLength(12)
  postalCode!: string;
}
