// src/modules/services/service-categories.controller.ts
//
// /service-categories — additive to the named endpoint list, required by the "Service
// Categories" feature set. Reads = any authenticated user; writes = ADMIN.

import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators';
import { ServiceCategoriesService } from './service-categories.service';
import { CategoryFilterDto, CreateServiceCategoryDto, UpdateServiceCategoryDto } from './dto';

@Controller({ path: 'service-categories', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceCategoriesController {
  constructor(private readonly categories: ServiceCategoriesService) {}

  @Get()
  list(@Query() filter: CategoryFilterDto) {
    return this.categories.list(filter);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateServiceCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.remove(id);
  }
}
