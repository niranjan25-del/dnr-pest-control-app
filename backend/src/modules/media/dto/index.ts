// src/modules/media/dto/index.ts

import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { MediaCategory } from '../enums';

// Used with multipart upload — the file itself comes via the interceptor, these are body fields.
export class UploadFileDto {
  @IsEnum(MediaCategory, { message: 'A valid file category is required' })
  category!: MediaCategory;

  // The linked entity (e.g. bookingId for service photos).
  @IsOptional() @IsUUID('4')
  ownerId?: string;
}

export class DeleteFileDto {
  // Admin-only hard delete (removes the S3 object + row). Default is soft delete.
  @IsOptional() @Type(() => Boolean) @IsBoolean()
  hard?: boolean;
}

export class GenerateSignedUrlDto {
  @IsEnum(MediaCategory)
  category!: MediaCategory;

  @IsString() @IsNotEmpty({ message: 'contentType is required' })
  contentType!: string;

  @IsString() @IsNotEmpty({ message: 'fileName is required' }) @MaxLength(200)
  fileName!: string;

  @IsOptional() @IsInt() @Min(1)
  sizeBytes?: number;

  @IsOptional() @IsUUID('4')
  ownerId?: string;
}

export class MediaFilterDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(MediaCategory) category?: MediaCategory;

  @IsOptional() @IsUUID('4') ownerId?: string;

  @IsOptional() @IsUUID('4') uploaderId?: string;

  @IsOptional() @Type(() => Boolean) @IsBoolean() includeDeleted?: boolean;
}
