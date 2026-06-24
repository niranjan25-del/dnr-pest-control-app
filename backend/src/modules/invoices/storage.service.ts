// src/modules/invoices/storage.service.ts
//
// S3 storage for invoice PDFs. Uploads the PDF and mints short-lived presigned GET URLs for
// secure download (the object stays private; links expire). Credentials resolve from the
// default AWS chain (task role in cloud) or explicit env keys locally.

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket?: string;

  constructor(private readonly config: ConfigService) {
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

  async uploadPdf(
    key: string,
    body: Buffer,
  ): Promise<{ key: string; sizeBytes: number }> {
    if (!this.bucket) {
      throw new InternalServerErrorException({
        code: "STORAGE_NOT_CONFIGURED",
        message: "Invoice storage bucket is not configured",
      });
    }
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: "application/pdf",
        }),
      );
      return { key, sizeBytes: body.byteLength };
    } catch (err) {
      this.logger.error(
        `S3 upload failed for ${key}: ${(err as Error).message}`,
      );
      throw new InternalServerErrorException({
        code: "STORAGE_FAILURE",
        message: "Failed to store the invoice",
      });
    }
  }

  async getSignedDownloadUrl(key: string, expiresIn = 300): Promise<string> {
    if (!this.bucket) {
      throw new InternalServerErrorException({
        code: "STORAGE_NOT_CONFIGURED",
        message: "Invoice storage bucket is not configured",
      });
    }
    try {
      return await getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn },
      );
    } catch (err) {
      this.logger.error(`Presign failed for ${key}: ${(err as Error).message}`);
      throw new InternalServerErrorException({
        code: "DOWNLOAD_FAILURE",
        message: "Failed to generate download link",
      });
    }
  }
}
