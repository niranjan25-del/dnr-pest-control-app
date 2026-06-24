// src/modules/users/users.controller.ts
//
// /users routes. All require a valid access token. Object-level authorization (self vs
// admin) is enforced in the service. DELETE is admin-only.

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators";
import { AuthenticatedUser } from "../auth/interfaces/auth.interfaces";
import { UsersService } from "./users.service";
import { UpdateUserDto } from "./dto";

@Controller({ path: "users", version: "1" })
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  me(@CurrentUser("id") userId: string) {
    return this.users.getMe(userId);
  }

  @Get(":id")
  findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.findById(id, actor);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.update(id, dto, actor);
  }

  @Delete(":id")
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.softDelete(id, actor);
  }
}
