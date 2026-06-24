// src/modules/warranties/warranties.controller.ts
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../auth/decorators";
import { AuthenticatedUser } from "../auth/interfaces/auth.interfaces";
import { WarrantiesService } from "./warranties.service";

@Controller({ path: "warranties", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarrantiesController {
  constructor(private readonly warranties: WarrantiesService) {}

  @Get("customer")
  listMine(@CurrentUser() actor: AuthenticatedUser) {
    return this.warranties.listForCustomer(actor);
  }

  @Get("booking/:bookingId")
  findByBooking(
    @Param("bookingId", ParseUUIDPipe) bookingId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.warranties.findByBooking(bookingId, actor);
  }
}
