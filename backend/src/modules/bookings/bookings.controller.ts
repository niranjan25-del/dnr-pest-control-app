// src/modules/bookings/bookings.controller.ts
//
// /bookings routes. All require auth; row-level access is scoped by role in the service.
// The static sub-routes (customer/history, technician/schedule) are declared BEFORE :id so
// they aren't captured by the UUID param matcher.

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { BookingStatus, UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles, CurrentUser } from "../auth/decorators";
import { AuthenticatedUser } from "../auth/interfaces/auth.interfaces";
import { BookingsService } from "./bookings.service";
import {
  BookingFilterDto,
  CancelBookingDto,
  CreateBookingDto,
  RescheduleBookingDto,
  UpdateBookingDto,
  UpdateBookingStatusDto,
} from "./dto";

@Controller({ path: "bookings", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookings.create(actor, dto);
  }

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() filter: BookingFilterDto,
  ) {
    return this.bookings.list(actor, filter);
  }

  // --- static sub-routes (must precede :id) ---
  @Get("customer/history")
  @Roles(UserRole.CUSTOMER)
  history(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() filter: BookingFilterDto,
  ) {
    return this.bookings.customerHistory(actor, filter);
  }

  @Get("technician/schedule")
  @Roles(UserRole.TECHNICIAN)
  schedule(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() filter: BookingFilterDto,
  ) {
    return this.bookings.technicianSchedule(actor, filter);
  }

  @Get(":id")
  findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.bookings.findOne(id, actor);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.bookings.update(id, actor, dto);
  }

  @Patch(":id/reschedule")
  reschedule(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RescheduleBookingDto,
  ) {
    return this.bookings.reschedule(id, actor, dto);
  }

  @Patch(":id/cancel")
  cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookings.cancel(id, actor, dto);
  }

  // Mobile alias: Flutter uses POST instead of PATCH for cancel.
  @Post(":id/cancel")
  cancelPost(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookings.cancel(id, actor, dto);
  }

  // Technician accepts an assigned PENDING booking → CONFIRMED.
  @Post(":id/accept")
  @Roles(UserRole.TECHNICIAN)
  accept(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.bookings.changeStatus(id, actor, {
      status: BookingStatus.CONFIRMED,
    });
  }

  // Technician declines an assigned booking → CANCELLED.
  @Post(":id/decline")
  @Roles(UserRole.TECHNICIAN)
  decline(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.bookings.cancel(id, actor, {
      reason: "Declined by technician",
    });
  }

  // Additive (flagged): status progression for technicians/admins. Customers use
  // cancel/reschedule. booking-status.service enforces the state-machine graph.
  @Patch(":id/status")
  @Roles(UserRole.TECHNICIAN, UserRole.ADMIN)
  changeStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookings.changeStatus(id, actor, dto);
  }

  // Mobile alias: Flutter uses POST instead of PATCH for status transitions.
  @Post(":id/status")
  @Roles(UserRole.TECHNICIAN, UserRole.ADMIN)
  changeStatusPost(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookings.changeStatus(id, actor, dto);
  }
}
