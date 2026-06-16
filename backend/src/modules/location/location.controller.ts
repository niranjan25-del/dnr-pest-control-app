// src/modules/location/location.controller.ts
//
// /location routes. Technician-only actions (start/stop/update/check-in/check-out) and view
// endpoints for customers/admins are authorized inside the service. Update is rate-limited to
// blunt high-frequency abuse (see scalability notes for the durable approach).

import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { LocationService } from './location.service';
import { CheckInDto, CheckOutDto, StartTrackingDto, TrackingFilterDto, UpdateLocationDto } from './dto';

@Controller({ path: 'location', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocationController {
  constructor(private readonly location: LocationService) {}

  @Post('start-tracking')
  startTracking(@CurrentUser() actor: AuthenticatedUser, @Body() dto: StartTrackingDto) {
    return this.location.startTracking(actor, dto);
  }

  @Post('stop-tracking')
  stopTracking(@CurrentUser() actor: AuthenticatedUser) {
    return this.location.stopTracking(actor);
  }

  @Post('update')
  @Throttle({ default: { limit: 120, ttl: 60_000 } }) // ~2/sec ceiling per technician
  update(@CurrentUser() actor: AuthenticatedUser, @Body() dto: UpdateLocationDto) {
    return this.location.updateLocation(actor, dto);
  }

  @Post('check-in')
  checkIn(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CheckInDto) {
    return this.location.checkIn(actor, dto);
  }

  @Post('check-out')
  checkOut(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CheckOutDto) {
    return this.location.checkOut(actor, dto);
  }

  @Get('current/:technicianId')
  current(@CurrentUser() actor: AuthenticatedUser, @Param('technicianId', ParseUUIDPipe) technicianId: string) {
    return this.location.getCurrent(actor, technicianId);
  }

  @Get('history/:technicianId')
  history(@CurrentUser() actor: AuthenticatedUser, @Param('technicianId', ParseUUIDPipe) technicianId: string, @Query() filter: TrackingFilterDto) {
    return this.location.getHistory(actor, technicianId, filter);
  }

  @Get('eta/:bookingId')
  eta(@CurrentUser() actor: AuthenticatedUser, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.location.getEta(actor, bookingId);
  }
}
