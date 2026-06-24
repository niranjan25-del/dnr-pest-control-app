// src/modules/addresses/dto/index.ts
//
// Address DTOs. Coordinates are optional on input — if omitted (and geocoding is enabled),
// the service geocodes line1+city+state+postalCode to fill them. If the client supplies
// coordinates they're trusted.

import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  @IsString()
  @IsNotEmpty({ message: "Address line 1 is required" })
  @MaxLength(200)
  line1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @IsString()
  @IsNotEmpty({ message: "City is required" })
  @MaxLength(100)
  city!: string;

  @IsString()
  @IsNotEmpty({ message: "State is required" })
  @MaxLength(100)
  state!: string;

  @IsString()
  @IsNotEmpty({ message: "Postal/ZIP code is required" })
  @MaxLength(12)
  postalCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string; // ISO-2; defaults to 'IN'

  @IsOptional()
  @IsString()
  @MaxLength(500)
  accessNotes?: string;

  @IsOptional()
  @IsLatitude({ message: "latitude must be a valid coordinate" })
  latitude?: number;

  @IsOptional()
  @IsLongitude({ message: "longitude must be a valid coordinate" })
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsOptional() @IsString() @MaxLength(60) label?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) line1?: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) state?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(12) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(2) country?: string;
  @IsOptional() @IsString() @MaxLength(500) accessNotes?: string;
  @IsOptional() @IsLatitude() latitude?: number;
  @IsOptional() @IsLongitude() longitude?: number;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
