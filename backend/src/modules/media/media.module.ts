// src/modules/media/media.module.ts
//
// Central media module. Exports MediaService + S3Service so other modules can consolidate on it
// over time (invoices/chat currently have their own local S3 helpers — this is the canonical
// home; migrating them is a future cleanup, not an edit to approved modules).

import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { S3Service } from './s3.service';
import { CloudFrontService } from './cloudfront.service';
import { FileValidatorService } from './file-validator.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService, S3Service, CloudFrontService, FileValidatorService],
  exports: [MediaService, S3Service],
})
export class MediaModule {}
