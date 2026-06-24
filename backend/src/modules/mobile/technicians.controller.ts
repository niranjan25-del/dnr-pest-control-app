// src/modules/mobile/technicians.controller.ts
//
// Mobile gateway for the technician namespace. Exposes /technicians/me (profile,
// availability, jobs, location) using snake_case DTOs that match Flutter's payload format.
// Delegates to ProfilesService, TechnicianAssignmentService, BookingsService, and
// LocationService.

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles, CurrentUser } from "../auth/decorators";
import { AuthenticatedUser } from "../auth/interfaces/auth.interfaces";
import { ProfilesService } from "../profiles/profiles.service";
import { TechnicianAssignmentService } from "../technician-assignment/technician-assignment.service";
import { BookingsService } from "../bookings/bookings.service";
import { LocationService } from "../location/location.service";
import { AttendanceService } from "../attendance/attendance.service";
import { BookingFilterDto } from "../bookings/dto";

class SetAvailabilityDto {
  @IsBoolean() is_available!: boolean;
}

class UpdateLocationDto {
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @IsNumber() @Min(0) accuracy?: number;
  @IsOptional() @IsUUID("4") booking_id?: string;
  @IsOptional() @IsString() @MaxLength(30) recorded_at?: string;
}

class PunchDto {
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

@Controller({ path: "technicians", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TECHNICIAN)
export class TechniciansController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly assignments: TechnicianAssignmentService,
    private readonly bookings: BookingsService,
    private readonly location: LocationService,
    private readonly attendance: AttendanceService,
  ) {}

  @Get("me")
  async getProfile(@CurrentUser() actor: AuthenticatedUser) {
    const p = await this.profiles.getTechnicianProfile(actor.id);
    return {
      id: p.id,
      user_id: p.userId,
      full_name: p.user?.fullName ?? "",
      email: p.user?.email ?? "",
      phone: p.user?.phone ?? "",
      license_number: p.licenseNumber,
      license_expiry: p.licenseExpiry,
      skills: p.skills,
      is_available: p.isAvailable,
      rating_average: p.ratingAverage,
      jobs_completed: p.jobsCompleted,
    };
  }

  @Get("me/availability")
  async getAvailability(@CurrentUser() actor: AuthenticatedUser) {
    const profile = await this.profiles.getTechnicianProfile(actor.id);
    return { is_available: profile.isAvailable };
  }

  @Patch("me/availability")
  setAvailability(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: SetAvailabilityDto,
  ) {
    return this.assignments.setOwnAvailability(actor, {
      isAvailable: dto.is_available,
    });
  }

  @Get("me/jobs")
  jobs(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() filter: BookingFilterDto,
  ) {
    return this.bookings.technicianSchedule(actor, filter);
  }

  @Post("me/location")
  updateLocation(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.location.updateLocation(actor, {
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy,
      bookingId: dto.booking_id,
    });
  }

  // ── Attendance (punch in / out) ─────────────────────────────────────────────

  @Get("me/duty-status")
  dutyStatus(@CurrentUser() actor: AuthenticatedUser) {
    return this.attendance.todayStatus(actor);
  }

  @Post("me/punch-in")
  punchIn(@CurrentUser() actor: AuthenticatedUser, @Body() dto: PunchDto) {
    return this.attendance.punchIn(actor, dto.note);
  }

  @Post("me/punch-out")
  punchOut(@CurrentUser() actor: AuthenticatedUser, @Body() dto: PunchDto) {
    return this.attendance.punchOut(actor, dto.note);
  }
}
