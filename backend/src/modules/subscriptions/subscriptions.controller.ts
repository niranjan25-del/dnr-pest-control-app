// src/modules/subscriptions/subscriptions.controller.ts
//
// /subscriptions routes. Customers manage their own; admins have full access (reads scoped in
// the service). Plan change uses one DTO for both upgrade and downgrade (target plan decides
// direction). Two admin trigger endpoints (process-renewals, send-reminders) let a cron/ops
// job drive renewals without embedding a scheduler — declared before :id.

import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../auth/decorators';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { SubscriptionsService } from './subscriptions.service';
import { RenewalService } from './renewal.service';
import {
  CancelSubscriptionDto, ChangePlanDto, CreateSubscriptionDto, PauseSubscriptionDto,
  SubscriptionFilterDto,
} from './dto';

@Controller({ path: 'subscriptions', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly renewal: RenewalService,
  ) {}

  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateSubscriptionDto) {
    return this.subscriptions.create(actor, dto);
  }

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser, @Query() filter: SubscriptionFilterDto) {
    return this.subscriptions.list(actor, filter);
  }

  // --- ops triggers (admin) — declared before :id ---
  @Post('process-renewals')
  @Roles(UserRole.ADMIN)
  processRenewals() {
    return this.renewal.processDueRenewals();
  }

  @Post('send-reminders')
  @Roles(UserRole.ADMIN)
  sendReminders() {
    return this.renewal.sendRenewalReminders();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.subscriptions.findById(id, actor);
  }

  @Post(':id/pause')
  pause(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser, @Body() dto: PauseSubscriptionDto) {
    return this.subscriptions.pause(id, actor, dto.reason);
  }

  @Post(':id/resume')
  resume(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.subscriptions.resume(id, actor);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser, @Body() dto: CancelSubscriptionDto) {
    return this.subscriptions.cancel(id, actor, dto);
  }

  @Post(':id/upgrade')
  upgrade(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser, @Body() dto: ChangePlanDto) {
    return this.subscriptions.changePlan(id, actor, dto);
  }

  @Post(':id/downgrade')
  downgrade(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser, @Body() dto: ChangePlanDto) {
    return this.subscriptions.changePlan(id, actor, dto);
  }
}
