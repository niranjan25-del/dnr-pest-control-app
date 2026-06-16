// src/modules/technician-assignment/technician-assignment.controller.ts
//
// /assignments routes. Reads are role-scoped in the service. Writes: assign/reassign/cancel +
// dashboards are ADMIN; accept/reject are TECHNICIAN (own). Static dashboard routes precede
// :id so they aren't captured by the UUID matcher.

import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../auth/decorators';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { TechnicianAssignmentService } from './technician-assignment.service';
import {
  AssignmentFilterDto, AssignTechnicianDto, AvailableTechniciansQueryDto, RejectAssignmentDto,
  ReassignTechnicianDto, TechnicianAvailabilityDto,
} from './dto';

@Controller({ path: 'assignments', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class TechnicianAssignmentController {
  constructor(private readonly assignments: TechnicianAssignmentService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  assign(@CurrentUser() actor: AuthenticatedUser, @Body() dto: AssignTechnicianDto) {
    return this.assignments.assign(actor, dto);
  }

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser, @Query() filter: AssignmentFilterDto) {
    return this.assignments.list(actor, filter);
  }

  // --- dashboard (admin) — declared before :id ---
  @Get('unassigned')
  @Roles(UserRole.ADMIN)
  unassigned(@Query() filter: AssignmentFilterDto) {
    return this.assignments.unassignedBookings(filter);
  }

  @Get('workloads')
  @Roles(UserRole.ADMIN)
  workloads() {
    return this.assignments.workloads();
  }

  @Get('available-technicians')
  @Roles(UserRole.ADMIN)
  availableTechnicians(@Query() query: AvailableTechniciansQueryDto) {
    return this.assignments.availableTechnicians(query.bookingId);
  }

  // --- technician self availability (additive) ---
  @Patch('availability')
  @Roles(UserRole.TECHNICIAN)
  setAvailability(@CurrentUser() actor: AuthenticatedUser, @Body() dto: TechnicianAvailabilityDto) {
    return this.assignments.setOwnAvailability(actor, dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.assignments.findById(id, actor);
  }

  @Patch(':id/reassign')
  @Roles(UserRole.ADMIN)
  reassign(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser, @Body() dto: ReassignTechnicianDto) {
    return this.assignments.reassign(id, actor, dto);
  }

  @Patch(':id/accept')
  @Roles(UserRole.TECHNICIAN, UserRole.ADMIN)
  accept(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.assignments.accept(id, actor);
  }

  @Patch(':id/reject')
  @Roles(UserRole.TECHNICIAN, UserRole.ADMIN)
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser, @Body() dto: RejectAssignmentDto) {
    return this.assignments.reject(id, actor, dto.reason);
  }

  // Additive (flagged): "Remove assignment" feature → admin cancels an assignment.
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.assignments.cancel(id, actor);
  }
}
