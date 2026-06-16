// src/modules/chat/chat.service.ts
//
// Facade shared by the REST controller and the WebSocket gateway, so both paths persist
// identically and trigger the same side-effects. sendMessage persists the message, then
// notifies recipients who are NOT currently connected (push via the Step-13 dispatcher) — the
// gateway separately emits the realtime event to connected participants.

import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { PresenceService } from './presence.service';
import {
  ConversationFilterDto, CreateConversationDto, MessageHistoryFilterDto, SendMessageDto,
} from './dto';
import { MessageView } from './interfaces';

@Injectable()
export class ChatService {
  constructor(
    private readonly conversations: ConversationService,
    private readonly messages: MessageService,
    private readonly presence: PresenceService,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  // conversations
  createConversation(actor: AuthenticatedUser, dto: CreateConversationDto) { return this.conversations.createOrGet(actor, dto); }
  listConversations(actor: AuthenticatedUser, filter: ConversationFilterDto) { return this.conversations.list(actor, filter); }
  getConversation(actor: AuthenticatedUser, id: string) { return this.conversations.get(actor, id); }
  archiveConversation(actor: AuthenticatedUser, id: string) { return this.conversations.archive(actor, id); }

  // messages
  getMessages(actor: AuthenticatedUser, conversationId: string, filter: MessageHistoryFilterDto) {
    return this.messages.history(actor, conversationId, filter);
  }
  markRead(actor: AuthenticatedUser, conversationId: string, messageId?: string) {
    return this.messages.markRead(actor, conversationId, messageId);
  }
  deleteMessage(actor: AuthenticatedUser, messageId: string) { return this.messages.softDelete(actor, messageId); }
  globalUnread(userId: string) { return this.messages.globalUnread(userId); }

  /**
   * Persist a message and notify offline recipients. Returns the stored message plus the
   * recipient user ids so the gateway can emit the realtime event.
   */
  async sendMessage(actor: AuthenticatedUser, dto: SendMessageDto): Promise<{ message: MessageView; recipientUserIds: string[] }> {
    const message = await this.messages.create(actor, dto);
    const recipientUserIds = (await this.conversations.participantUserIds(dto.conversationId)).filter((id) => id !== actor.id);

    const preview = message.content ?? '[attachment]';
    await Promise.all(
      recipientUserIds
        .filter((id) => !this.presence.isOnline(id)) // connected users get the realtime event instead
        .map((id) => this.dispatcher.onNewChatMessage(id, dto.conversationId, preview)),
    );
    return { message, recipientUserIds };
  }
}
