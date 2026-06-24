// src/modules/chat/dto/index.ts

import { MessageType } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";

export class CreateConversationDto {
  // The counterpart user to chat with (assigned technician / customer / admin support).
  @IsUUID("4", { message: "A valid participantId is required" })
  participantId!: string;

  // Optionally tie the conversation to a booking for context.
  @IsOptional()
  @IsUUID("4")
  bookingId?: string;
}

export class SendMessageDto {
  @IsUUID("4", { message: "A valid conversationId is required" })
  conversationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  // Reference to a previously-uploaded attachment (see /chat/attachments/upload-url).
  @IsOptional()
  @IsUUID("4")
  mediaId?: string;
}

export class MarkMessageReadDto {
  @IsUUID("4")
  conversationId!: string;

  // Mark read up to and including this message; omit to mark the whole conversation read.
  @IsOptional()
  @IsUUID("4")
  messageId?: string;
}

export class ConversationFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;
}

export class MessageHistoryFilterDto extends PaginationQueryDto {}

// Additive (flagged): mint a presigned upload URL for an attachment.
export class UploadUrlDto {
  @IsString()
  @IsNotEmpty({ message: "contentType is required" })
  contentType!: string;

  @IsString()
  @IsNotEmpty({ message: "filename is required" })
  @MaxLength(200)
  filename!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;
}
