// src/modules/media/media.controller.ts
//
// /media routes. Upload uses multipart (FileInterceptor, in-memory buffer). Access is scoped in
// the service (own + booking-linked; admin all). Static routes (upload, signed-url) precede
// :id. Replace/restore are additive (flagged) to support those features.

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../auth/decorators";
import { AuthenticatedUser } from "../auth/interfaces/auth.interfaces";
import { MediaService } from "./media.service";
import {
  DeleteFileDto,
  GenerateSignedUrlDto,
  MediaFilterDto,
  UploadFileDto,
} from "./dto";

@Controller({ path: "media", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post("upload")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor("file"))
  upload(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UploadFileDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.media.upload(actor, dto, file);
  }

  @Post("signed-url")
  createSignedUpload(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: GenerateSignedUrlDto,
  ) {
    return this.media.createSignedUpload(actor, dto);
  }

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() filter: MediaFilterDto,
  ) {
    return this.media.list(actor, filter);
  }

  @Get(":id")
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.media.findById(actor, id);
  }

  @Get(":id/url")
  accessUrl(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.media.getAccessUrl(actor, id);
  }

  @Delete(":id")
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() q: DeleteFileDto,
  ) {
    return this.media.remove(actor, id, q.hard);
  }

  // ----- additive (flagged): replace + restore -----
  @Post(":id/replace")
  @UseInterceptors(FileInterceptor("file"))
  replace(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.media.replace(actor, id, file);
  }

  @Post(":id/restore")
  restore(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.media.restore(actor, id);
  }
}
