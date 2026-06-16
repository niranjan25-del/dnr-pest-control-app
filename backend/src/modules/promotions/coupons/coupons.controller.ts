// src/modules/promotions/coupons/coupons.controller.ts
//
// /coupons routes. Reads + write management are ADMIN; validate + redeem are CUSTOMER and
// rate-limited (anti-abuse). Static routes (validate, redeem) precede :id.

import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../../auth/decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { CouponsService } from './coupons.service';
import {
  CouponFilterDto, CreateCouponDto, RedeemCouponDto, UpdateCouponDto, ValidateCouponDto,
} from './dto';

@Controller({ path: 'coupons', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateCouponDto) {
    return this.coupons.create(dto, actor.id);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  list(@Query() filter: CouponFilterDto) {
    return this.coupons.list(filter);
  }

  // --- static routes before :id ---
  @Post('validate')
  @Roles(UserRole.CUSTOMER)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  validate(@CurrentUser() actor: AuthenticatedUser, @Body() dto: ValidateCouponDto) {
    return this.coupons.validate(actor, dto);
  }

  @Post('redeem')
  @Roles(UserRole.CUSTOMER)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  redeem(@CurrentUser() actor: AuthenticatedUser, @Body() dto: RedeemCouponDto) {
    return this.coupons.redeem(actor, dto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.coupons.findOne(id);
  }

  @Get(':id/performance')
  @Roles(UserRole.ADMIN)
  performance(@Param('id', ParseUUIDPipe) id: string) {
    return this.coupons.performance(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser, @Body() dto: UpdateCouponDto) {
    return this.coupons.update(id, dto, actor.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.coupons.remove(id, actor.id);
  }
}
