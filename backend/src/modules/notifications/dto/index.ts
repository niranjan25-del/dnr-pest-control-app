// src/modules/notifications/dto/index.ts

import { DevicePlatform, NotificationType, UserRole } from "@prisma/client";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";

export class SendNotificationDto {
  @IsUUID("4", { message: "A valid recipient userId is required" })
  userId!: string;

  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsString()
  @IsNotEmpty({ message: "title is required" })
  @MaxLength(140)
  title!: string;

  @IsString()
  @IsNotEmpty({ message: "body is required" })
  @MaxLength(1000)
  body!: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty({ message: "FCM token is required" })
  token!: string;

  @IsEnum(DevicePlatform, { message: "platform must be IOS, ANDROID, or WEB" })
  platform!: DevicePlatform;
}

class PreferenceItemDto {
  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsOptional() @IsBoolean() push?: boolean;
  @IsOptional() @IsBoolean() inApp?: boolean;
}

export class NotificationPreferenceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreferenceItemDto)
  preferences!: PreferenceItemDto[];
}

export class BroadcastNotificationDto {
  @IsString()
  @IsNotEmpty({ message: "title is required" })
  @MaxLength(140)
  title!: string;

  @IsString()
  @IsNotEmpty({ message: "body is required" })
  @MaxLength(1000)
  body!: string;

  // Target audience by role; omit to broadcast to everyone.
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class NotificationFilterDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(NotificationType) type?: NotificationType;
}
