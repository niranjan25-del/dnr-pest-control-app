// src/modules/media/s3.service.ts
//
// S3 operations for media: server-side upload (multipart path), presigned PUT (client-direct
// upload), presigned GET (private download fallback), and delete. The bucket is private — all
// reads go through signed URLs. Credentials resolve from the default AWS chain (task role) or
// explicit env keys.

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3: S3Client;
  private readonly bucket?: string;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('aws.region');
    this.bucket = this.config.get<string>('aws.mediaBucket');
    const accessKeyId = this.config.get<string>('aws.accessKeyId');
    const secretAccessKey = this.config.get<string>('aws.secretAccessKey');
    this.s3 = new S3Client({ region, ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}) });
  }

  private requireBucket(): string {
    if (!this.bucket) throw new InternalServerErrorException({ code: 'UPLOAD_FAILURE', message: 'Media bucket is not configured' });
    return this.bucket;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
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
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.requireBucket(), Key: key }));
    } catch (err) {
      this.logger.error(`S3 deleteObject failed for ${key}: ${(err as Error).message}`);
      // Non-fatal: metadata is already soft-deleted; object cleanup can be retried by lifecycle.
    }
  }
}
