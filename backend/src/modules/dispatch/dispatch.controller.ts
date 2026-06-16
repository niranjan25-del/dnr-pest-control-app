// src/modules/dispatch/dispatch.controller.ts
// Dispatch façade: booking-centric paths (/dispatch/bookings/:id/...) that map to the
// assignment service. Lets the admin dashboard use booking IDs (natural for a board view)
// instead of looking up assignment IDs first. Reassign resolves the active assignment
// for the booking and delegates to the core reassign logic.

import {
  BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe,
  Post, Query, UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../auth/decorators';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { PrismaService } from 'src/database/prisma.service';
import { TechnicianAssignmentService } from '../technician-assignment/technician-assignment.service';
import { AssignmentFilterDto } from '../technician-assignment/dto';
import { ACTIVE_ASSIGNMENT_STATUSES } from '../technician-assignment/enums';

class DispatchAssignDto {
  @IsUUID('4')
  technicianId!: string;
}

class DispatchReassignDto {
  @IsOptional() @IsUUID('4')
  technicianId?: string;

  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

@Controller({ path: 'dispatch', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class DispatchController {
  constructor(
    private readonly assignments: TechnicianAssignmentService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('unassigned')
  unassigned(@Query() filter: AssignmentFilterDto) {
    return this.assignments.unassignedBookings(filter);
  }

  @Get('workloads')
  workloads() {
    return this.assignments.workloads();
  }

  @Get('bookings/:id/candidates')
  candidates(@Param('id', ParseUUIDPipe) bookingId: string) {
    return this.assignments.availableTechnicians(bookingId);
  }

  @Post('bookings/:id/assign')
  async assign(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Body() dto: DispatchAssignDto,
  ) {
    return this.assignments.assign(actor, { bookingId, technicianId: dto.technicianId });
  }

  @Post('bookings/:id/reassign')
  async reassign(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Body() dto: DispatchReassignDto,
  ) {
    const active = await this.prisma.technicianAssignment.findFirst({
      where: { bookingId, status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
      select: { id: true },
    });
    if (!active) {
      throw new NotFoundException({ code: 'NO_ACTIVE_ASSIGNMENT', message: 'No active assignment found for this booking' });
    }
    return this.assignments.reassign(active.id, actor, {
      technicianId: dto.technicianId,
      reason: dto.reason ?? 'Reassigned via dispatch board',
    });
  }
}
