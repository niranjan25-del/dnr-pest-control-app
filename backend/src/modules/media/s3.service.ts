// src/modules/media/s3.service.ts
//
// S3 operations for media: server-side upload (multipart path), presigned PUT (client-direct
// upload), presigned GET (private download fallback), and delete. The bucket is private — all
// reads go through signed URLs. Credentials resolve from the default AWS chain (task role) or
// explicit env keys.
//
// Local dev fallback: when AWS credentials are absent, files are written to ./uploads/ on disk
// and served via the static-assets middleware configured in main.ts.

import * as fs from 'fs';
import * as path from 'path';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3: S3Client;
  private readonly bucket?: string;
  readonly localMode: boolean;
  private readonly uploadDir: string;
  private readonly port: number;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('aws.region');
    this.bucket = this.config.get<string>('aws.mediaBucket');
    const accessKeyId = this.config.get<string>('aws.accessKeyId');
    const secretAccessKey = this.config.get<string>('aws.secretAccessKey');
    this.port = this.config.get<number>('app.port') ?? 3000;

    this.localMode = !accessKeyId || !secretAccessKey;
    this.uploadDir = path.join(process.cwd(), 'uploads');

    this.s3 = new S3Client({ region: region ?? 'us-east-1', ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}) });

    if (this.localMode) {
      this.logger.warn('AWS credentials not set — using local disk storage at ./uploads (dev only)');
    }
  }

  private requireBucket(): string {
    if (!this.bucket) throw new InternalServerErrorException({ code: 'UPLOAD_FAILURE', message: 'Media bucket is not configured' });
    return this.bucket;
  }

  localUrl(key: string): string {
    return `http://localhost:${this.port}/uploads/${key}`;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.localMode) {
      const filePath = path.join(this.uploadDir, key);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, body);
      this.logger.debug(`[local] stored ${key} (${body.length}B, ${contentType})`);
      return;
    }
    try {
      await this.s3.send(new PutObjectCommand({ Bucket: this.requireBucket(), Key: key, Body: body, ContentType: contentType }));
    } catch (err) {
      this.logger.error(`S3 putObject failed for ${key}: ${(err as Error).message}`);
      throw new InternalServerErrorException({ code: 'UPLOAD_FAILURE', message: 'Failed to store the file' });
    }
  }

  presignPut(key: string, contentType: string, expiresIn: number): Promise<string> {
    return getSignedUrl(this.s3, new PutObjectCommand({ Bucket: this.requireBucket(), Key: key, ContentType: contentType }), { expiresIn });
  }

  presignGet(key: string, expiresIn: number): Promise<string> {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.requireBucket(), Key: key }), { expiresIn });
  }

  async deleteObject(key: string): Promise<void> {
    if (this.localMode) {
      const filePath = path.join(this.uploadDir, key);
      await fs.promises.rm(filePath, { force: true });
      return;
    }
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.requireBucket(), Key: key }));
    } catch (err) {
      this.logger.error(`S3 deleteObject failed for ${key}: ${(err as Error).message}`);
      // Non-fatal: metadata is already soft-deleted; object cleanup can be retried by lifecycle.
    }
  }
}
