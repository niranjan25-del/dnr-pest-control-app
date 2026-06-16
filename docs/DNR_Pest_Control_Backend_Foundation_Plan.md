# DNR Pest Control — Backend Foundation Implementation Plan (Step 16)

**Product:** DNR Pest Control platform — backend
**Builds on:** All approved steps (esp. Backend Architecture (5), Auth (6), DB (3), API (4))
**Stack:** NestJS · PostgreSQL · Prisma · JWT · Firebase Auth · Stripe · AWS S3 · FCM
**Document type:** Backend Foundation Plan (pre-implementation)
**Version:** Draft 1.0
**Scope note:** Foundation **planning only** — folder structure, file purposes/locations, config & cross-cutting strategy, setup commands, and module build order. **No application code.** Setup commands (CLI/install) are included as explicitly requested; they scaffold, not implement.

> This step intentionally covers **only the foundation** (config, Prisma, logging, errors, response standard, security, validation, file-upload plumbing) + the **plan/order** for feature modules. Modules are built later, one at a time.

---

# Backend Foundation Overview

The foundation is the shared, cross-cutting layer every feature module depends on: typed configuration, the Prisma data layer, global guards/filters/interceptors/pipes, integration adapters (Firebase/Stripe/S3/FCM), the async queue, and health checks. Building it correctly first means every subsequent module (Auth → … → Admin) plugs into stable primitives, keeping modules thin and consistent (the modular-monolith + layered approach from Step 5).

**Goals of the foundation**
- One source of truth for config and secrets, validated at boot.
- One Prisma client lifecycle + transaction strategy.
- Uniform auth (guards), errors (filter + envelope), responses, logging, validation.
- Vendor SDKs wrapped in injectable adapters (mockable, swappable).
- Async work isolated behind a queue.

---

# Complete Folder Structure

```
dnr-pest-control-api/
├── prisma/
│   ├── schema.prisma                 # Prisma models (generated in next step) — single source of truth for data
│   ├── migrations/                   # Versioned DB migrations
│   └── seed.ts                       # Seed roles/permissions + dev data (foundation file, body later)
│
├── src/
│   ├── main.ts                       # Bootstrap: global pipes/filters/interceptors, versioning, CORS, Helmet, Swagger
│   ├── app.module.ts                 # Root module: imports global + (later) feature modules
│   │
│   ├── config/                       # Typed, validated configuration
│   │   ├── config.module.ts          #   Global ConfigModule registration
│   │   ├── configuration.ts          #   Loads & namespaces env (app/db/jwt/firebase/stripe/aws/fcm/redis)
│   │   └── env.validation.ts         #   Validates env at boot (fail-fast) — app won't start if misconfigured
│   │
│   ├── database/                     # Persistence layer
│   │   ├── prisma.module.ts          #   Global module exposing PrismaService
│   │   └── prisma.service.ts         #   Prisma client lifecycle (connect/disconnect), tx helper, shutdown hooks
│   │
│   ├── common/                       # Framework-level cross-cutting building blocks (no feature logic)
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts   # Extract authenticated user from request
│   │   │   ├── roles.decorator.ts          # @Roles(...) metadata for RolesGuard
│   │   │   ├── permissions.decorator.ts    # @Permissions(...) metadata for PermissionsGuard
│   │   │   └── public.decorator.ts         # @Public() to bypass JwtAuthGuard
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts            # Global authentication (verifies app JWT)
│   │   │   ├── roles.guard.ts               # Role checks
│   │   │   ├── permissions.guard.ts         # Fine-grained permission checks
│   │   │   └── ownership.guard.ts           # Resource ownership/assignment checks
│   │   ├── interceptors/
│   │   │   ├── response.interceptor.ts      # Wrap success responses in standard envelope
│   │   │   ├── logging.interceptor.ts       # Request/response + latency + correlation id (no secrets)
│   │   │   └── timeout.interceptor.ts       # Request timeout safety
│   │   ├── filters/
│   │   │   └── all-exceptions.filter.ts     # Global error → standard error envelope (code/message/details/request_id)
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts           # Global ValidationPipe config (whitelist/transform)
│   │   ├── interfaces/
│   │   │   ├── jwt-payload.interface.ts      # Token claim shape
│   │   │   ├── api-response.interface.ts     # Success/error envelope types
│   │   │   └── authenticated-request.interface.ts # Request with user attached
│   │   ├── exceptions/
│   │   │   └── domain.exceptions.ts          # Typed domain errors (BookingConflict, CouponInvalid, etc.)
│   │   ├── constants/
│   │   │   ├── roles.constant.ts             # Role names
│   │   │   ├── permissions.constant.ts       # Permission keys
│   │   │   └── app.constants.ts              # Misc constants (pagination defaults, etc.)
│   │   ├── utils/
│   │   │   ├── pagination.util.ts            # Page/limit parsing + meta builder
│   │   │   ├── money.util.ts                 # Decimal/minor-unit helpers (no floats)
│   │   │   └── date.util.ts                  # ISO/time-window helpers
│   │   └── middleware/
│   │       └── correlation-id.middleware.ts  # Assigns request_id for tracing/logging
│   │
│   ├── integrations/                 # Injectable adapters around external SDKs (mockable)
│   │   ├── firebase/
│   │   │   ├── firebase.module.ts
│   │   │   └── firebase.service.ts           # Admin SDK init + verifyIdToken (Step 6)
│   │   ├── stripe/
│   │   │   ├── stripe.module.ts
│   │   │   └── stripe.service.ts             # Intents, customers, subscriptions, refunds, webhook verify
│   │   ├── aws-s3/
│   │   │   ├── s3.module.ts
│   │   │   └── s3.service.ts                 # Presigned URLs, upload/delete (private buckets)
│   │   └── fcm/
│   │       ├── fcm.module.ts
│   │       └── fcm.service.ts                # Push send, token/topic management
│   │
│   ├── queue/                        # Async processing (BullMQ/Redis)
│   │   ├── queue.module.ts                   # Queue registration/connection
│   │   └── processors/                       # (Later) notification/billing/sync processors
│   │
│   ├── logger/                       # Structured logging
│   │   ├── logger.module.ts
│   │   └── logger.service.ts                 # JSON logger (Pino/Nest), levels, redaction
│   │
│   ├── health/                       # Liveness/readiness
│   │   ├── health.module.ts
│   │   └── health.controller.ts              # /health (DB/redis checks) for orchestration/LB
│   │
│   └── modules/                      # Feature modules (built later, in Development Order)
│       └── (auth, users, customers, technicians, services, bookings,
│             payments, invoices, notifications, chat, reviews, reports, admin)
│
├── test/                             # e2e tests
├── .env.development                  # Dev env (gitignored)
├── .env.staging                      # Staging env (gitignored)
├── .env.production                   # Prod env (gitignored / from secrets manager)
├── .env.example                      # Committed template (no secrets)
├── .eslintrc.js / .prettierrc        # Lint/format
├── tsconfig.json
├── nest-cli.json
├── package.json
├── Dockerfile                        # Container build
└── docker-compose.yml                # Local Postgres + Redis for dev
```

Every file above is foundation-level. Feature-module files are added per the Development Order and are not created in this step.

---

# Environment Configuration

Three environments via separate env files + a committed `.env.example`. Secrets come from a **secrets manager/KMS** in staging/prod (never committed). Loaded and **validated at boot** by `env.validation.ts`.

| Variable group | Keys (examples) | Dev | Staging | Prod |
|---|---|---|---|---|
| App | `NODE_ENV`, `PORT`, `API_VERSION`, `CORS_ORIGINS` | local | staging | prod |
| Database | `DATABASE_URL` | local Postgres | staging DB | prod DB (pooled) |
| JWT | `JWT_SECRET`/keys, `ACCESS_TTL`, `REFRESH_TTL` | test secret | secret mgr | secret mgr |
| Firebase | `FIREBASE_PROJECT_ID`, service account | dev project | staging | prod |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | test keys | test keys | live keys |
| AWS S3 | `AWS_REGION`, `S3_BUCKET`, IAM creds/role | dev bucket | staging | prod (least-priv role) |
| FCM | `FCM_*` / service account | dev | staging | prod |
| Redis/Queue | `REDIS_URL` | local | staging | prod |
| Logging | `LOG_LEVEL` | debug | info | warn/error |

Rule: app **fails fast** at startup if any required var is missing/invalid.

---

# Configuration Module Design

- `ConfigModule` registered **global** so config is injectable everywhere without re-import.
- `configuration.ts` returns a **namespaced, typed** config object (`app`, `db`, `jwt`, `firebase`, `stripe`, `aws`, `fcm`, `redis`).
- `env.validation.ts` validates the raw env (schema-based) at boot; invalid config aborts startup with a clear message.
- Consumers inject a typed config service and read namespaced values — no `process.env` access scattered in code.

---

# Prisma Integration Strategy

- **Single `schema.prisma`** is the source of truth for all models (generated in the next step). Modules **own logical slices** of it; no module redefines models.
- `PrismaModule` is **global**; `PrismaService` extends the generated client, manages connect/disconnect, and registers **shutdown hooks** for graceful termination.
- **Transactions:** provide a transaction helper for multi-write operations (e.g., booking + status history + invoice) to keep them atomic.
- **Migrations:** `prisma migrate` for versioned schema changes; `prisma generate` for the typed client; `seed.ts` seeds roles/permissions and dev data.
- Repositories (per module, later) depend on `PrismaService`; no raw client usage in controllers/services outside the data layer.

---

# Database Connection Strategy

- Single PostgreSQL primary at launch (single-company scale, Step 5).
- **Connection pooling** via PgBouncer (or Prisma pool settings) for concurrency; configure pool size per environment.
- **Read replica** (later) for Admin reporting/analytics — route heavy reads off the primary.
- Backups/automated snapshots; encrypted at rest; least-privilege DB credentials from secrets manager.
- Health check verifies DB connectivity for readiness probes.

---

# Authentication Architecture Summary

(Per Step 6, recap for implementation.)
- **Firebase = identity provider** (email/Google/Apple); backend **verifies the Firebase ID token once** (`FirebaseService.verifyIdToken`) then issues **app JWTs**.
- **Access token** short-lived; **refresh token** hashed + stored, **rotated** on use, with reuse detection.
- **Global `JwtAuthGuard`** authenticates every request (unless `@Public`); `RolesGuard` + `PermissionsGuard` + `OwnershipGuard` authorize.
- **Staff-auth model (Option A vs B) still pending confirmation** — affects whether staff use Firebase or a direct backend credential path. Foundation supports both; Auth module needs the decision before implementation.

---

# Logging Strategy

- **Structured JSON logging** (Pino/Nest) with levels; per-request **correlation id** (`request_id`) via middleware + logging interceptor.
- Log method/path/status/latency/user-id; **redact** secrets/tokens/PII/card data/🔒 fields.
- **Audit logging** (separate, to `audit_logs`) for sensitive actions (refunds, status/permission/role changes, assignments, chemical applications, exports).
- Ship to centralized monitoring + Sentry for exceptions; environment-tuned `LOG_LEVEL`.

---

# Error Handling Strategy

- **Global `all-exceptions.filter.ts`** converts every error to the standard envelope: `{ error: { code, message, details[], request_id } }` with the right HTTP status.
- **Typed domain exceptions** map to precise codes (`409` conflict, `422` rule violation, etc.).
- `ValidationPipe` auto-emits `400` with field-level `details`.
- Integration (Firebase/Stripe/S3) errors caught in adapters and translated to safe, non-leaky errors — raw vendor errors never reach clients.
- Every error carries a `request_id` correlating to logs.

---

# API Response Standard

- **Success envelope** via `response.interceptor.ts`:
  ```
  { "data": <payload>, "meta": { ... optional pagination ... } }
  ```
- **Error envelope** (from the exception filter):
  ```
  { "error": { "code": "...", "message": "...", "details": [...], "request_id": "..." } }
  ```
- **Pagination meta:** `{ page, limit, total }`. **Versioning:** URI `/api/v1`. **Idempotency:** `Idempotency-Key` honored on booking/payment creation.

---

# Security Standards

- **TLS** everywhere; **Helmet** headers; strict **CORS** allow-list.
- **Global rate limiting** (stricter on `/auth/*` and payments).
- **JWT** short-lived + rotating hashed refresh tokens; revoke on logout/reset/role change/suspension.
- **RBAC + ownership** enforced server-side on every route.
- **No card data** stored/logged (Stripe tokens only); **webhook signature verification** with isolated raw-body route.
- **Column-level encryption** for 🔒 fields (phone, gate_code, access_notes, license_number); keys in KMS.
- **Input whitelisting** (reject unknown fields); secrets from manager; least-privilege IAM for AWS/Firebase/Stripe.
- **Audit** sensitive actions; append-only compliance tables.

---

# Validation Standards

- **Global `ValidationPipe`** (whitelist + forbidNonWhitelisted + transform).
- **DTOs per endpoint** (class-validator/class-transformer) define input contracts; validated before controllers.
- Enums/ranges/required enforced; money as decimal (never float); dates ISO-8601; phone E.164.
- Server-side validation is authoritative; matches the API spec (Step 4) and module rules.

---

# File Upload Strategy

- Binary in **AWS S3** (private buckets); only metadata in `uploaded_files`.
- **Presigned-URL flow** preferred (mobile/large files): backend issues short-lived presigned PUT; client uploads directly; backend records metadata on confirm.
- Small files may use a backend multipart endpoint.
- Type/size validation; signed expiring GET URLs for retrieval; virus-scan hook (future).
- Technician offline media queued locally, uploaded via presigned URLs on reconnect (Steps 7/10).

---

# Project Setup Commands

> Commands scaffold the project and install dependencies — they do not implement application logic.

### NestJS setup
```
# Install Nest CLI and scaffold
npm i -g @nestjs/cli
nest new dnr-pest-control-api

# Core Nest packages
npm i @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt
npm i @nestjs/throttler helmet
npm i @nestjs/swagger swagger-ui-express
npm i @nestjs/bullmq bullmq ioredis
npm i @nestjs/terminus            # health checks
npm i class-validator class-transformer
npm i nestjs-pino pino-http       # structured logging
```

### Prisma setup
```
npm i -D prisma
npm i @prisma/client
npx prisma init                   # creates prisma/schema.prisma + .env
# (schema authored in next step, then:)
npx prisma migrate dev --name init
npx prisma generate
npx prisma db seed                # roles/permissions + dev data
```

### Integrations & utilities
```
npm i firebase-admin              # Firebase Auth verification + FCM
npm i stripe                      # Stripe (payments/subscriptions/webhooks)
npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner   # AWS S3
npm i argon2                      # password hashing (if staff direct-credential path)
npm i uuid
```

### Local infra (dev)
```
# docker-compose.yml provides Postgres + Redis
docker compose up -d
```

### Quality/tooling
```
npm i -D eslint prettier jest @types/jest ts-jest supertest @types/supertest
```

> Pin exact versions at setup time and verify compatibility (esp. Nest major version, Prisma, Stripe SDK).

---

# Development Order

Build the **foundation first** (this document's files), then feature modules in this exact sequence — each depends on the ones before it:

1. **Auth Module** — login/register/refresh/logout, Firebase exchange, token issuance/rotation. *Depends on:* foundation (config, prisma, guards, integrations/firebase). Confirm staff-auth model first.
2. **Users Module** — user/role/permission management; powers RolesGuard/PermissionsGuard. *Depends on:* Auth.
3. **Customer Module** — customer profile + addresses (🔒 encryption). *Depends on:* Users.
4. **Technician Module** — technician profile, licensing, availability. *Depends on:* Users.
5. **Booking Module** — bookings, status history, assignments, rules (lead time, overlap, cancellation). *Depends on:* Customers, Technicians, Services. **Confirm status-model extension** (`accepted/arrived/waiting`).
6. **Services Module** — services, packages, subscriptions, coupons, pricing. *Depends on:* Users (admin). (Note: needed by Booking — implement catalog read-side alongside/just before Booking.)
7. **Payments Module** — invoices, intents, confirm, refunds, Stripe webhooks, recurring billing. *Depends on:* Bookings, Services. **Confirm financial policies + tax.**
8. **Notifications Module** — notification persistence, device tokens, FCM/SMS/email dispatch via queue. *Depends on:* foundation queue + integrations.
9. **Chat Module** *(future scope)* — conversations/messages, WS gateway. *Depends on:* Users, foundation. Defer per MVP.
10. **Reports Module** — service reports + **chemical/compliance** (append-only), compliance export. *Depends on:* Bookings, Technicians. **Confirm compliance fields.**
11. **Admin Module** — dashboard, user/booking management, reporting/analytics, role/permission admin. *Depends on:* all above.

> Practical note: Services (6) catalog read-side is required by Booking (5); implement catalog before/with Booking even though it's numbered after. The sequence otherwise reflects strict dependency order.

---

# Backend Readiness Review

### 1. Risks
| Risk | Severity | Note |
|---|---|---|
| **Staff-auth model unconfirmed** (Step 6 Option A/B) | High | Blocks Auth module specifics; foundation supports both but the decision is needed first |
| **Status-model extension** (`accepted/arrived/waiting`) | Medium–High | Must be in the Prisma schema before Booking; decide now |
| **Compliance fields unconfirmed** (since Step 1) | High | Blocks Reports module final implementation + schema for `chemical_applications` |
| **Financial policies + tax** unconfirmed | Medium–High | Blocks Payments module specifics |
| **Provider/env setup** (Firebase/Stripe/S3/FCM/Redis) | Medium | Must be provisioned before modules that use them |
| **Prisma in modular monolith** ownership discipline | Medium | Enforce module-owned models by convention/review |

### 2. Recommendations
1. **Build and stabilize the foundation first** (config → prisma → common → integrations → queue → logger → health) before any module.
2. **Confirm the three structural decisions now**: staff-auth model, status-model extension, and (for Reports/schema) compliance fields.
3. **Provision all environments + secrets** (dev/staging/prod) and integration sandboxes before module work.
4. **Implement modules strictly in dependency order**; keep each thin (controller→service→repository).
5. **Adopt the transaction helper** for multi-write flows (booking+status+invoice) from the start.
6. **Wire CI early** (lint/test/build + migrations) to keep the foundation healthy.

### 3. Missing requirements (to be supplied)
- **Staff-auth model** (Option A vs B).
- **Status-model extension** confirmation (enum additions).
- **Compliance/chemical field set** (jurisdiction) — affects schema + Reports.
- **Financial policies + tax model** (Payments).
- **Service-area definition** (for Booking validation logic).
- **Provider credentials/config** per environment.

### 4. Readiness score before Prisma Schema Generation
**8 / 10 — Ready to generate the Prisma schema.**
The foundation plan is complete, production-grade, and consistent with all upstream designs; the schema can be generated next from the Step 3 database design. Two items should be **locked before/at schema generation** because they change the schema itself: the **status-model extension** (new enum values) and the **compliance/chemical field set** (the `chemical_applications` shape). The staff-auth model and financial/tax policies affect *module* implementation rather than the core schema, so they can be confirmed slightly later. Locking the two schema-affecting items lifts this to ~9.5/10.

*Next step on approval: Prisma Schema Generation.*

---
**Stopping here per instruction.** No application code generated; foundation plan and module build order only. Awaiting approval to proceed to Prisma Schema Generation.
