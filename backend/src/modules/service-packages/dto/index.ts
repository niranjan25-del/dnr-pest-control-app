// src/modules/service-packages/dto/index.ts
//
// Package DTOs. A package bundles services (with quantities) at a set price. NOTE: the
// approved schema has no discountPercentage/duration columns — those are DERIVED in
// responses (discount vs sum of included base prices; duration = sum of service durations).
// So create/update accept only `price` + `services`; do not accept a discount/duration here.

import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";

export class IncludedServiceDto {
  @IsUUID("4", { message: "serviceId must be a valid id" })
  serviceId!: string;

  @IsInt()
  @Min(1, { message: "quantity must be at least 1" })
  quantity!: number;
}

export class CreatePackageDto {
  @IsString()
  @IsNotEmpty({ message: "Package name is required" })
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: "Price must have at most 2 decimals" },
  )
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ArrayMinSize(1, { message: "A package must include at least one service" })
  @ValidateNested({ each: true })
  @Type(() => IncludedServiceDto)
  services!: IncludedServiceDto[];
}

export class UpdatePackageDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // If provided, replaces the package's included-services set.
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => IncludedServiceDto)
  services?: IncludedServiceDto[];
}

export class PackageFilterDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    value === "true" || value === true
      ? true
      : value === "false" || value === false
        ? false
        : undefined,
  )
  @IsBoolean()
  isActive?: boolean;
}
