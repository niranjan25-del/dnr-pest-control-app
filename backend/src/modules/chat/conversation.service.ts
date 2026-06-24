// src/modules/chat/conversation.service.ts
//
// Conversation lifecycle + access control. Permission matrix:
//   • ADMIN ↔ anyone
//   • CUSTOMER ↔ ADMIN (support) or a TECHNICIAN assigned to one of their bookings
//   • TECHNICIAN ↔ ADMIN or a CUSTOMER they're assigned to
// createOrGet is idempotent for a (pair[, booking]) so repeated opens reuse one thread.
// assertParticipant guards every read/write (throws UNAUTHORIZED_CONVERSATION_ACCESS).

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "src/database/prisma.service";
import { paginate } from "src/common/utils/pagination.util";
import { AuthenticatedUser } from "../auth/interfaces/auth.interfaces";
import { ConversationFilterDto, CreateConversationDto } from "./dto";
import { ConversationView, MessageView } from "./interfaces";

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  constructor(private readonly prisma: PrismaService) {}

  async createOrGet(
    actor: AuthenticatedUser,
    dto: CreateConversationDto,
  ): Promise<ConversationView> {
    if (dto.participantId === actor.id) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Cannot start a conversation with yourself",
      });
    }
    await this.assertCanChat(actor, dto.participantId);

    const existing = await this.prisma.chatConversation.findFirst({
      where: {
        ...(dto.bookingId ? { bookingId: dto.bookingId } : {}),
        AND: [
          { participants: { some: { userId: actor.id } } },
          { participants: { some: { userId: dto.participantId } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });
    if (existing) return this.view(actor.id, existing.id);

    const created = await this.prisma.$transaction(async (tx) => {
      const conv = await tx.chatConversation.create({
        data: { bookingId: dto.bookingId },
      });
      await tx.chatParticipant.createMany({
        data: [
          { conversationId: conv.id, userId: actor.id },
          { conversationId: conv.id, userId: dto.participantId },
        ],
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "chat.conversation_created",
          entityType: "chat_conversation",
          entityId: conv.id,
          metadata: { with: dto.participantId, bookingId: dto.bookingId },
        },
      });
      return conv;
    });
    this.logger.log(
      `Conversation ${created.id} created by ${actor.id} with ${dto.participantId}`,
    );
    return this.view(actor.id, created.id);
  }

  async list(actor: AuthenticatedUser, filter: ConversationFilterDto) {
    const where: Prisma.ChatConversationWhereInput = {
      participants: { some: { userId: actor.id } },
      ...(filter.activeOnly ? { isActive: true } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.chatConversation.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: filter.skip,
        take: filter.limit,
        select: { id: true },
      }),
      this.prisma.chatConversation.count({ where }),
    ]);
    const views = await Promise.all(rows.map((r) => this.view(actor.id, r.id)));
    return paginate(views, total, filter.page, filter.limit);
  }

  async get(actor: AuthenticatedUser, id: string): Promise<ConversationView> {
    await this.assertParticipant(id, actor.id);
    return this.view(actor.id, id);
  }

  async archive(actor: AuthenticatedUser, id: string) {
    await this.assertParticipant(id, actor.id);
    await this.prisma.chatConversation.update({
      where: { id },
      data: { isActive: false },
    });
    this.logger.log(`Conversation ${id} archived by ${actor.id}`);
    return { success: true };
  }

  // -------- guards & permissions --------
  async assertParticipant(conversationId: string, userId: string) {
    const p = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { conversationId: true },
    });
    if (!p) {
      const exists = await this.prisma.chatConversation.findUnique({
        where: { id: conversationId },
        select: { id: true },
      });
      if (!exists)
        throw new NotFoundException({
          code: "CONVERSATION_NOT_FOUND",
          message: "Conversation not found",
        });
      throw new ForbiddenException({
        code: "UNAUTHORIZED_CONVERSATION_ACCESS",
        message: "You are not a participant of this conversation",
      });
    }
  }

  async participantUserIds(conversationId: string): Promise<string[]> {
    const rows = await this.prisma.chatParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  private async assertCanChat(actor: AuthenticatedUser, targetUserId: string) {
    if (actor.role === UserRole.ADMIN) return;
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, deletedAt: null },
      select: { role: true },
    });
    if (!target)
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "Target user not found",
      });
    if (target.role === UserRole.ADMIN) return; // support channel always allowed

    if (
      actor.role === UserRole.CUSTOMER &&
      target.role === UserRole.TECHNICIAN
    ) {
      if (await this.assignmentExists(actor.id, targetUserId)) return;
    }
    if (
      actor.role === UserRole.TECHNICIAN &&
      target.role === UserRole.CUSTOMER
    ) {
      if (await this.assignmentExists(targetUserId, actor.id)) return;
    }
    throw new ForbiddenException({
      code: "UNAUTHORIZED_CONVERSATION_ACCESS",
      message: "You are not permitted to chat with this user",
    });
  }

  /** True if the customer (by userId) has a booking assigned to the technician (by userId). */
  private async assignmentExists(
    customerUserId: string,
    technicianUserId: string,
  ): Promise<boolean> {
    const assignment = await this.prisma.technicianAssignment.findFirst({
      where: {
        technician: { userId: technicianUserId },
        booking: { customer: { userId: customerUserId } },
      },
      select: { id: true },
    });
    return Boolean(assignment);
  }

  // -------- view assembly --------
  private async view(
    viewerUserId: string,
    conversationId: string,
  ): Promise<ConversationView> {
    const conv = await this.prisma.chatConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, role: true, fullName: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            media: { select: { id: true, url: true, contentType: true } },
          },
        },
      },
    });
    const me = conv.participants.find((p) => p.userId === viewerUserId);
    const unread = await this.prisma.chatMessage.count({
      where: {
        conversationId,
        senderId: { not: viewerUserId },
        ...(me?.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}),
      },
    });
    const last = conv.messages[0];
    return {
      id: conv.id,
      booking_id: conv.bookingId,
      is_active: conv.isActive,
      participants: conv.participants.map((p) => ({
        user_id: p.user.id,
        role: p.user.role,
        name: p.user.fullName,
      })),
      last_message: last ? this.messageView(last) : null,
      unread_count: unread,
      updated_at: conv.updatedAt,
    };
  }

  private messageView(m: {
    id: string;
    conversationId: string;
    senderId: string;
    type: MessageView["type"];
    status: MessageView["status"];
    content: string | null;
    createdAt: Date;
    media?: { id: string; url: string | null; contentType: string } | null;
  }): MessageView {
    return {
      id: m.id,
      conversation_id: m.conversationId,
      sender_id: m.senderId,
      type: m.type,
      status: m.status,
      content: m.content,
      created_at: m.createdAt,
      media: m.media
        ? {
            id: m.media.id,
            url: m.media.url,
            content_type: m.media.contentType,
          }
        : null,
    };
  }
}
