// src/modules/addresses/addresses.controller.ts
//
// /addresses — customer-owned. All routes require auth; ownership is resolved from the
// caller's CustomerProfile in the service. The static :id/eligibility + :id/default routes
// sit alongside the id routes (distinct suffixes, so no matcher collision).

import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../auth/decorators';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto';

@Controller({ path: 'addresses', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Post()
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateAddressDto) {
    return this.addresses.create(actor, dto);
  }

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.addresses.list(actor);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.addresses.findOne(id, actor);
  }

  @Get(':id/eligibility')
  eligibility(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.addresses.checkEligibility(id, actor);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser, @Body() dto: UpdateAddressDto) {
    return this.addresses.update(id, actor, dto);
  }

  @Patch(':id/default')
  setDefault(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.addresses.setDefault(id, actor);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.addresses.remove(id, actor);
  }
}
