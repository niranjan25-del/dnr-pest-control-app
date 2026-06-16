// src/modules/pest-categories/pest-categories.controller.ts
//
// /pest-categories — reads any authenticated user; writes ADMIN only.

import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators';
import { PestCategoriesService } from './pest-categories.service';
import { CreatePestCategoryDto, PestCategoryFilterDto, UpdatePestCategoryDto } from './dto';

@Controller({ path: 'pest-categories', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class PestCategoriesController {
  constructor(private readonly pestCategories: PestCategoriesService) {}

  @Get()
  list(@Query() filter: PestCategoryFilterDto) {
    return this.pestCategories.list(filter);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pestCategories.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreatePestCategoryDto) {
    return this.pestCategories.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePestCategoryDto) {
    return this.pestCategories.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.pestCategories.remove(id);
  }
}
