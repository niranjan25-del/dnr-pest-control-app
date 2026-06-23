## DNR Pest Control — Chat & Messaging Module (Step 29)

**Module:** `chat` (NestJS) — production-ready
**Builds on:** Prisma schema (17) · Auth (18) · Users & Profiles (19) · Bookings (21) · Dispatch (22) · Notifications (28)
**Tech:** NestJS · Prisma · PostgreSQL · **Socket.IO (WebSockets)** · **AWS S3** (attachments)
**Scope:** Chat ONLY. No other modules generated.

> ⚠️ **REQUIRED SCHEMA ADDITIONS (for edit + soft-delete) — please approve.** `ChatMessage` is append-only with no edit/delete columns:
> ```prisma
> // add to model ChatMessage:
>   editedAt  DateTime? @map("edited_at")
>   deletedAt DateTime? @map("deleted_at")
> ```
> `prisma migrate dev --name chat_edit_delete`. Without these, the edit/delete endpoints won't run (everything else works). Soft-deleted messages are kept as **tombstones** (body/attachment nulled) so threads stay consistent.

> **Other reconciliations (no migration required):**
> - **Status "FAILED"** isn't in `MessageStatus` (SENT/DELIVERED/READ). FAILED is a **transport state** (client send-ack timeout) — if persistence fails the message simply isn't stored. Persisted lifecycle is SENT → DELIVERED → READ.
> - **Archive** → `ConversationStatus` has only OPEN/CLOSED, so archive maps to **CLOSED**. Add an `ARCHIVED` value if you want to distinguish them (optional).
> - **Message type** is **derived** (no type column): SYSTEM (sender = configured system user), IMAGE/FILE (from the attachment's FileType), else TEXT. A first-class `messageType` column is optional.

---

## Module Structure
```
src/modules/chat/
├── chat.module.ts
├── chat.gateway.ts          # Socket.IO: auth, rooms, send/receive/read, typing, presence
├── chat.controller.ts       # REST: conversations, history, attachments, read, send-fallback
├── chat.service.ts          # facade: authorize → persist → notify offline (WS + REST share)
├── conversation.service.ts  # conversation CRUD + PERMISSION model + unread
├── message.service.ts       # persistence, history (cursor), read, edit, soft-delete
├── chat-storage.service.ts  # S3 attachment upload + presigned download
├── presence.service.ts      # online/offline (Redis-ready)
├── rate-limit.service.ts    # per-user spam throttle (Redis-ready)
├── redis-io.adapter.ts      # OPTIONAL Socket.IO Redis adapter (horizontal scaling)
├── enums/ chat-events.ts · message-type.ts
├── interfaces/ chat.interfaces.ts
└── dto/ create-conversation · send-message · edit-message · query-messages
```

## Chat Permissions (the security boundary)
Enforced at creation (`assertPairingAllowed`) and on every read/send (participant check):
- **Customer ↔ assigned Technician** — must share a booking assignment (verified against `TechnicianAssignment`).
- **Customer ↔ Admin/Support** — allowed.
- **Technician ↔ Admin** — allowed.
- Customer↔Customer and Tech↔Tech are rejected.
- **Monitoring:** Super/Ops/Support may **read** any conversation but **cannot post** unless they're a participant.

## WebSocket Events
| Event | Direction | Payload |
|---|---|---|
| `connection` | — | JWT in `handshake.auth.token` |
| `disconnect` | — | — |
| `conversation:join` / `:leave` | C→S | `{ conversationId }` (join is access-checked) |
| `message:send` | C→S | `SendMessageDto` → ack `{ ok, message }` |
| `message:new` | S→C | the new message |
| `message:delivered` | C↔S | `{ messageId, conversationId }` |
| `message:read` | C→S / S→C | `{ conversationId }` → broadcasts `{ readerId, at }` |
| `typing:start` / `typing:stop` | C→S | `{ conversationId }` → `typing:update` |
| `presence:update` | S→C | `{ userId, online }` |

Namespace: **`/chat`**. Rooms: `conversation:<id>` (thread fan-out) + `user:<id>` (targeted).

## Delivery Status & Read Receipts
SENT on persist → DELIVERED when a recipient's client acks → READ when the recipient opens the thread (`message:read` advances `ChatParticipant.lastReadAt` and flags the senders' messages READ). Unread counts derive from `lastReadAt`.

## Attachments (secure)
Upload via `POST /chat/conversations/:id/attachments` (multipart, participant-only, mime + size validated) → stored in a **private, SSE-encrypted** S3 bucket, recorded as `UploadedFile`. Reference the returned `fileId` in a message. Download via `GET /chat/attachments/:fileId` → **short-lived presigned URL** (participant-authorized; never public).

## Security
- **Authorization:** participant check on every operation; pairing rules at creation; monitors read-only.
- **Attachment validation:** mime allowlist + max size (config) before any S3 write.
- **Spam/rate limiting:** per-user fixed-window throttle on `message:send` (`WsException` when exceeded); bounded body length (4000).
- **Auth:** socket handshake verifies the JWT and loads a live, ACTIVE user; REST uses the global guards.

## Notification Integration
On a new message, participants who are **offline** (presence check) get a `CHAT_MESSAGE` notification via the Notifications module (Step 28) — online users see it live. Urgent/unread follow-ups can reuse the same `notifyUser` path.

## Error Handling / Logging
- WS errors → `WsException` (client receives `chat:error`); bad auth disconnects the socket.
- REST → 400/403/404 per the API error envelope.
- `Logger` records connects, sends (ids), attachment stores, soft-deletes.

## Scaling Strategy (thousands of concurrent users)
- **Stateless gateway + rooms.** No per-connection state beyond presence; broadcasts target rooms.
- **Redis adapter** (`redis-io.adapter.ts`): relays room emits across instances so any node delivers to any socket. Enable in `main.ts` when `REDIS_URL` is set.
- **Presence & rate-limit are Redis-ready** — swap the in-memory Map/counter for Redis structures so they're shared across nodes.
- **Sticky sessions / WS-aware LB** for the WebSocket upgrade; the Redis adapter handles cross-node fan-out.
- **DB:** `chat_messages(conversation_id, created_at)` index already present → cursor pagination scales for long threads. Consider time-partitioning at very high volume.
- **Hot path off the request:** offline-notification fan-out is async; move attachment processing + heavy fan-out to a queue if needed.

---

## Setup Instructions
1. `npm i @nestjs/websockets @nestjs/platform-socket.io socket.io @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` (+ for scaling `@socket.io/redis-adapter redis`).
2. Apply the `ChatMessage` edit/delete migration (above) if you want those features.
3. Register `ChatModule` in `app.module.ts`. The gateway authenticates itself; the global HTTP guards don't apply to WS, so no extra wiring.
4. Add config namespace `chat`:
   ```ts
   chat: {
     attachmentBucket: process.env.CHAT_ATTACHMENT_BUCKET,
     downloadUrlTtlSeconds: Number(process.env.CHAT_DOWNLOAD_TTL ?? 300),
     maxAttachmentBytes: Number(process.env.CHAT_MAX_ATTACHMENT_BYTES ?? 10485760),
     allowedMimeTypes: process.env.CHAT_ALLOWED_MIME ?? 'image/jpeg,image/png,image/webp,image/gif,application/pdf',
     rateLimitMax: Number(process.env.CHAT_RATE_MAX ?? 20),
     rateLimitWindowMs: Number(process.env.CHAT_RATE_WINDOW_MS ?? 10000),
     systemUserId: process.env.CHAT_SYSTEM_USER_ID, // sender for SYSTEM messages
   }
   // reuses aws.region + jwt.accessSecret
   ```
5. (Scaling) in `main.ts`:
   ```ts
   const adapter = new RedisIoAdapter(app);
   await adapter.connectToRedis(process.env.REDIS_URL);
   app.useWebSocketAdapter(adapter);
   ```

## Environment Variables
| Variable | Required | Notes |
|---|---|---|
| `CHAT_ATTACHMENT_BUCKET` | yes | private S3 bucket |
| `AWS_REGION` | yes | shared |
| `JWT_ACCESS_SECRET` | yes | shared (socket auth) |
| `CHAT_DOWNLOAD_TTL` | no | presigned TTL (default 300) |
| `CHAT_MAX_ATTACHMENT_BYTES` | no | default 10 MB |
| `CHAT_ALLOWED_MIME` | no | comma list (images + pdf) |
| `CHAT_RATE_MAX` / `CHAT_RATE_WINDOW_MS` | no | default 20 / 10s |
| `CHAT_SYSTEM_USER_ID` | rec. | sender for SYSTEM messages |
| `REDIS_URL` | scaling | enables cross-node broadcast |

## WebSocket Configuration
- Client connects to `wss://<host>/chat` with `{ auth: { token: <accessJwt> } }`.
- `io.on('connect')` → `socket.emit('conversation:join', { conversationId })` → `socket.emit('message:send', {...})`.
- Listen for `message:new`, `message:read`, `typing:update`, `presence:update`.

## Testing Instructions
**Unit (mock Prisma):**
- conversation: pairing rules (customer↔tech needs assignment; customer↔customer rejected; admin↔anyone ok); monitor reads but `assertCanSend` rejects non-participant.
- message: create needs body or attachment; attachment must belong to the conversation; markRead advances lastReadAt + flips statuses; soft-delete redacts.
- rate-limit: N allowed then blocked within window.
- presence: offline→online / online→offline transitions.

**Integration / e2e (socket.io-client):**
- Two authed sockets join a conversation; A `message:send` → B receives `message:new`; B `message:read` → A receives read receipt.
- Exceed rate limit → `chat:error`. Disconnect B → A receives `presence:update {online:false}` and B (offline) gets a CHAT_MESSAGE notification on the next send.

---

## Example API Requests

**Create / get a conversation (customer ↔ assigned tech via booking)**
```
POST /api/v1/chat/conversations
Authorization: Bearer <customer token>

{ "bookingId": "<uuid>" }
```

**Upload an attachment then send**
```
POST /api/v1/chat/conversations/<id>/attachments    (multipart: file)
Authorization: Bearer <token>
→ { "fileId": "<uuid>", "fileType": "IMAGE" }

# then over WS:  socket.emit('message:send', { conversationId, attachmentFileId })
# or REST fallback:
POST /api/v1/chat/conversations/<id>/messages
{ "attachmentFileId": "<uuid>", "body": "Here's the photo" }
```

**Message history (cursor)**
```
GET /api/v1/chat/conversations/<id>/messages?limit=30&before=2026-06-03T10:00:00Z
Authorization: Bearer <token>
```

**Download an attachment (presigned)**
```
GET /api/v1/chat/attachments/<fileId>
→ { "url": "https://s3...X-Amz-Signature=...", "expiresInSeconds": 300 }
```

---

**Stopping after the Chat module, per instruction.** No other modules generated. The remaining backend piece is **Reports / Service Reports** (incl. the append-only `ChemicalApplication` compliance table — still needs the jurisdiction-specific pesticide field set), plus optional **Reviews/ratings** and **Admin/Audit**.
