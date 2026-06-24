// src/modules/service-reports/signature.service.ts
//
// Customer signature capture. The signature (PNG from a canvas) is decoded, validated by magic
// bytes, stored privately in S3, and recorded as a MediaFile (ownerType 'report_signature',
// ownerId = reportId) — ServiceReport has no signature column. Replacing a signature soft-marks
// the previous one. Retrieval supports both metadata and (for PDF embedding) raw bytes.

import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { MediaType } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "src/database/prisma.service";
import { S3Service } from "../media/s3.service";
import { SIGNATURE_OWNER_TYPE, SIGNED_URL_TTL_SECONDS } from "./enums";

@Injectable()
export class SignatureService {
  private readonly logger = new Logger(SignatureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async store(
    reportId: string,
    uploaderId: string,
    imageBase64: string,
  ): Promise<{ media_id: string }> {
    const buffer = this.decodePng(imageBase64);
    const key = `service_report/${reportId}/signature-${randomUUID()}.png`;
    try {
      await this.s3.putObject(key, buffer, "image/png");
    } catch {
      throw new BadRequestException({
        code: "SIGNATURE_UPLOAD_FAILED",
        message: "Failed to store the signature",
      });
    }
    const media = await this.prisma.$transaction(async (tx) => {
      // Retire any previous signature for this report.
      await tx.mediaFile.updateMany({
        where: {
          ownerType: SIGNATURE_OWNER_TYPE,
          ownerId: reportId,
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
      return tx.mediaFile.create({
        data: {
          uploaderId,
          type: MediaType.IMAGE,
          storageKey: key,
          url: key,
          contentType: "image/png",
          sizeBytes: buffer.byteLength,
          ownerType: SIGNATURE_OWNER_TYPE,
          ownerId: reportId,
        },
      });
    });
    this.logger.log(`Signature captured for report ${reportId}`);
    return { media_id: media.id };
  }

  async getMeta(reportId: string) {
    return this.prisma.mediaFile.findFirst({
      where: {
        ownerType: SIGNATURE_OWNER_TYPE,
        ownerId: reportId,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async hasSignature(reportId: string): Promise<boolean> {
    return Boolean(await this.getMeta(reportId));
  }

  /** Fetch the signature bytes for PDF embedding (best-effort; null on any failure). */
  async getBytes(reportId: string): Promise<Buffer | null> {
    const meta = await this.getMeta(reportId);
    if (!meta) return null;
    try {
      const url = await this.s3.presignGet(
        meta.storageKey,
        SIGNED_URL_TTL_SECONDS,
      );
      const res = await fetch(url);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      this.logger.warn(
        `Could not fetch signature bytes for report ${reportId}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private decodePng(input: string): Buffer {
    const base64 = input.replace(/^data:image\/png;base64,/, "");
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, "base64");
    } catch {
      throw new BadRequestException({
        code: "SIGNATURE_UPLOAD_FAILED",
        message: "Invalid signature encoding",
      });
    }
    // PNG magic bytes: 89 50 4E 47
    if (
      buffer.length < 8 ||
      buffer[0] !== 0x89 ||
      buffer[1] !== 0x50 ||
      buffer[2] !== 0x4e ||
      buffer[3] !== 0x47
    ) {
      throw new BadRequestException({
        code: "SIGNATURE_UPLOAD_FAILED",
        message: "Signature must be a PNG image",
      });
    }
    return buffer;
  }
}
