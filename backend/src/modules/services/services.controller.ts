// src/modules/services/services.controller.ts
//
// /services — reads open to any authenticated user (customers + technicians browse); writes
// (create/update/delete/activate/deactivate) require ADMIN via RolesGuard.

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
import { Roles, CurrentUser } from "../auth/decorators";
import { ServicesService } from "./services.service";
import { CreateServiceDto, ServiceFilterDto, UpdateServiceDto } from "./dto";

@Controller({ path: "services", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  list(@Query() filter: ServiceFilterDto) {
    return this.services.list(filter);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.services.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateServiceDto, @CurrentUser("id") actorId: string) {
    return this.services.create(dto, actorId);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN)
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser("id") actorId: string,
  ) {
    return this.services.update(id, dto, actorId);
  }

  @Patch(":id/activate")
  @Roles(UserRole.ADMIN)
  activate(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("id") actorId: string,
  ) {
    return this.services.setActive(id, true, actorId);
  }

  @Patch(":id/deactivate")
  @Roles(UserRole.ADMIN)
  deactivate(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("id") actorId: string,
  ) {
    return this.services.setActive(id, false, actorId);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("id") actorId: string,
  ) {
    return this.services.remove(id, actorId);
  }
}
