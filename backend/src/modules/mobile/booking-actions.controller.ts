// src/modules/mobile/booking-actions.controller.ts
//
// Mobile booking-action routes. Technician actions (POST) and customer read (GET):
//   POST /bookings/:id/accept              — accept the active assignment
//   POST /bookings/:id/decline             — decline the active assignment
//   POST /bookings/:id/complete            — upload completion photo + mark COMPLETED
//   POST /bookings/:id/report              — consolidated create+fill+submit service report
//   GET  /bookings/:id/technician-location — current technician position for a booking (customer/admin)
//
// Acceptance/decline find the active assignment by bookingId, then delegate to
// TechnicianAssignmentService which enforces the state machine.

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AssignmentStatus, BookingStatus, UserRole } from "@prisma/client";
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { PrismaService } from "src/database/prisma.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles, CurrentUser } from "../auth/decorators";
import { AuthenticatedUser } from "../auth/interfaces/auth.interfaces";
import { TechnicianAssignmentService } from "../technician-assignment/technician-assignment.service";
import { ServiceReportsService } from "../service-reports/service-reports.service";
import { LocationService } from "../location/location.service";
import { MediaService } from "../media/media.service";
import { BookingsService } from "../bookings/bookings.service";
import { MediaCategory } from "../media/enums";

const ACTIVE_STATUSES: AssignmentStatus[] = [
  AssignmentStatus.ASSIGNED,
  AssignmentStatus.ACCEPTED,
];

class DeclineDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

class MobileChemicalDto {
  @IsString() @MaxLength(200) product_name!: string;
  @IsOptional() @IsNumber() @Min(0) quantity_used?: number;
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  @IsOptional() @IsString() @MaxLength(200) target_pest?: string;
  @IsOptional() @IsString() @MaxLength(200) epa_registration_number?: string;
  @IsOptional() @IsString() @MaxLength(200) application_method?: string;
  @IsOptional() @IsString() @MaxLength(30) applied_at?: string;
}

class SubmitReportDto {
  @IsOptional() @IsArray() @IsString({ each: true }) pests_found?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) areas_treated?: string[];
  @IsOptional() @IsString() @MaxLength(4000) summary?: string;
  @IsOptional() @IsString() @MaxLength(4000) recommendations?: string;
  @IsOptional() @IsBoolean() follow_up_required?: boolean;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MobileChemicalDto)
  chemical_applications?: MobileChemicalDto[];
  @IsOptional() @IsUUID("4") signature_file_id?: string;
  @IsOptional() @IsString() @MaxLength(160) signer_name?: string;
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  photo_file_ids?: string[];
}

@Controller({ path: "bookings", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingActionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: TechnicianAssignmentService,
    private readonly reports: ServiceReportsService,
    private readonly location: LocationService,
    private readonly media: MediaService,
    private readonly bookings: BookingsService,
  ) {}

  // Customer: get the current position of the technician assigned to this booking.
  @Get(":id/technician-location")
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async technicianLocation(
    @Param("id", ParseUUIDPipe) bookingId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const assignment = await this.prisma.technicianAssignment.findFirst({
      where: { bookingId, status: { in: ACTIVE_STATUSES } },
      select: { technicianId: true },
    });
    if (!assignment) {
      throw new NotFoundException({
        code: "ASSIGNMENT_NOT_FOUND",
        message: "No active assignment found for this booking",
      });
    }
    return this.location.getCurrent(actor, assignment.technicianId);
  }

  @Post(":id/accept")
  @Roles(UserRole.TECHNICIAN)
  async accept(
    @Param("id", ParseUUIDPipe) bookingId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const assignment = await this.prisma.technicianAssignment.findFirst({
      where: { bookingId, status: { in: ACTIVE_STATUSES } },
      select: { id: true },
    });
    if (!assignment) {
      throw new NotFoundException({
        code: "ASSIGNMENT_NOT_FOUND",
        message: "No active assignment found for this booking",
      });
    }
    return this.assignments.accept(assignment.id, actor);
  }

  @Post(":id/decline")
  @Roles(UserRole.TECHNICIAN)
  async decline(
    @Param("id", ParseUUIDPipe) bookingId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: DeclineDto,
  ) {
    const assignment = await this.prisma.technicianAssignment.findFirst({
      where: { bookingId, status: { in: ACTIVE_STATUSES } },
      select: { id: true },
    });
    if (!assignment) {
      throw new NotFoundException({
        code: "ASSIGNMENT_NOT_FOUND",
        message: "No active assignment found for this booking",
      });
    }
    return this.assignments.reject(assignment.id, actor, dto.reason);
  }

  // Upload a completion photo + advance booking to COMPLETED in one atomic call.
  @Post(":id/complete")
  @Roles(UserRole.TECHNICIAN)
  @UseInterceptors(FileInterceptor("photo"))
  async completeJob(
    @Param("id", ParseUUIDPipe) bookingId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @UploadedFile() photo: Express.Multer.File,
    @Body("notes") notes?: string,
  ) {
    if (!photo) {
      throw new BadRequestException({
        code: "PHOTO_REQUIRED",
        message: "A completion photo is required",
      });
    }

    // Verify technician is assigned to this booking.
    const techProfile = await this.prisma.technicianProfile.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!techProfile) {
      throw new BadRequestException({
        code: "PROFILE_NOT_FOUND",
        message: "Technician profile not found",
      });
    }
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      select: {
        id: true,
        status: true,
        assignments: {
          where: {
            technicianId: techProfile.id,
            status: {
              in: [AssignmentStatus.ASSIGNED, AssignmentStatus.ACCEPTED],
            },
          },
          select: { id: true },
        },
      },
    });
    if (!booking)
      throw new NotFoundException({
        code: "BOOKING_NOT_FOUND",
        message: "Booking not found",
      });
    if (booking.status !== BookingStatus.IN_PROGRESS) {
      throw new BadRequestException({
        code: "INVALID_STATUS",
        message: "Booking must be IN_PROGRESS to complete",
      });
    }

    // Upload the completion photo linked to this booking.
    const uploaded = await this.media.upload(
      actor,
      {
        category: MediaCategory.AFTER_SERVICE_IMAGE,
        ownerId: bookingId,
      },
      photo,
    );

    // Advance booking status to COMPLETED.
    await this.bookings.changeStatus(bookingId, actor, {
      status: BookingStatus.COMPLETED,
      note: notes ?? "Job completed by technician",
    });

    return { success: true, photo_id: uploaded.id, booking_id: bookingId };
  }

  @Post(":id/report")
  @Roles(UserRole.TECHNICIAN)
  async submitReport(
    @Param("id", ParseUUIDPipe) bookingId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: SubmitReportDto,
  ) {
    // 1. Create a draft report (validates technician is assigned to this booking).
    const created = await this.reports.create(actor, {
      bookingId,
      summary: dto.summary,
      recommendations: dto.recommendations,
    });

    // 2. Fill in structured content.
    const chemicals = (dto.chemical_applications ?? []).map((c) => ({
      chemicalName: c.product_name,
      quantity:
        c.quantity_used !== undefined && c.unit
          ? `${c.quantity_used} ${c.unit}`
          : undefined,
      area: c.target_pest ?? c.application_method,
      notes: c.epa_registration_number ?? undefined,
    }));

    await this.reports.update(actor, created.id, {
      findings: dto.pests_found,
      services: dto.areas_treated,
      chemicals: chemicals.length ? chemicals : undefined,
      afterPhotoMediaIds: dto.photo_file_ids?.length
        ? dto.photo_file_ids
        : undefined,
    });

    // 3. Submit (enforces state machine: DRAFT → SUBMITTED).
    const hasSummary = dto.summary?.trim();
    const hasServices = dto.areas_treated?.some((s) => s.trim());
    if (!hasSummary && !hasServices) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Add a summary or at least one area treated before submitting",
      });
    }
    return this.reports.submit(actor, created.id, {});
  }
}
