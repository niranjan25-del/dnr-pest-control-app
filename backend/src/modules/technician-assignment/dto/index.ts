// src/modules/technician-assignment/dto/index.ts
//
// Dispatch DTOs. Assign accepts either an explicit technicianId (manual) or auto=true (engine
// picks). overrideConstraints lets an admin bypass soft matching (area/skill/workload) when
// they know better; hard safety checks (availability/conflict) still apply unless noted.

import { AssignmentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class AssignTechnicianDto {
  @IsUUID('4', { message: 'A valid bookingId is required' })
  bookingId!: string;

  // Omit (or set auto=true) to let the engine choose.
  @IsOptional() @IsUUID('4')
  technicianId?: string;

  @IsOptional() @IsBoolean()
  auto?: boolean;

  @IsOptional() @IsBoolean()
  overrideConstraints?: boolean;

  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

export class ReassignTechnicianDto {
  @IsOptional() @IsUUID('4')
  technicianId?: string;

  @IsOptional() @IsBoolean()
  auto?: boolean;

  @IsString() @IsNotEmpty({ message: 'A reassignment reason is required' }) @MaxLength(500)
  reason!: string;

  @IsOptional() @IsBoolean()
  overrideConstraints?: boolean;
}

// Technician toggles their own availability (working hours / time off are schema-pending).
export class TechnicianAvailabilityDto {
  @IsBoolean({ message: 'isAvailable must be a boolean' })
  isAvailable!: boolean;
}

export class AssignmentFilterDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(AssignmentStatus)
  status?: AssignmentStatus;

  @IsOptional() @IsUUID('4')
  technicianId?: string;

  @IsOptional() @IsUUID('4')
  bookingId?: string;

  @IsOptional() @IsDateString()
  dateFrom?: string;

  @IsOptional() @IsDateString()
  dateTo?: string;
}

// For GET /assignments/available-technicians?bookingId=...
export class AvailableTechniciansQueryDto {
  @IsOptional() @IsUUID('4')
  bookingId?: string;
}

export class RejectAssignmentDto {
  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}
