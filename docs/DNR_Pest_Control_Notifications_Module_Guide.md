## DNR Pest Control — Notifications Module (Step 28)

**Module:** `notifications` (NestJS) — production-ready
**Builds on:** Prisma schema (17) · Auth (18) · Users & Profiles (19) · Bookings (21) · Dispatch (22) · Payments (24) · Invoices (25) · Subscriptions (26)
**Tech:** NestJS · Prisma · PostgreSQL · **Firebase Cloud Messaging**
**Scope:** Notifications ONLY. No other modules generated.

> ⚠️ **REQUIRED SCHEMA ADDITIONS — please approve.** The approved `Notification` model has `sentAt`/`readAt` but no preferences table, scheduling, or retry fields. This module needs:
> ```prisma
> model NotificationPreference {
>   id           String   @id @default(uuid()) @db.Uuid
>   userId       String   @unique @db.Uuid @map("user_id")
>   user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
>   pushEnabled  Boolean  @default(true)  @map("push_enabled")
>   emailEnabled Boolean  @default(true)  @map("email_enabled")
>   smsEnabled   Boolean  @default(false) @map("sms_enabled")
>   mutedTypes   Json?    @map("muted_types")     // array of NotificationType
>   updatedAt    DateTime @updatedAt @map("updated_at")
>   @@map("notification_preferences")
> }
>
> // add to model Notification:
>   scheduledFor DateTime? @map("scheduled_for")
>   retryCount   Int       @default(0) @map("retry_count")
>   failedAt     DateTime? @map("failed_at")
> ```
> Add `notificationPreference NotificationPreference?` to `User`. Then `prisma migrate dev --name notifications_prefs_scheduling`.

> **Status reconciliation:** requested PENDING/SENT/**DELIVERED**/READ/FAILED. We derive **PENDING** (`sentAt` null), **SENT** (`sentAt` set), **READ** (`readAt`), **FAILED** (`failedAt`, after retries exhausted). True **DELIVERED** requires a client read-receipt/ack (FCM doesn't reliably report device delivery) — SENT is the closest persisted state; add a client "delivered" ack endpoint later if needed.

> **Categories vs types:** the schema's `NotificationType` is granular; the 6 requested "types" are **categories** (Booking/Payment/Subscription/Assignment/Reminder/System). `enums/notification-category.ts` maps every type → category for inbox filtering.

---

## Module Structure
```
src/modules/notifications/
├── notifications.module.ts
├── notifications.controller.ts     # devices, inbox, read-state, preferences, announcements
├── notifications.service.ts        # deliver, devices, inbox, prefs, announcements, cron, @OnEvent
├── fcm.service.ts                  # firebase-admin multicast push + invalid-token pruning
├── templates/ notification-templates.ts   # type+payload → {title, body} (channel-agnostic)
├── enums/ notification-category.ts · events.ts
├── interfaces/ notification.interfaces.ts
└── dto/ register-device · query-notifications · update-preferences · send-announcement
```

## Event-Driven Architecture
Other modules **emit** domain events; Notifications **reacts** via `@OnEvent` — so adding a notification never touches business logic. Contract + payloads live in `enums/events.ts`.

**Already emitted (wired now):** `subscription.renewal_reminder`, `subscription.payment_failed`, `invoice.paid` (also consumed by Invoices for the PDF — multiple listeners are fine).

**One-line emits to add upstream** (these are the existing `// Hook:` spots):
| Module | Emit |
|---|---|
| Bookings | `emit('booking.confirmed', { bookingId })`, `emit('booking.status_changed', { bookingId, status })`, `emit('booking.created', { bookingId })` |
| Dispatch | `emit('assignment.created', { bookingId, technicianId })`, `emit('assignment.schedule_changed', { bookingId, technicianId })` |
| Payments | `emit('payment.failed', { invoiceId })` |

Until added, those notifications simply don't fire; everything else works. Modules may also call `NotificationsService.notifyUser(...)` directly (it's exported).

## Recipients (business requirements → triggers)
- **Customers:** BOOKING_CONFIRMED, TECHNICIAN_ASSIGNED→(EN_ROUTE), SERVICE_COMPLETED, PAYMENT_CONFIRMATION/PAYMENT_FAILED, PLAN_RENEWAL.
- **Technicians:** TECHNICIAN_ASSIGNED, SCHEDULE_CHANGE, CHAT_MESSAGE (Chat module), urgent SYSTEM_ALERT.
- **Admins** (Super/Ops/Dispatcher): new bookings, failed payments, system alerts (via `notifyAdmins`).

## Features → Endpoints
| Feature | Method/Path | Roles |
|---|---|---|
| Register device | `POST /api/v1/notifications/devices` | any authed |
| Unregister device | `DELETE /api/v1/notifications/devices/:token` | any authed |
| List devices | `GET /api/v1/notifications/devices` | any authed |
| Inbox (filter/paginate) | `GET /api/v1/notifications?category=&unreadOnly=` | any authed |
| Unread count | `GET /api/v1/notifications/unread-count` | any authed |
| Mark one read | `PATCH /api/v1/notifications/:id/read` | any authed (own) |
| Mark all read | `PATCH /api/v1/notifications/read-all` | any authed |
| Get preferences | `GET /api/v1/notifications/preferences` | any authed |
| Update preferences | `PATCH /api/v1/notifications/preferences` | any authed |
| Announcement / bulk | `POST /api/v1/notifications/announcements` | Super/Ops |

## Notification Templates
`buildContent(type, payload)` returns channel-agnostic `{title, body}` — reused by push + in-app today and SMS/email later (add `sms`/`email` variants without touching callers).

## FCM Integration
`FcmService` initializes firebase-admin once (reuses the app if Auth already initialized it), sends `sendEachForMulticast` to a user's tokens, and reports invalid tokens; the service then **prunes** them. If FCM env is absent, push is disabled gracefully and in-app still works.

## In-App + Preferences + Categories + History + Read
Every notification is a durable IN_APP row (history). Inbox supports category filter, unread-only, pagination, single/all mark-read, and unread badge count. Preferences gate PUSH per channel and per muted type (in-app record always kept).

## Bulk + Scheduled + Admin Announcements
`POST /announcements` targets ALL / CUSTOMERS / TECHNICIANS / explicit userIds, with optional `scheduledFor`. Scheduled items carry `scheduledFor` and are hidden from the inbox until due; the cron delivers them.

## Retry Mechanism
A `@Cron(EVERY_MINUTE)` pass picks undelivered, non-failed, due notifications with `retryCount < max`, retries the push, increments `retryCount`, and sets `failedAt` once exhausted. Bounded batch (200) — for high volume, swap in a queue (BullMQ/Redis); the delivery method is already isolated.

## Error Handling / Logging / Transaction
- Listeners resolve recipients defensively (missing entity → log + no-op, never crash the emitter).
- Push errors are caught; invalid tokens pruned; failures retried then marked FAILED.
- `Logger` records device prunes, announcement fan-out counts, retry batches.

---

## Setup Instructions
1. `npm i firebase-admin @nestjs/event-emitter @nestjs/schedule` (latter two already present from earlier modules).
2. Apply the schema additions above and migrate.
3. Ensure `EventEmitterModule.forRoot()` and `ScheduleModule.forRoot()` are registered in `app.module.ts` (already required by Subscriptions).
4. Register `NotificationsModule` in `app.module.ts`.
5. Add a `firebase` + `notifications` config namespace:
   ```ts
   firebase: {
     projectId: process.env.FIREBASE_PROJECT_ID,
     clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
     privateKey: process.env.FIREBASE_PRIVATE_KEY, // \n-escaped in env
   },
   notifications: { maxRetries: Number(process.env.NOTIFICATION_MAX_RETRIES ?? 3) },
   ```
6. Add the upstream one-line emits (table above) when ready.

## FCM Configuration
1. Firebase Console → Project Settings → **Service accounts** → *Generate new private key* (JSON).
2. Put `project_id`, `client_email`, `private_key` into the env vars below (keep the key's `\n` escaping).
3. Mobile apps obtain an FCM token and call `POST /notifications/devices`.
4. The same Admin SDK app is reused for Auth + Messaging.

## Environment Variables
| Variable | Required | Notes |
|---|---|---|
| `FIREBASE_PROJECT_ID` | yes (push) | from service account |
| `FIREBASE_CLIENT_EMAIL` | yes (push) | from service account |
| `FIREBASE_PRIVATE_KEY` | yes (push) | `\n`-escaped; quote in `.env` |
| `NOTIFICATION_MAX_RETRIES` | no | default 3 |

(If FCM vars are omitted, push is disabled and in-app notifications still work.)

## Testing Instructions
**Unit (mock Prisma/FCM):**
- notifyUser: push disabled → IN_APP row with `sentAt` set, no FCM call; push enabled → FCM called, `sentAt` set on success; muted type → no push; scheduled-future → `sentAt` null, not delivered.
- deliverPush: invalid tokens pruned; zero tokens → marked sent (in-app only).
- processDue: future scheduled skipped; failure increments retryCount; exhausted → `failedAt`.
- list/markRead/unreadCount: scoped to user; future-scheduled hidden; category filter maps types.
- listeners: each event resolves the right recipient and type (e.g. status COMPLETED → SERVICE_COMPLETED).

**Integration:** emit `subscription.renewal_reminder` → assert a PLAN_RENEWAL row for the customer's user. Register a token + a real device to verify end-to-end push in Firebase test.

---

## Example API Requests

**Register a device**
```
POST /api/v1/notifications/devices
Authorization: Bearer <token>

{ "token": "<fcm-device-token>", "platform": "IOS" }
```

**Inbox (unread, payment category)**
```
GET /api/v1/notifications?category=PAYMENT&unreadOnly=true&page=1&limit=20
Authorization: Bearer <token>
```

**Update preferences (mute renewal pushes)**
```
PATCH /api/v1/notifications/preferences
Authorization: Bearer <token>

{ "pushEnabled": true, "mutedTypes": ["PLAN_RENEWAL"] }
```

**Admin announcement (scheduled, technicians)**
```
POST /api/v1/notifications/announcements
Authorization: Bearer <ops token>

{ "target": "TECHNICIANS", "title": "Team meeting", "body": "All-hands Friday 8am.",
  "scheduledFor": "2026-06-05T07:00:00Z" }
```

---

**Stopping after the Notifications module, per instruction.** No other modules generated. Remaining: **Reports** (service reports + the pesticide/compliance field set — the last long-open input), plus **Reviews** / **Admin/Audit** / **Chat**.
