// src/modules/profiles/dto/index.ts
//
// Customer + technician profile DTOs, mapped to the APPROVED schema columns.
//
// ⚠ SCHEMA-PENDING (flagged, not persisted): the task lists some fields that have no column
// in the approved Step-2 schema. They are intentionally NOT accepted here (to avoid silently
// dropping data). To support them, add to schema.prisma and re-run migrate, then extend
// these DTOs:
//   CustomerProfile: dateOfBirth DateTime?, preferredContactMethod enum(EMAIL|PHONE|SMS),
//                    (first/last name — schema uses a single User.fullName)
//   TechnicianProfile: certifications Json[] / a Certification model, emergencyContactName,
//                    emergencyContactPhone, availabilitySchedule Json
// Name/phone/email are USER-level fields — update them via PATCH /users/:id, not here.

import { CustomerType } from "@prisma/client";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateCustomerProfileDto {
  @IsOptional()
  @IsEnum(CustomerType, {
    message: "customerType must be RESIDENTIAL or COMMERCIAL",
  })
  customerType?: CustomerType;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;
}

export class UpdateCustomerProfileDto {
  @IsOptional()
  @IsEnum(CustomerType)
  customerType?: CustomerType;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;
}

export class CreateTechnicianProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  licenseNumber?: string;

  @IsOptional()
  @IsDateString({}, { message: "licenseExpiry must be an ISO date" })
  licenseExpiry?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  skills?: string[];
}

export class UpdateTechnicianProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  licenseNumber?: string;

  @IsOptional()
  @IsDateString({}, { message: "licenseExpiry must be an ISO date" })
  licenseExpiry?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  // Assign the technician to existing ServiceArea rows (by id).
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  serviceAreaIds?: string[];
}
