// src/modules/reviews/reviews.controller.ts
// /reviews admin routes. List is paginated with optional status filter. Moderation:
// PATCH /:id/moderate { status: PUBLISHED | HIDDEN | FLAGGED } — admin only.

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
import { UserRole, ReviewStatus } from "@prisma/client";
import {
  IsEnum,
  IsInt,
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
import { ReviewsService, ReviewFilterDto } from "./reviews.service";

class ModerateDto {
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}

class CreateReviewDto {
  @IsUUID("4") booking_id!: string;
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}

@Controller({ path: "reviews", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviews.submitReview(actor, dto);
  }

  @Get()
  list(@Query() filter: ReviewFilterDto) {
    return this.reviews.list(filter);
  }

  @Patch(":id/moderate")
  moderate(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ModerateDto,
  ) {
    return this.reviews.moderate(id, actor.id, dto.status);
  }
}
