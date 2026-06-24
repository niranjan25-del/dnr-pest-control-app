// src/modules/users/admin-users.controller.ts
//
// /admin/users — admin-only directory + status/role management. Class-level @Roles(ADMIN)
// + RolesGuard gate the whole controller; the service additionally requires SUPER_ADMIN for
// role changes and account creation (privilege-escalation control).

import {
  Body,
  Controller,
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
import { AuthenticatedUser } from "../auth/interfaces/auth.interfaces";
import { UsersService } from "./users.service";
import {
  CreateAdminDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UserFilterDto,
} from "./dto";

@Controller({ path: "admin/users", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() filter: UserFilterDto) {
    return this.users.list(filter);
  }

  @Post()
  createAdmin(
    @Body() dto: CreateAdminDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.createAdmin(dto, actor);
  }

  @Patch(":id/status")
  setStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.setStatus(id, dto, actor);
  }

  @Patch(":id/role")
  setRole(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.setRole(id, dto, actor);
  }
}
