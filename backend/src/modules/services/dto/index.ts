// src/modules/services/dto/index.ts
//
// DTOs for services + service categories. Money is validated to 2 decimals; slugs are
// generated server-side (not accepted from clients). The global ValidationPipe rejects
// unknown fields.

import { Transform, Type } from 'class-transformer';
import {
  IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

// ---- Service Category ----
export class CreateServiceCategoryDto {
  @IsString() @IsNotEmpty({ message: 'Category name is required' }) @MaxLength(120)
  name!: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @IsOptional() @IsString()
  iconUrl?: string;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateServiceCategoryDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120)
  name?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @IsOptional() @IsString()
  iconUrl?: string;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

// ---- Service ----
export class CreateServiceDto {
  @IsString() @IsNotEmpty({ message: 'Service name is required' }) @MaxLength(150)
  name!: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsInt({ message: 'Duration must be an integer number of minutes' }) @Min(1)
  estimatedDurationMin!: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Base price must have at most 2 decimals' }) @Min(0)
  basePrice!: number;

  @IsOptional() @IsString() @MaxLength(3)
  currency?: string;

  @IsUUID('4', { message: 'A valid service category id is required' })
  categoryId!: string;

  @IsOptional() @IsUUID('4', { message: 'pestCategoryId must be a valid id' })
  pestCategoryId?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateServiceDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(150)
  name?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsOptional() @IsInt() @Min(1)
  estimatedDurationMin?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  basePrice?: number;

  @IsOptional() @IsString() @MaxLength(3)
  currency?: string;

  @IsOptional() @IsUUID('4')
  categoryId?: string;

  @IsOptional() @IsUUID('4')
  pestCategoryId?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

// ---- Filters ----
const toBool = ({ value }: { value: unknown }) =>
  value === 'true' || value === true ? true : value === 'false' || value === false ? false : undefined;

export class ServiceFilterDto extends PaginationQueryDto {
  @IsOptional() @IsUUID('4')
  categoryId?: string;

  @IsOptional() @IsUUID('4')
  pestCategoryId?: string;

  @IsOptional() @Transform(toBool) @IsBoolean()
  isActive?: boolean;
}

export class CategoryFilterDto extends PaginationQueryDto {
  @IsOptional() @Transform(toBool) @IsBoolean()
  isActive?: boolean;
}
