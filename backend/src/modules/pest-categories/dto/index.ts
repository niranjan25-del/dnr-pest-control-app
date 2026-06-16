// src/modules/pest-categories/dto/index.ts
//
// Pest category DTOs (e.g. Ants, Cockroaches, Rodents, Bed Bugs, Mosquitoes, Termites).
// Slugs are generated server-side.

import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class CreatePestCategoryDto {
  @IsString() @IsNotEmpty({ message: 'Pest category name is required' }) @MaxLength(120)
  name!: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @IsOptional() @IsString()
  iconUrl?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdatePestCategoryDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120)
  name?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @IsOptional() @IsString()
  iconUrl?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class PestCategoryFilterDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === true ? true : value === 'false' || value === false ? false : undefined)
  @IsBoolean()
  isActive?: boolean;
}
