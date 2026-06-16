// src/modules/promotions/promotions/promotions.controller.ts
//
// /promotions routes. GET is open to any authenticated user (active promotions view).
// Create/update/activate/deactivate/delete are ADMIN campaign management. Static activate/
// deactivate routes precede :id.

import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../../auth/decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto, UpdatePromotionDto } from './dto';

@Controller({ path: 'promotions', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  listActive() {
    return this.promotions.listActive();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreatePromotionDto) {
    return this.promotions.create(dto, actor.id);
  }

  @Get(':id/performance')
  @Roles(UserRole.ADMIN)
  performance(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotions.performance(id);
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN)
  activate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.promotions.setActive(id, true, actor.id);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN)
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.promotions.setActive(id, false, actor.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser, @Body() dto: UpdatePromotionDto) {
    return this.promotions.update(id, dto, actor.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.promotions.remove(id, actor.id);
  }
}
