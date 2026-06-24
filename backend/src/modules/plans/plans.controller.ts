// src/modules/plans/plans.controller.ts
//
// /plans — reads any authenticated user; writes ADMIN.

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
import { PlansService } from "./plans.service";
import { CreatePlanDto, PlanFilterDto, UpdatePlanDto } from "./dto";

@Controller({ path: "plans", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list(@Query() filter: PlanFilterDto) {
    return this.plans.list(filter);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.plans.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreatePlanDto) {
    return this.plans.create(dto);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN)
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.plans.update(id, dto);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.plans.remove(id);
  }
}
