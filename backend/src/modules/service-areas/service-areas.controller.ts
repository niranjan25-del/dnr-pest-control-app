// src/modules/service-areas/service-areas.controller.ts
//
// /service-areas — management is ADMIN-only; the coverage check is available to any
// authenticated user (used by the booking/eligibility flow). The static `coverage` route is
// declared before :id.

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators";
import { ServiceAreasService } from "./service-areas.service";
import {
  CoverageQueryDto,
  CreateServiceAreaDto,
  ServiceAreaFilterDto,
  UpdateServiceAreaDto,
} from "./dto";

@Controller({ path: "service-areas", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceAreasController {
  constructor(private readonly serviceAreas: ServiceAreasService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  list(@Query() filter: ServiceAreaFilterDto) {
    return this.serviceAreas.list(filter);
  }

  // Any authenticated user — used to validate booking eligibility by postal code.
  @Get("coverage")
  coverage(@Query() query: CoverageQueryDto) {
    return this.serviceAreas.checkCoverage(query.postalCode);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateServiceAreaDto) {
    return this.serviceAreas.create(dto);
  }

  @Get(":id")
  @Roles(UserRole.ADMIN)
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.serviceAreas.findOne(id);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN)
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceAreaDto,
  ) {
    return this.serviceAreas.update(id, dto);
  }

  @Patch(":id/activate")
  @Roles(UserRole.ADMIN)
  activate(@Param("id", ParseUUIDPipe) id: string) {
    return this.serviceAreas.setActive(id, true);
  }

  @Patch(":id/deactivate")
  @Roles(UserRole.ADMIN)
  deactivate(@Param("id", ParseUUIDPipe) id: string) {
    return this.serviceAreas.setActive(id, false);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.serviceAreas.remove(id);
  }
}
