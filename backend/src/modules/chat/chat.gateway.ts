// src/modules/chat/chat.gateway.ts
//
// Socket.IO gateway for real-time chat. Authenticates each socket via JWT on connect (token
// from handshake auth/headers/query), tracks presence, and manages per-conversation rooms.
// Messages persist through ChatService (same path as REST) and are emitted to the conversation
// room; read receipts, typing indicators, and presence are broadcast to relevant rooms.
//
// SCALING: with multiple instances, install the Socket.IO Redis adapter so rooms/emits span
// nodes (see chat.module.ts notes). Sticky sessions (or WebSocket-only transport) are required
// at the load balancer.

import {
  ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage,
  WebSocketGateway, WebSocketServer, WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { PresenceService } from './presence.service';
import { CHAT_NAMESPACE, ChatEvent, roomForConversation, roomForUser } from './enums';
import { SocketUser } from './interfaces';
import { MarkMessageReadDto, SendMessageDto } from './dto';

@WebSocketGateway({ namespace: CHAT_NAMESPACE, cors: { origin: true, credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly chat: ChatService,
    private readonly conversations: ConversationService,
    private readonly messages: MessageService,
    private readonly presence: PresenceService,
  ) {}

  // ---------------- connection lifecycle ----------------
  async handleConnection(client: Socket) {
    try {
      const user = this.authenticate(client);
      client.data.user = user;
      await client.join(roomForUser(user.id));

      const justOnline = this.presence.add(user.id, client.id);
      if (justOnline) {
        // Notify peers this user is now online. (Single-instance broadcast; with the Redis
        // adapter this spans nodes. Could be narrowed to the user's conversation rooms.)
        this.server.emit(ChatEvent.USER_ONLINE, { userId: user.id });
      }
      this.logger.log(`Socket connected: user ${user.id} (${client.id})`);
    } catch (err) {
      this.logger.warn(`Socket auth failed (${client.id}): ${(err as Error).message}`);
      client.emit(ChatEvent.ERROR, { code: 'UNAUTHORIZED', message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user as SocketUser | undefined;
    if (!user) return;
    const nowOffline = this.presence.remove(user.id, client.id);
    if (nowOffline) {
      this.server.emit(ChatEvent.USER_OFFLINE, { userId: user.id, lastSeen: this.presence.lastSeen(user.id) });
      this.logger.log(`User ${user.id} offline`);
    }
  }

  // ---------------- rooms ----------------
  @SubscribeMessage(ChatEvent.JOIN)
  async joinConversation(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }) {
    const user = this.user(client);
    await this.conversations.assertParticipant(body.conversationId, user.id);
    await client.join(roomForConversation(body.conversationId));
    // Mark previously-sent messages as delivered now that the recipient is in the room.
    await this.messages.markDelivered(body.conversationId, user.id);
    return { joined: body.conversationId };
  }

  @SubscribeMessage(ChatEvent.LEAVE)
  async leaveConversation(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }) {
    await client.leave(roomForConversation(body.conversationId));
    return { left: body.conversationId };
  }

  // ---------------- messaging ----------------
  @SubscribeMessage(ChatEvent.SEND)
  async sendMessage(@ConnectedSocket() client: Socket, @MessageBody() body: SendMessageDto) {
    const user = this.user(client);
    const { message } = await this.chat.sendMessage(user, body);
    this.server.to(roomForConversation(body.conversationId)).emit(ChatEvent.RECEIVE, message);
    return message; // ack to sender
  }

  @SubscribeMessage(ChatEvent.READ)
  async messageRead(@ConnectedSocket() client: Socket, @MessageBody() body: MarkMessageReadDto) {
    const user = this.user(client);
    const res = await this.messages.markRead(user, body.conversationId, body.messageId);
    this.server.to(roomForConversation(body.conversationId)).emit(ChatEvent.READ, {
      conversationId: body.conversationId, userId: user.id, readUpTo: res.read_up_to,
    });
    return res;
  }

  // ---------------- typing indicators ----------------
  @SubscribeMessage(ChatEvent.TYPING_START)
  typingStart(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }) {
    const user = this.user(client);
    client.to(roomForConversation(body.conversationId)).emit(ChatEvent.TYPING_START, { conversationId: body.conversationId, userId: user.id });
  }

  @SubscribeMessage(ChatEvent.TYPING_STOP)
  typingStop(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }) {
    const user = this.user(client);
    client.to(roomForConversation(body.conversationId)).emit(ChatEvent.TYPING_STOP, { conversationId: body.conversationId, userId: user.id });
  }

  // ---------------- helpers ----------------
  private authenticate(client: Socket): SocketUser {
    const raw =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.headers?.authorization as string | undefined)?.replace(/^Bearer\s+/i, '') ??
      (client.handshake.query?.token as string | undefined);
    if (!raw) throw new WsException('Missing token');
    const payload = this.jwt.verify(raw, { secret: this.config.get<string>('jwt.accessSecret') });
    return { id: payload.sub, role: payload.role, adminRole: payload.adminRole ?? null, email: payload.email, permissions: [] };
  }

  private user(client: Socket): SocketUser {
    const user = client.data.user as SocketUser | undefined;
    if (!user) throw new WsException('Unauthenticated socket');
    return user;
  }
}
