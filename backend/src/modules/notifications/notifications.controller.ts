// src/modules/notifications/notifications.controller.ts
//
// /notifications routes. Center + device + preference operations are scoped to the caller
// (any authenticated role manages their own). send + broadcast are ADMIN. Static routes are
// declared before parameterized ones so segments like 'unread', 'read-all', 'device/...',
// 'preferences', and 'broadcast' aren't captured by :id.

import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../auth/decorators';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { NotificationsService } from './notifications.service';
import {
  BroadcastNotificationDto, NotificationFilterDto, NotificationPreferenceDto, RegisterDeviceDto, SendNotificationDto,
} from './dto';

@Controller({ path: 'notifications', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // ----- admin send / broadcast -----
  @Post('send')
  @Roles(UserRole.ADMIN)
  send(@Body() dto: SendNotificationDto) {
    return this.notifications.send(dto);
  }

  @Post('broadcast')
  @Roles(UserRole.ADMIN)
  broadcast(@Body() dto: BroadcastNotificationDto) {
    return this.notifications.broadcast(dto);
  }

  // ----- notification center (own) -----
  @Get()
  list(@CurrentUser() actor: AuthenticatedUser, @Query() filter: NotificationFilterDto) {
    return this.notifications.list(actor, filter);
  }

  @Get('unread')
  unread(@CurrentUser() actor: AuthenticatedUser) {
    return this.notifications.unread(actor);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() actor: AuthenticatedUser) {
    return this.notifications.markAllRead(actor);
  }

  // Mobile alias: Flutter uses POST instead of PATCH.
  @Post('read-all')
  markAllReadPost(@CurrentUser() actor: AuthenticatedUser) {
    return this.notifications.markAllRead(actor);
  }

  // ----- preferences (own) -----
  @Patch('preferences')
  updatePreferences(@CurrentUser() actor: AuthenticatedUser, @Body() dto: NotificationPreferenceDto) {
    return this.notifications.updatePreferences(actor, dto);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() actor: AuthenticatedUser) {
    return this.notifications.getPreferences(actor);
  }

  // ----- devices (own) -----
  @Post('device/register')
  registerDevice(@CurrentUser() actor: AuthenticatedUser, @Body() dto: RegisterDeviceDto) {
    return this.notifications.registerDevice(actor, dto);
  }

  @Delete('device/:token')
  removeDevice(@CurrentUser() actor: AuthenticatedUser, @Param('token') token: string) {
    return this.notifications.removeDevice(actor, token);
  }

  // ----- parameterized (own) -----
  @Patch(':id/read')
  markRead(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(actor, id);
  }

  @Delete(':id')
  remove(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.remove(actor, id);
  }
}
