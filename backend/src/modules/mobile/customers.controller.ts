// src/modules/mobile/customers.controller.ts
//
// Mobile gateway for the customer namespace. Exposes /customers/me (profile + user fields)
// and /customers/me/addresses (CRUD) using snake_case DTOs that match Flutter's payload
// format. Delegates to ProfilesService, AddressesService, and UsersService; no logic lives
// here beyond field mapping.

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles, CurrentUser } from "../auth/decorators";
import { AuthenticatedUser } from "../auth/interfaces/auth.interfaces";
import { ProfilesService } from "../profiles/profiles.service";
import { AddressesService } from "../addresses/addresses.service";
import { UsersService } from "../users/users.service";

class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(160) full_name?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(160) company_name?: string;
}

class CreateAddressDto {
  @IsOptional() @IsString() @MaxLength(60) label?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) line1!: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsString() @IsNotEmpty() @MaxLength(100) city!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) state!: string;
  @IsString() @IsNotEmpty() @MaxLength(12) postal_code!: string;
  @IsOptional() @IsString() @MaxLength(2) country?: string;
  @IsOptional() @IsString() @MaxLength(500) access_notes?: string;
  @IsOptional() @IsString() @MaxLength(100) gate_code?: string;
  @IsOptional() @IsLatitude() latitude?: number;
  @IsOptional() @IsLongitude() longitude?: number;
  @IsOptional() @IsBoolean() is_default?: boolean;
}

class UpdateAddressDto {
  @IsOptional() @IsString() @MaxLength(60) label?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) line1?: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) state?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(12) postal_code?: string;
  @IsOptional() @IsString() @MaxLength(2) country?: string;
  @IsOptional() @IsString() @MaxLength(500) access_notes?: string;
  @IsOptional() @IsLatitude() latitude?: number;
  @IsOptional() @IsLongitude() longitude?: number;
  @IsOptional() @IsBoolean() is_default?: boolean;
}

@Controller({ path: "customers", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class CustomersController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly addresses: AddressesService,
    private readonly users: UsersService,
  ) {}

  // ----- Profile -----

  @Get("me")
  getProfile(@CurrentUser() actor: AuthenticatedUser) {
    return this.profiles.getCustomerProfile(actor.id);
  }

  @Patch("me")
  async updateProfile(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    if (dto.full_name !== undefined || dto.phone !== undefined) {
      await this.users.update(
        actor.id,
        { fullName: dto.full_name, phone: dto.phone },
        actor,
      );
    }
    if (dto.company_name !== undefined) {
      await this.profiles.updateCustomerProfile(actor.id, {
        companyName: dto.company_name,
      });
    }
    return this.profiles.getCustomerProfile(actor.id);
  }

  // ----- Addresses -----

  @Get("me/addresses")
  listAddresses(@CurrentUser() actor: AuthenticatedUser) {
    return this.addresses.list(actor);
  }

  @Post("me/addresses")
  createAddress(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateAddressDto,
  ) {
    return this.addresses.create(actor, {
      label: dto.label,
      line1: dto.line1,
      line2: dto.line2,
      city: dto.city,
      state: dto.state,
      postalCode: dto.postal_code,
      country: dto.country,
      accessNotes: dto.gate_code
        ? [dto.access_notes, `Gate: ${dto.gate_code}`]
            .filter(Boolean)
            .join(" | ")
        : dto.access_notes,
      latitude: dto.latitude,
      longitude: dto.longitude,
      isDefault: dto.is_default,
    });
  }

  @Patch("me/addresses/:id")
  updateAddress(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addresses.update(id, actor, {
      label: dto.label,
      line1: dto.line1,
      line2: dto.line2,
      city: dto.city,
      state: dto.state,
      postalCode: dto.postal_code,
      country: dto.country,
      accessNotes: dto.access_notes,
      latitude: dto.latitude,
      longitude: dto.longitude,
      isDefault: dto.is_default,
    });
  }

  @Delete("me/addresses/:id")
  deleteAddress(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.addresses.remove(id, actor);
  }
}
