// src/modules/service-packages/service-packages.controller.ts
//
// /packages — reads any authenticated user; writes (create/update/delete/activate/
// deactivate) require ADMIN.

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
import { ServicePackagesService } from "./service-packages.service";
import { CreatePackageDto, PackageFilterDto, UpdatePackageDto } from "./dto";

@Controller({ path: "packages", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServicePackagesController {
  constructor(private readonly packages: ServicePackagesService) {}

  @Get()
  list(@Query() filter: PackageFilterDto) {
    return this.packages.list(filter);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.packages.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreatePackageDto, @CurrentUser("id") actorId: string) {
    return this.packages.create(dto, actorId);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN)
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePackageDto,
    @CurrentUser("id") actorId: string,
  ) {
    return this.packages.update(id, dto, actorId);
  }

  @Patch(":id/activate")
  @Roles(UserRole.ADMIN)
  activate(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("id") actorId: string,
  ) {
    return this.packages.setActive(id, true, actorId);
  }

  @Patch(":id/deactivate")
  @Roles(UserRole.ADMIN)
  deactivate(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("id") actorId: string,
  ) {
    return this.packages.setActive(id, false, actorId);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("id") actorId: string,
  ) {
    return this.packages.remove(id, actorId);
  }
}
