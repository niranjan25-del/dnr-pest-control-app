# DNR Pest Control — Communication System Design (Step 13)

**Product:** DNR Pest Control platform
**Builds on:** All prior approved steps (esp. DB (3) chat/notifications tables, API (4), Backend (5), role modules)
**Tech:** Firebase Cloud Messaging (FCM) · NestJS · PostgreSQL · Flutter · Twilio (SMS) · SendGrid (Email)
**Document type:** Communication System Design
**Version:** Draft 1.0
**Scope note:** Design only — flows, lifecycle, delivery, rules, edge cases. **No code.** Uses `chat_conversations`/`chat_messages`/`notifications` (Step 3) and `/conversations`, `/notifications` (Step 4).

> Scope reminder (PRD): **one-way notifications (push/SMS/email) are MVP**; **real-time chat is post-MVP**. This document designs the full system; chat is labeled *future* but specified so the contract/data are forward-compatible.

> Transport decision (recommended): real-time chat uses a **NestJS WebSocket gateway (Socket.IO)** with **PostgreSQL persistence** and **FCM as the offline-delivery fallback** — consistent with the rest of the system (single source of truth in Postgres, server-enforced permissions). Alternative (Firestore for realtime) is viable but splits the data store and auth model; not recommended given the existing architecture.

---

# Communication System Overview

### Business objectives
- Keep customers informed and confident at every step (drives trust, retention, fewer support calls).
- Coordinate field operations in real time (assignments, changes, escalations).
- Reduce no-shows and payment friction via timely, reliable messaging.

### Customer communication goals
- Always know what's happening: confirmation, reminders, technician en route, completion, receipts.
- Easy two-way contact when needed (future chat; calling in MVP).
- Control over channels and frequency.

### Operational communication goals
- Technicians get instant, actionable assignment/schedule alerts.
- Admin sees operational events (new bookings, failed payments, issues) promptly.
- Reliable multi-channel delivery with graceful fallback.

---

# Real-Time Chat System *(future per PRD)*

A unified conversation model serves three pairings, all **scoped to participants** and (usually) to a booking.

### Customer ↔ Technician chat
- Job-related coordination ("running 15 min late", access questions). Tied to a booking; available around the service window.

### Customer ↔ Admin/Support chat
- General help, billing, scheduling. May be unattached to a booking.

### Technician ↔ Admin chat
- Dispatch coordination, escalations, access issues.

### Conversation lifecycle
```
created (open) → active (messages exchanged) → idle → closed/archived
```
- Created on first message or job assignment (`POST /conversations`), `status=open`.
- Auto-archive after inactivity or job completion + window (policy).
- Reopen on new message (or restricted post-completion, per rules).

### Message delivery flow
```
Sender app → WebSocket gateway (NestJS) → persist (Postgres) → ack to sender
                                         → push to recipient socket (if connected)
                                         → if recipient offline → FCM push + unread badge
Recipient app → on open → fetch via GET /conversations/{id}/messages → mark read_at
```

### Message status handling
- **Sent** (server persisted) → **Delivered** (recipient device received) → **Read** (`read_at` set).
- Status synced over socket; reflected to sender. Failed sends retry; offline sends queue locally (see Offline Messaging).

---

# Chat Features

| Feature | Design |
|---|---|
| **Text messages** | UTF-8, length-limited; trimmed/validated; links auto-detected |
| **Image sharing** | Upload via `POST /files` (S3 presigned) → `attachment_file_id`; thumbnail + full view |
| **File attachments** | Allowed types/size-limited (e.g., PDF/image); virus-scan hook (future); private signed URLs |
| **Read receipts** | Per-message `read_at`; single/double-tick style; per-conversation unread counts |
| **Delivered status** | Device-ack over socket; distinct from read |
| **Typing indicators** | Ephemeral socket events (not persisted) |
| **Message timestamps** | Server timestamp authoritative; client shows local time; day separators |

---

# Chat Permissions

### Who can message whom
- **Customer**: with the **assigned technician** (their booking) and **Admin/Support**. Not with other customers or unrelated technicians.
- **Technician**: with **customers of their assigned jobs** and **Admin**. Not with unrelated customers.
- **Admin/Support**: with any customer or technician (support scope).

### Restrictions
- Server enforces participant membership on every message (`403` otherwise) — UI gating is not sufficient.
- Rate limiting; profanity/abuse handling (future moderation).
- No PII over-exposure; consider **number masking** for any phone hand-off (future).

### Booking-related communication rules
- Customer↔Technician chat is **gated to the booking window** (e.g., from `confirmed`/`en_route` until completion + grace), then read-only/archived.
- Post-completion follow-ups route to Admin/Support.
- All chat tied to a booking is linked for audit/history.

---

# Push Notification System

### Notification architecture
```
Domain event (booking/payment/etc.) → enqueue (BullMQ) → Notification processor
  → persist Notification row (in-app feed)
  → dispatch per channel: FCM (push) / Twilio (SMS) / SendGrid (email)
  → deep-link payload for navigation
```
Async (never on request path), with retries + dead-letter (Step 5).

### Delivery flow
- FCM sends to the user's registered device tokens; handle **foreground / background / terminated** states in Flutter; tap → deep-link (role-checked) via GoRouter.

### Device registration
- On login, app registers token: `POST /notifications/devices` (token + platform). Multiple devices per user supported.

### Token management
- Refresh listener updates token; remove on logout; prune invalid/expired tokens on FCM failure responses; map tokens → user for targeting.

---

# Customer Notifications

| Notification | Trigger | Default channels |
|---|---|---|
| Booking confirmation | Booking confirmed | push + email (+SMS) |
| Booking reminder | Before window (e.g., 24h/2h) | push + SMS |
| Technician assigned | Assignment | push |
| Technician arriving / en route | Status → en_route | push + SMS |
| Service completed | Status → completed | push + email (report link) |
| Payment confirmation | Payment success | push + email receipt |
| Review request | After completion | push (+email) |
| Plan renewal / receipt | Subscription cycle | email (+push) |

---

# Technician Notifications

| Notification | Trigger | Channels |
|---|---|---|
| New assignment | Job assigned | push (+SMS if same-day) |
| Schedule changes | Reschedule/reassignment/cancellation | push |
| Customer messages *(future)* | New chat message | push |
| Urgent alerts | Same-day change, access issue, dispatch ping | high-priority push (+SMS) |
| Service reminders | Upcoming job / start-of-day summary | push |

---

# Admin Notifications

| Notification | Trigger | Channels |
|---|---|---|
| New booking | Booking created | in-app/dashboard (+push) |
| Failed payment | Payment/renewal failure | in-app + email |
| Technician issue | Decline/absence/`waiting` escalation | in-app + push |
| Customer complaint | Support flag / low review | in-app |
| System alerts | Integration/webhook failures, queue backlog | in-app + email |

Admin alerts surface in the **exceptions-first** dashboard (Step 11).

---

# SMS Communication (Twilio)

- **Booking confirmations**, **appointment reminders**, **technician arrival alerts**, **emergency/urgent notifications**.
- Concise, branded, with link where useful; respect **opt-in/opt-out** (STOP handling) and quiet hours.
- SMS reserved for **high-value transactional** messages (reliability/cost); not for marketing by default.
- Delivery receipts tracked; failures fall back/notify (see Edge Cases).

---

# Email Communication (SendGrid)

- **Registration/verification** (verification via Firebase; transactional shell via SendGrid), **booking confirmations**, **invoices/receipts** (PDF), **service reports** (link/summary), **subscription renewals**, dunning notices.
- Branded templates; plain-text fallback; unsubscribe where applicable (not for essential transactional).
- Track delivery/open/click; handle bounces/complaints.

---

# Notification Center (in-app)

- **History:** `GET /notifications` (paginated), newest first, grouped by date.
- **Read/unread:** `read_at`; mark single (`PATCH /notifications/{id}/read`) / all (`POST /notifications/read-all`); unread badge.
- **Categories:** bookings, payments, messages, system/promos — filter chips.
- **Search & filtering:** by category/date/read state.
- Tapping deep-links to the relevant screen.

---

# Communication Preferences

Per-user, per-channel controls in Profile:
- **Push / SMS / Email** toggles, by category where useful (e.g., reminders vs promos).
- **Essential transactional** messages (e.g., payment receipts, security) may be non-disableable (policy).
- Quiet hours; preferred channel; language (future).
- Preferences enforced server-side before dispatch; opt-outs honored (incl. SMS STOP, email unsubscribe).

---

# Offline Messaging Strategy

- **Message queuing (send):** offline-composed messages stored locally with client timestamp + idempotency id; "pending" state shown.
- **Synchronization:** on reconnect, queued messages sent in order over socket/REST; server assigns authoritative timestamp; dedupe by idempotency id.
- **Receive while offline:** missed messages fetched on reconnect (`GET /conversations/{id}/messages?before=`), plus FCM push delivered the unread badge.
- **Delivery guarantees:** at-least-once with idempotent dedupe (no duplicates); ordering by server timestamp; failed sends retried with backoff; never silently drop.
- Technician offline-first principle (Step 2) extends to chat: capture/queue, sync later.

---

# Security & Privacy

- **Transport encryption:** TLS for sockets, REST, and all provider traffic; secure WebSocket (wss).
- **At rest:** messages/attachments in encrypted Postgres/S3; attachments via private signed URLs. (True end-to-end encryption is **not** provided since Admin/support may need access for disputes — note this in privacy policy.)
- **Access controls:** participant-only enforcement server-side on every message/conversation; RBAC; audit sensitive comms actions.
- **Data retention:** chat/notifications retained per policy (Step 3 retention) — medium/long for support/disputes; purges scheduled; comply with deletion requests while preserving legally required records.
- **Privacy:** no sensitive data in lock-screen previews where configurable; number masking for calls (future); clear consent for SMS/email; no PII in logs/analytics.

---

# Communication Analytics

| Metric | Source |
|---|---|
| Messages sent | chat send events |
| Messages delivered | device-ack events |
| Read rate | `read_at` / sent |
| Push delivered/opened | FCM + deep-link opens |
| SMS delivered/failed | Twilio delivery receipts |
| Email delivered/open/click/bounce | SendGrid events |
| Notification engagement | tap-through by category |
| Reminder → show-up correlation | bookings vs reminder delivery |

(Aggregate, no message content in analytics; ids only; respect consent.)

---

# Edge Cases

| Case | Behavior |
|---|---|
| **Device offline** | Queue outgoing; fetch missed on reconnect; FCM badge; no message loss |
| **SMS delivery failure** | Retry; fall back to push/email for critical alerts; log; surface to Admin if persistent |
| **Email bounce** | Track hard/soft bounce; suppress hard-bounced; notify Admin; prompt customer to update email |
| **Notification failure** (FCM) | Retry; prune dead tokens; multi-channel fallback for critical events |
| **Chat sync issues** | Idempotent dedupe; server-timestamp ordering; reconcile on reconnect; conflict-free (append-only) |
| **Duplicate token / multi-device** | Dispatch to all valid tokens; dedupe events |
| **Opt-out conflicts** | Honor opt-out except essential transactional (policy); never send disabled categories |
| **Webhook/provider outage** | Queue + retry; degrade gracefully; alert Admin |
| **Message to closed/expired conversation** | Block or route to Admin per rules; clear messaging |

---

# Communication System Review

### 1. Risks
| Risk | Severity | Note |
|---|---|---|
| **Real-time chat scope vs MVP** | Medium | Chat is post-MVP; avoid over-building; ship notifications + calling first |
| **Multi-channel delivery reliability** | Medium–High | Need retries, fallback, dedupe, provider-failure handling across FCM/Twilio/SendGrid |
| **WebSocket scaling & state** | Medium | Sticky sessions / adapter (e.g., Redis) for socket scale-out when chat ships |
| **No true E2E encryption** | Medium | Support/Admin access required; must be disclosed in privacy policy |
| **Opt-out / compliance (SMS/email)** | Medium | STOP/unsubscribe, consent, quiet hours; regional rules (e.g., TCPA-style) |
| **Notification fatigue** | Low–Medium | Sensible defaults + category controls to avoid opt-out churn |

### 2. Recommendations
1. **Ship MVP comms first** (transactional push/SMS/email + in-app center + calling); add real-time chat post-MVP.
2. **Treat the queue + multi-channel fallback as core** — retries, dedupe, provider-outage handling, dead-token pruning.
3. **When chat ships, use the NestJS WS gateway + Redis adapter** for scale; Postgres persistence; FCM fallback.
4. **Define retention + privacy policy** for messages (no E2E; access disclosed) and honor deletion requests.
5. **Respect consent rigorously** (SMS STOP, email unsubscribe, quiet hours) — enforce server-side.
6. **Design notification defaults thoughtfully** + give category-level controls to prevent fatigue/opt-outs.
7. **Correlate reminders with show-up rates** to tune reminder timing (reduces no-shows — a PRD goal).

### 3. Missing requirements (to be supplied)
- **Chat MVP decision** (confirm post-MVP) and conversation availability rules (window, archive, reopen).
- **Reminder timing policy** (e.g., 24h + 2h) and which events use SMS vs push vs email.
- **Retention durations** for chat/notifications + privacy-policy language (no E2E).
- **Consent/compliance specifics** for SMS/email in your region.
- **Provider config:** Twilio numbers/sender IDs, SendGrid domain authentication (SPF/DKIM), FCM keys per environment.
- Which notifications are **essential/non-disableable**.

### 4. Readiness score before Maps & GPS Tracking Design
**8.5 / 10 — Ready to proceed to Maps & GPS Tracking Design.**
The communication system is comprehensively specified and integrates cleanly with the queue, data model, and role modules; the recommended transport/fallback model is sound and scoped to MVP-vs-future appropriately. Maps & GPS Tracking can proceed now (largely independent). Confirming the chat MVP decision, reminder policy, and provider/consent specifics before **comms implementation** lifts this to ~9.5/10.

*Next step on approval: Maps & GPS Tracking System Design.*
