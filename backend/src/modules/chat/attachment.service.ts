// src/modules/chat/attachment.service.ts
//
// Chat attachments via S3 presigned URLs (no file bytes pass through the API). Minting an
// upload URL validates the content type, registers a private MediaFile (ownerType 'chat'), and
// returns a short-lived presigned PUT. Download URLs are presigned GETs, authorized to the
// uploader or any participant of a conversation that references the media.

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MediaType } from "@prisma/client";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { PrismaService } from "src/database/prisma.service";
import { AuthenticatedUser } from "../auth/interfaces/auth.interfaces";
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES } from "./enums";
import { UploadUrlDto } from "./dto";

@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);
  private readonly s3: S3Client;
  private readonly bucket?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const region = this.config.get<string>("aws.region");
    this.bucket = this.config.get<string>("aws.mediaBucket");
    const accessKeyId = this.config.get<string>("aws.accessKeyId");
    const secretAccessKey = this.config.get<string>("aws.secretAccessKey");
    this.s3 = new S3Client({
      region,
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  private mediaType(contentType: string): MediaType {
    if (contentType.startsWith("image/")) return MediaType.IMAGE;
    if (contentType.startsWith("video/")) return MediaType.VIDEO;
    return MediaType.DOCUMENT;
  }

  async createUploadUrl(actor: AuthenticatedUser, dto: UploadUrlDto) {
    if (!ALLOWED_ATTACHMENT_TYPES.has(dto.contentType)) {
      throw new BadRequestException({
        code: "ATTACHMENT_INVALID",
        message: "Unsupported attachment type",
      });
    }
    if (dto.sizeBytes && dto.sizeBytes > MAX_ATTACHMENT_BYTES) {
      throw new BadRequestException({
        code: "ATTACHMENT_INVALID",
        message: "Attachment exceeds the size limit",
      });
    }
    if (!this.bucket) {
      throw new InternalServerErrorException({
        code: "STORAGE_NOT_CONFIGURED",
        message: "Attachment storage is not configured",
      });
    }
    const safeName = dto.filename.replace(/[^\w.\-]/g, "_");
    const key = `chat/${actor.id}/${randomUUID()}-${safeName}`;
    const media = await this.prisma.mediaFile.create({
      data: {
        uploaderId: actor.id,
        type: this.mediaType(dto.contentType),
        storageKey: key,
        url: key,
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes ?? 0,
        ownerType: "chat",
      },
    });
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: dto.contentType,
      }),
      { expiresIn: 300 },
    );
    return { media_id: media.id, upload_url: uploadUrl, key, expires_in: 300 };
  }

  async getDownloadUrl(actor: AuthenticatedUser, mediaId: string) {
    const media = await this.prisma.mediaFile.findFirst({
      where: { id: mediaId, deletedAt: null },
    });
    if (!media)
      throw new NotFoundException({
        code: "ATTACHMENT_NOT_FOUND",
        message: "Attachment not found",
      });

    const authorized =
      media.uploaderId === actor.id ||
      (await this.isParticipantForMedia(actor.id, mediaId));
    if (!authorized)
      throw new ForbiddenException({
        code: "UNAUTHORIZED_CONVERSATION_ACCESS",
        message: "Not authorized for this attachment",
      });

    if (!this.bucket)
      throw new InternalServerErrorException({
        code: "STORAGE_NOT_CONFIGURED",
        message: "Attachment storage is not configured",
      });
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: media.storageKey }),
      { expiresIn: 300 },
    );
    return { url, expires_in: 300 };
  }

  private async isParticipantForMedia(
    userId: string,
    mediaId: string,
  ): Promise<boolean> {
    const msg = await this.prisma.chatMessage.findFirst({
      where: { mediaId, conversation: { participants: { some: { userId } } } },
      select: { id: true },
    });
    return Boolean(msg);
  }
}
