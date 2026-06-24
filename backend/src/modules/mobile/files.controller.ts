// src/modules/mobile/files.controller.ts
//
// POST /files — mobile alias for POST /media/upload. Flutter sends:
//   related_entity_type: 'service_report_before' | 'service_report_after' |
//                        'service_report_signature' | 'chat_message' | 'booking_photo'
//   related_entity_id: UUID of the related entity (booking / report / chat)
//   file: multipart file
//
// Maps related_entity_type → MediaCategory, then delegates to MediaService.upload.
// Returns the same UploadedMedia shape so Flutter can use the returned `id`.

import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  Body,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../auth/decorators";
import { AuthenticatedUser } from "../auth/interfaces/auth.interfaces";
import { MediaService } from "../media/media.service";
import { MediaCategory } from "../media/enums";

const ENTITY_TYPE_MAP: Record<string, MediaCategory> = {
  service_report_before: MediaCategory.BEFORE_SERVICE_IMAGE,
  service_report_after: MediaCategory.AFTER_SERVICE_IMAGE,
  service_report_signature: MediaCategory.SERVICE_REPORT_ATTACHMENT,
  chat_message: MediaCategory.CHAT_ATTACHMENT,
  booking_photo: MediaCategory.BOOKING_IMAGE,
  profile_image: MediaCategory.PROFILE_IMAGE,
};

class MobileUploadDto {
  @IsString() @MaxLength(80) related_entity_type!: string;
  @IsOptional() @IsUUID("4") related_entity_id?: string;
}

@Controller({ path: "files", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
export class FilesController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  upload(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: MobileUploadDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const category = ENTITY_TYPE_MAP[dto.related_entity_type];
    if (!category) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: `Unknown related_entity_type: ${dto.related_entity_type}`,
      });
    }
    return this.media.upload(
      actor,
      { category, ownerId: dto.related_entity_id },
      file,
    );
  }
}
