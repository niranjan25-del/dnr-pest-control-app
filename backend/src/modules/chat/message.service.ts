// src/modules/chat/message.service.ts
//
// Message persistence + read receipts + unread counts.
//
// NOTE (schema reconciliation): ChatMessage has no deletedAt — "soft delete" replaces content
// with a tombstone and unlinks the attachment (irreversible; flagged). MessageStatus has no
// FAILED. Read receipts update both the participant's lastReadAt and the affected messages'
// status → READ, in one transaction.

import {
  BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { MessageStatus, MessageType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { paginate } from 'src/common/utils/pagination.util';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { ConversationService } from './conversation.service';
import { MessageHistoryFilterDto, SendMessageDto } from './dto';
import { MessageView } from './interfaces';

const MEDIA_SELECT = { id: true, url: true, contentType: true } as const;
const DELETED_TOMBSTONE = '[message deleted]';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationService,
  ) {}

  async create(actor: AuthenticatedUser, dto: SendMessageDto): Promise<MessageView> {
    await this.conversations.assertParticipant(dto.conversationId, actor.id);
    const type = dto.type ?? (dto.mediaId ? MessageType.FILE : MessageType.TEXT);

    if (type === MessageType.TEXT && !dto.content?.trim()) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Text messages require content' });
    }
    if ((type === MessageType.IMAGE || type === MessageType.FILE) && !dto.mediaId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Attachment messages require a mediaId' });
    }
    if (dto.mediaId) {
      const media = await this.prisma.mediaFile.findFirst({ where: { id: dto.mediaId, deletedAt: null }, select: { id: true } });
      if (!media) throw new BadRequestException({ code: 'ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: {
          conversationId: dto.conversationId, senderId: actor.id, type, status: MessageStatus.SENT,
          content: dto.content ?? null, mediaId: dto.mediaId ?? null,
        },
        include: { media: { select: MEDIA_SELECT } },
      });
      await tx.chatConversation.update({ where: { id: dto.conversationId }, data: { updatedAt: new Date() } });
      return created;
    });
    this.logger.log(`Message ${message.id} sent in ${dto.conversationId} by ${actor.id}`);
    return this.toView(message);
  }

  async history(actor: AuthenticatedUser, conversationId: string, filter: MessageHistoryFilterDto) {
    await this.conversations.assertParticipant(conversationId, actor.id);
    const where: Prisma.ChatMessageWhereInput = { conversationId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.chatMessage.findMany({ where, orderBy: { createdAt: 'desc' }, skip: filter.skip, take: filter.limit, include: { media: { select: MEDIA_SELECT } } }),
      this.prisma.chatMessage.count({ where }),
    ]);
    return paginate(rows.map((r) => this.toView(r)), total, filter.page, filter.limit);
  }

  /** Mark read up to a message (or the whole conversation): bump lastReadAt + flip statuses. */
  async markRead(actor: AuthenticatedUser, conversationId: string, messageId?: string): Promise<{ read_up_to: Date }> {
    await this.conversations.assertParticipant(conversationId, actor.id);
    let upTo = new Date();
    if (messageId) {
      const target = await this.prisma.chatMessage.findFirst({ where: { id: messageId, conversationId }, select: { createdAt: true } });
      if (!target) throw new NotFoundException({ code: 'MESSAGE_NOT_FOUND', message: 'Message not found' });
      upTo = target.createdAt;
    }
    await this.prisma.$transaction([
      this.prisma.chatParticipant.update({
        where: { conversationId_userId: { conversationId, userId: actor.id } }, data: { lastReadAt: upTo },
      }),
      this.prisma.chatMessage.updateMany({
        where: { conversationId, senderId: { not: actor.id }, status: { not: MessageStatus.READ }, createdAt: { lte: upTo } },
        data: { status: MessageStatus.READ },
      }),
    ]);
    return { read_up_to: upTo };
  }

  /** Mark messages addressed to a now-online user as DELIVERED (best-effort). */
  async markDelivered(conversationId: string, recipientUserId: string): Promise<void> {
    await this.prisma.chatMessage.updateMany({
      where: { conversationId, senderId: { not: recipientUserId }, status: MessageStatus.SENT },
      data: { status: MessageStatus.DELIVERED },
    });
  }

  async softDelete(actor: AuthenticatedUser, messageId: string) {
    const message = await this.prisma.chatMessage.findUnique({ where: { id: messageId }, select: { id: true, senderId: true } });
    if (!message) throw new NotFoundException({ code: 'MESSAGE_NOT_FOUND', message: 'Message not found' });
    if (message.senderId !== actor.id && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException({ code: 'UNAUTHORIZED_CONVERSATION_ACCESS', message: 'You can only delete your own messages' });
    }
    // No deletedAt column → tombstone the content and unlink any attachment.
    await this.prisma.chatMessage.update({ where: { id: messageId }, data: { content: DELETED_TOMBSTONE, mediaId: null } });
    return { success: true };
  }

  async globalUnread(userId: string): Promise<{ total: number; per_conversation: { conversation_id: string; unread: number }[] }> {
    const parts = await this.prisma.chatParticipant.findMany({ where: { userId }, select: { conversationId: true, lastReadAt: true } });
    const per = await Promise.all(parts.map(async (p) => ({
      conversation_id: p.conversationId,
      unread: await this.prisma.chatMessage.count({
        where: { conversationId: p.conversationId, senderId: { not: userId }, ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}) },
      }),
    })));
    // ⚠ N+1 by design for clarity; for large accounts move to a single grouped/raw query.
    return { total: per.reduce((s, c) => s + c.unread, 0), per_conversation: per.filter((c) => c.unread > 0) };
  }

  private toView(m: {
    id: string; conversationId: string; senderId: string; type: MessageType; status: MessageStatus;
    content: string | null; createdAt: Date; media?: { id: string; url: string | null; contentType: string } | null;
  }): MessageView {
    return {
      id: m.id, conversation_id: m.conversationId, sender_id: m.senderId, type: m.type, status: m.status,
      content: m.content, created_at: m.createdAt,
      media: m.media ? { id: m.media.id, url: m.media.url, content_type: m.media.contentType } : null,
    };
  }
}
