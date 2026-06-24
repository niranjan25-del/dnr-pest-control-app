// src/modules/chat/chat.controller.ts
//
// REST surface for chat (conversation/message CRUD, history, unread, attachments). Realtime
// delivery is the gateway's job; these endpoints back the initial load, history paging, and
// non-socket clients. All access is participant-scoped in the services. Static routes precede
// parameterized ones.

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../auth/decorators";
import { AuthenticatedUser } from "../auth/interfaces/auth.interfaces";
import { ChatService } from "./chat.service";
import { AttachmentService } from "./attachment.service";
import { MessageService } from "./message.service";
import {
  ConversationFilterDto,
  CreateConversationDto,
  MarkMessageReadDto,
  MessageHistoryFilterDto,
  SendMessageDto,
  UploadUrlDto,
} from "./dto";

@Controller({ path: "chat", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly attachments: AttachmentService,
    private readonly messages: MessageService,
  ) {}

  // ----- conversations -----
  @Post("conversations")
  createConversation(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateConversationDto,
  ) {
    return this.chat.createConversation(actor, dto);
  }

  @Get("conversations")
  listConversations(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() filter: ConversationFilterDto,
  ) {
    return this.chat.listConversations(actor, filter);
  }

  @Get("conversations/:id")
  getConversation(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.chat.getConversation(actor, id);
  }

  @Get("conversations/:id/messages")
  getMessages(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() filter: MessageHistoryFilterDto,
  ) {
    return this.chat.getMessages(actor, id, filter);
  }

  @Patch("conversations/:id/archive")
  archive(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.chat.archiveConversation(actor, id);
  }

  // ----- messages -----
  @Post("messages")
  @Throttle({ default: { limit: 60, ttl: 60_000 } }) // basic anti-spam; tune per product
  sendMessage(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.sendMessage(actor, dto).then((r) => r.message);
  }

  @Patch("messages/:id/read")
  markRead(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: MarkMessageReadDto,
  ) {
    return this.chat.markRead(actor, dto.conversationId, id);
  }

  @Delete("messages/:id")
  deleteMessage(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.chat.deleteMessage(actor, id);
  }

  // ----- unread -----
  @Get("unread-count")
  unreadCount(@CurrentUser() actor: AuthenticatedUser) {
    return this.chat.globalUnread(actor.id);
  }

  // ----- attachments (additive: presigned upload/download) -----
  @Post("attachments/upload-url")
  uploadUrl(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UploadUrlDto,
  ) {
    return this.attachments.createUploadUrl(actor, dto);
  }

  @Get("attachments/:mediaId/download")
  downloadUrl(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("mediaId", ParseUUIDPipe) mediaId: string,
  ) {
    return this.attachments.getDownloadUrl(actor, mediaId);
  }
}
