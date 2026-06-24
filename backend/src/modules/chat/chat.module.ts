// src/modules/chat/chat.module.ts
//
// Wires the chat REST + WebSocket surfaces. Registers its own JwtModule (access secret) so the
// gateway can verify socket tokens, and imports NotificationsModule for offline push.
//
// ── HORIZONTAL SCALING (Redis adapter) ───────────────────────────────────────────────────
// A single Node process holds Socket.IO rooms in memory; with >1 instance, emits won't reach
// sockets on other nodes. Install the Redis adapter and attach it in main.ts (custom adapter)
// or here in an IoAdapter:
//
//   npm i @socket.io/redis-adapter ioredis   // (already in package.json)
//
//   // main.ts
//   import { IoAdapter } from '@nestjs/platform-socket.io';
//   import { createAdapter } from '@socket.io/redis-adapter';
//   import { Redis } from 'ioredis';
//   class RedisIoAdapter extends IoAdapter {
//     private adapter;
//     async connect() {
//       const pub = new Redis(process.env.REDIS_URL!); const sub = pub.duplicate();
//       this.adapter = createAdapter(pub, sub);
//     }
//     createIOServer(port, opts?) { const s = super.createIOServer(port, opts); s.adapter(this.adapter); return s; }
//   }
//   const redisAdapter = new RedisIoAdapter(app); await redisAdapter.connect(); app.useWebSocketAdapter(redisAdapter);
//
// Also required: load-balancer sticky sessions (or force WebSocket transport), and move
// PresenceService state into Redis (keys with TTL) so presence is correct cluster-wide.

import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { NotificationsModule } from "../notifications/notifications.module";
import { ChatController } from "./chat.controller";
import { ChatGateway } from "./chat.gateway";
import { ChatService } from "./chat.service";
import { ConversationService } from "./conversation.service";
import { MessageService } from "./message.service";
import { PresenceService } from "./presence.service";
import { AttachmentService } from "./attachment.service";

@Module({
  imports: [
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("jwt.accessSecret"),
      }),
    }),
  ],
  controllers: [ChatController],
  providers: [
    ChatGateway,
    ChatService,
    ConversationService,
    MessageService,
    PresenceService,
    AttachmentService,
  ],
})
export class ChatModule {}
