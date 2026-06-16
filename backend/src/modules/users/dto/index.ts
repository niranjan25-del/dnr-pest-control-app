// src/modules/users/dto/index.ts
//
// DTOs for user management. Validation + messages; the global ValidationPipe
// (forbidNonWhitelisted) rejects unknown fields, so a client cannot smuggle extra columns.

import { AdminRole, UserRole, UserStatus } from '@prisma/client';
import {
  ArrayUnique, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

// Self-updatable identity fields (name lives on User.fullName — the schema stores a single
// full name, not first/last; expose fullName here).
export class UpdateUserDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120)
  fullName?: string;

  @IsOptional() @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Phone must be a valid international number' })
  phone?: string;
}

export class UpdateUserStatusDto {
  @IsEnum(UserStatus, { message: 'status must be ACTIVE, SUSPENDED, or DEACTIVATED' })
  status!: UserStatus;

  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

export class UpdateUserRoleDto {
  @IsEnum(UserRole, { message: 'role must be CUSTOMER, TECHNICIAN, or ADMIN' })
  role!: UserRole;

  @IsOptional()
  @IsEnum(AdminRole, { message: 'adminRole must be a valid admin sub-role' })
  adminRole?: AdminRole;

  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true })
  permissions?: string[];
}

// List filters — extends pagination (page/limit/sort/order/search).
export class UserFilterDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional() @IsEnum(UserStatus)
  status?: UserStatus;
}
