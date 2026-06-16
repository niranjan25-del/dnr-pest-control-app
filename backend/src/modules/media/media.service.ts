// src/modules/media/media.service.ts
//
// Media orchestration: upload (multipart) + presigned upload, replace, soft/hard delete +
// restore, metadata reads/search, and signed access URLs (CloudFront-signed when configured,
// else S3 presigned GET). Ownership/role rules come from CATEGORY_CONFIG; access is scoped per
// role (own uploads + media linked to the actor's bookings; admins see all). Actions audited.

import {
  BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { MediaFile, Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/database/prisma.service';
import { paginate } from 'src/common/utils/pagination.util';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { S3Service } from './s3.service';
import { CloudFrontService } from './cloudfront.service';
import { FileValidatorService } from './file-validator.service';
import { GenerateSignedUrlDto, MediaFilterDto, UploadFileDto } from './dto';
import { AccessUrl, PresignedUpload, UploadedMedia } from './interfaces';
import { CATEGORY_CONFIG, MediaCategory, SIGNED_URL_TTL_SECONDS, mediaTypeFor } from './enums';

type MulterFile = { originalname: string; mimetype: string; size: number; buffer: Buffer };

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly cloudfront: CloudFrontService,
    private readonly validator: FileValidatorService,
  ) {}

  // ---------------- Upload (multipart) ----------------
  async upload(actor: AuthenticatedUser, dto: UploadFileDto, file?: MulterFile): Promise<UploadedMedia> {
    if (!file) throw new BadRequestException({ code: 'UPLOAD_FAILURE', message: 'No file provided' });
    const policy = this.assertCategoryAllowed(actor, dto.category);
    const { contentType, sizeBytes } = this.validator.validateBuffer(dto.category, file);
    await this.assertOwnerAccess(actor, policy, dto.ownerId);

    const key = this.buildKey(policy.ownerType, actor.id, file.originalname);
    await this.s3.putObject(key, file.buffer, contentType);

    const media = await this.prisma.$transaction(async (tx) => {
      const created = await tx.mediaFile.create({
        data: {
          uploaderId: actor.id, type: mediaTypeFor(contentType), storageKey: key, url: this.cloudfront.publicUrl(key) ?? key,
          contentType, sizeBytes, ownerType: policy.ownerType, ownerId: dto.ownerId ?? null,
        },
      });
      await tx.auditLog.create({ data: { actorId: actor.id, action: 'media.uploaded', entityType: 'media', entityId: created.id, metadata: { category: dto.category, sizeBytes } } });
      return created;
    });
    this.logger.log(`Media ${media.id} uploaded by ${actor.id} (${dto.category}, ${sizeBytes}B)`);
    return this.toResponse(media, dto.category);
  }

  // ---------------- Presigned upload (client-direct) ----------------
  async createSignedUpload(actor: AuthenticatedUser, dto: GenerateSignedUrlDto): Promise<PresignedUpload> {
    const policy = this.assertCategoryAllowed(actor, dto.category);
    const contentType = this.validator.validateDeclared(dto.category, dto.contentType, dto.sizeBytes);
    await this.assertOwnerAccess(actor, policy, dto.ownerId);

    const key = this.buildKey(policy.ownerType, actor.id, dto.fileName);
    const media = await this.prisma.mediaFile.create({
      data: {
        uploaderId: actor.id, type: mediaTypeFor(contentType), storageKey: key, url: this.cloudfront.publicUrl(key) ?? key,
        contentType, sizeBytes: dto.sizeBytes ?? 0, ownerType: policy.ownerType, ownerId: dto.ownerId ?? null,
      },
    });
    const uploadUrl = await this.s3.presignPut(key, contentType, SIGNED_URL_TTL_SECONDS);
    await this.audit(actor.id, 'media.signed_url_generated', media.id, { mode: 'upload' });
    return { media_id: media.id, upload_url: uploadUrl, key, expires_in: SIGNED_URL_TTL_SECONDS };
  }

  // ---------------- Replace (additive) ----------------
  async replace(actor: AuthenticatedUser, id: string, file?: MulterFile): Promise<UploadedMedia> {
    if (!file) throw new BadRequestException({ code: 'UPLOAD_FAILURE', message: 'No file provided' });
    const media = await this.requireMedia(id);
    if (media.uploaderId !== actor.id && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'You cannot replace this file' });
    }
    const category = this.categoryForOwnerType(media.ownerType);
    const { contentType, sizeBytes } = this.validator.validateBuffer(category, file);
    await this.s3.putObject(media.storageKey, file.buffer, contentType); // overwrite same key
    const updated = await this.prisma.mediaFile.update({
      where: { id }, data: { contentType, sizeBytes, type: mediaTypeFor(contentType), deletedAt: null },
    });
    await this.audit(actor.id, 'media.replaced', id);
    return this.toResponse(updated, category);
  }

  // ---------------- Delete / Restore ----------------
  async remove(actor: AuthenticatedUser, id: string, hard?: boolean) {
    const media = await this.prisma.mediaFile.findUnique({ where: { id } });
    if (!media) throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'File not found' });
    if (media.uploaderId !== actor.id && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'You cannot delete this file' });
    }
    if (hard && actor.role === UserRole.ADMIN) {
      await this.s3.deleteObject(media.storageKey);
      await this.prisma.mediaFile.delete({ where: { id } });
      await this.audit(actor.id, 'media.hard_deleted', id);
      return { success: true, hard: true };
    }
    await this.prisma.mediaFile.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit(actor.id, 'media.deleted', id);
    return { success: true, hard: false };
  }

  async restore(actor: AuthenticatedUser, id: string) {
    const media = await this.prisma.mediaFile.findUnique({ where: { id } });
    if (!media) throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'File not found' });
    if (media.uploaderId !== actor.id && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'You cannot restore this file' });
    }
    const updated = await this.prisma.mediaFile.update({ where: { id }, data: { deletedAt: null } });
    await this.audit(actor.id, 'media.restored', id);
    return this.toResponse(updated, this.categoryForOwnerType(updated.ownerType));
  }

  // ---------------- Reads / Search ----------------
  async findById(actor: AuthenticatedUser, id: string): Promise<UploadedMedia> {
    const media = await this.requireMedia(id);
    if (!(await this.canAccess(actor, media))) throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'Not authorized for this file' });
    return this.toResponse(media, this.categoryForOwnerType(media.ownerType));
  }

  async list(actor: AuthenticatedUser, filter: MediaFilterDto) {
    const where: Prisma.MediaFileWhereInput = {
      ...(filter.includeDeleted && actor.role === UserRole.ADMIN ? {} : { deletedAt: null }),
      ...(filter.category ? { ownerType: CATEGORY_CONFIG[filter.category].ownerType } : {}),
      ...(filter.ownerId ? { ownerId: filter.ownerId } : {}),
      ...(filter.uploaderId ? { uploaderId: filter.uploaderId } : {}),
      ...(await this.scope(actor)),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.mediaFile.findMany({ where, orderBy: { createdAt: filter.order }, skip: filter.skip, take: filter.limit }),
      this.prisma.mediaFile.count({ where }),
    ]);
    return paginate(rows.map((m) => this.toResponse(m, this.categoryForOwnerType(m.ownerType))), total, filter.page, filter.limit);
  }

  // ---------------- Access URL ----------------
  async getAccessUrl(actor: AuthenticatedUser, id: string): Promise<AccessUrl> {
    const media = await this.requireMedia(id);
    if (!(await this.canAccess(actor, media))) throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'Not authorized for this file' });

    const cf = this.cloudfront.signedUrl(media.storageKey, SIGNED_URL_TTL_SECONDS);
    await this.audit(actor.id, 'media.signed_url_generated', id, { mode: 'download' });
    if (cf) return { url: cf, expires_in: SIGNED_URL_TTL_SECONDS, delivery: 'cloudfront' };
    const s3url = await this.s3.presignGet(media.storageKey, SIGNED_URL_TTL_SECONDS);
    return { url: s3url, expires_in: SIGNED_URL_TTL_SECONDS, delivery: 's3' };
  }

  // ================= helpers =================
  private buildKey(ownerType: string, uploaderId: string, fileName: string): string {
    const safe = fileName.replace(/[^\w.\-]/g, '_').slice(-120);
    return `${ownerType}/${uploaderId}/${randomUUID()}-${safe}`;
  }

  private assertCategoryAllowed(actor: AuthenticatedUser, category: MediaCategory) {
    const policy = CATEGORY_CONFIG[category];
    if (!policy.roles.includes(actor.role)) {
      throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'Your role cannot upload to this category' });
    }
    return policy;
  }

  /** For booking-linked categories, verify the actor is tied to the referenced booking. */
  private async assertOwnerAccess(actor: AuthenticatedUser, policy: { bookingLinked: boolean }, ownerId?: string) {
    if (!policy.bookingLinked || !ownerId || actor.role === UserRole.ADMIN) return;
    const bookingIds = await this.actorBookingIds(actor);
    if (!bookingIds.includes(ownerId)) {
      throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'You are not associated with this booking' });
    }
  }

  private async canAccess(actor: AuthenticatedUser, media: MediaFile): Promise<boolean> {
    if (actor.role === UserRole.ADMIN) return true;
    if (media.uploaderId === actor.id) return true;
    // Booking-linked media is visible to the booking's customer/assigned technician.
    if (media.ownerId) {
      const bookingIds = await this.actorBookingIds(actor);
      if (bookingIds.includes(media.ownerId)) return true;
    }
    return false;
  }

  private async scope(actor: AuthenticatedUser): Promise<Prisma.MediaFileWhereInput> {
    if (actor.role === UserRole.ADMIN) return {};
    const bookingIds = await this.actorBookingIds(actor);
    return { OR: [{ uploaderId: actor.id }, ...(bookingIds.length ? [{ ownerId: { in: bookingIds } }] : [])] };
  }

  private async actorBookingIds(actor: AuthenticatedUser): Promise<string[]> {
    if (actor.role === UserRole.CUSTOMER) {
      const p = await this.prisma.customerProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
      if (!p) return [];
      const bookings = await this.prisma.booking.findMany({ where: { customerId: p.id }, select: { id: true } });
      return bookings.map((b) => b.id);
    }
    if (actor.role === UserRole.TECHNICIAN) {
      const p = await this.prisma.technicianProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
      if (!p) return [];
      const bookings = await this.prisma.booking.findMany({ where: { assignments: { some: { technicianId: p.id } } }, select: { id: true } });
      return bookings.map((b) => b.id);
    }
    return [];
  }

  private categoryForOwnerType(ownerType: string | null): MediaCategory {
    const entry = (Object.entries(CATEGORY_CONFIG) as [MediaCategory, { ownerType: string }][]).find(([, c]) => c.ownerType === ownerType);
    return entry?.[0] ?? MediaCategory.CHAT_ATTACHMENT;
  }

  private async requireMedia(id: string): Promise<MediaFile> {
    const media = await this.prisma.mediaFile.findUnique({ where: { id } });
    if (!media) throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'File not found' });
    return media;
  }

  private audit(actorId: string, action: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    return this.prisma.auditLog.create({ data: { actorId, action, entityType: 'media', entityId, metadata } });
  }

  private toResponse(m: MediaFile, category: MediaCategory): UploadedMedia {
    const fileName = m.storageKey.split('/').pop()?.replace(/^[0-9a-f-]{36}-/, '') ?? m.storageKey;
    return {
      id: m.id, category, content_type: m.contentType, size_bytes: m.sizeBytes, file_name: fileName,
      owner_type: m.ownerType, owner_id: m.ownerId, uploaded_at: m.createdAt,
    };
  }
}
