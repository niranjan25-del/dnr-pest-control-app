// src/modules/profiles/profiles.controller.ts
//
// /profiles — each caller manages only their OWN profile (userId comes from the token, never
// the body). Customer routes require role CUSTOMER; technician routes require role
// TECHNICIAN (RolesGuard). Admin manages users via /admin/users.

import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles, CurrentUser } from "../auth/decorators";
import { ProfilesService } from "./profiles.service";
import {
  CreateCustomerProfileDto,
  CreateTechnicianProfileDto,
  UpdateCustomerProfileDto,
  UpdateTechnicianProfileDto,
} from "./dto";

@Controller({ path: "profiles", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  // ----- Customer (own) -----
  @Post("customer")
  @Roles(UserRole.CUSTOMER)
  createCustomer(
    @CurrentUser("id") userId: string,
    @Body() dto: CreateCustomerProfileDto,
  ) {
    return this.profiles.createCustomerProfile(userId, dto);
  }

  @Patch("customer")
  @Roles(UserRole.CUSTOMER)
  updateCustomer(
    @CurrentUser("id") userId: string,
    @Body() dto: UpdateCustomerProfileDto,
  ) {
    return this.profiles.updateCustomerProfile(userId, dto);
  }

  @Get("customer")
  @Roles(UserRole.CUSTOMER)
  getCustomer(@CurrentUser("id") userId: string) {
    return this.profiles.getCustomerProfile(userId);
  }

  // ----- Technician (own) -----
  @Post("technician")
  @Roles(UserRole.TECHNICIAN)
  createTechnician(
    @CurrentUser("id") userId: string,
    @Body() dto: CreateTechnicianProfileDto,
  ) {
    return this.profiles.createTechnicianProfile(userId, dto);
  }

  @Patch("technician")
  @Roles(UserRole.TECHNICIAN)
  updateTechnician(
    @CurrentUser("id") userId: string,
    @Body() dto: UpdateTechnicianProfileDto,
  ) {
    return this.profiles.updateTechnicianProfile(userId, dto);
  }

  @Get("technician")
  @Roles(UserRole.TECHNICIAN)
  getTechnician(@CurrentUser("id") userId: string) {
    return this.profiles.getTechnicianProfile(userId);
  }
}
