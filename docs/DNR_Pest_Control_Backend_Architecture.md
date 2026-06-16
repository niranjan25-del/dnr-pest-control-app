# DNR Pest Control — Backend Architecture (Step 5)

**Product:** DNR Pest Control Platform
**Builds on:** PRD (1) + System Architecture (2) + Database Design (3) + API Spec (4)
**Stack:** NestJS · PostgreSQL · Prisma ORM · JWT · Firebase Auth · AWS S3 · Stripe · Firebase Cloud Messaging (FCM)
**Document type:** Backend Architecture Design
**Version:** Draft 1.0
**Scope note:** Architecture and design only. **No code.** Implementation begins after this is approved.

> Terminology note: With **Prisma**, the single source of truth is the Prisma schema (models), not per-module ORM entity classes (as in TypeORM). Where this document says **"Entities"** per module, it means the Prisma models that module owns plus the domain/types it exposes. There is one shared Prisma schema; modules own logical slices of it.

> Auth note: The stack lists **both** JWT and Firebase Auth. They are layered, not redundant — Firebase is the **identity provider** (login, social, phone OTP, email verification); the NestJS backend **verifies the Firebase ID token once, then issues its own application JWTs** carrying `role` and permissions. All subsequent API calls use the app's JWT. This is detailed in the Authentication section.

---

# Backend Architecture Overview

The backend is a **modular monolith** (per Step 2) built on NestJS, exposing the REST API from Step 4 over PostgreSQL via Prisma. It is stateless and horizontally scalable, with asynchronous work (notifications, recurring billing, sync reconciliation) offloaded to background processors.

```
        Flutter clients  +  Web Admin
                  │  HTTPS (app JWT)
                  ▼
        ┌───────────────────────────────────────────┐
        │                NestJS App                    │
        │  Global pipes · guards · interceptors        │
        │  ┌────────────────────────────────────────┐ │
        │  │  Feature Modules (Auth, Bookings, ...)   │ │
        │  │  Controller → Service → Repository(Prisma)│ │
        │  └────────────────────────────────────────┘ │
        │  Shared: Config · Logger · Prisma · Queue    │
        └───────┬───────────────┬───────────────┬─────┘
                │               │               │
         PostgreSQL        Redis + Queue    Integrations
          (Prisma)         (BullMQ)         Firebase / FCM
                                            Stripe · AWS S3
```

Each request flows: **Controller** (HTTP + validation) → **Service** (business logic, rules) → **Repository/Prisma** (data). Cross-cutting concerns (auth, logging, errors, transforms) live in global/feature guards, interceptors, filters, and pipes.

---

# Application Architecture Pattern

## Modular architecture
- One NestJS **module per bounded context** (Auth, Users, Customers, Technicians, Services, Bookings, Payments, Invoices, Notifications, Chat, Reviews, Reports, Admin), mirroring the Step 4 API groups and Step 3 data domains.
- Modules expose a **service interface** to others and hide internals. Cross-module use is via injected services, never reaching into another module's repositories.
- Shared infrastructure (Prisma, config, logging, queue, integration clients) lives in **global/shared modules** imported where needed.

## Layered architecture (within each module)
| Layer | Responsibility |
|---|---|
| **Controller** | HTTP routing, request validation (DTOs + pipes), response shaping. No business logic. |
| **Service** | Business rules, orchestration, transactions, calling integrations. The "brain". |
| **Repository / Data** | Prisma access for that module's models. Encapsulates queries. |
| **DTO / Domain** | Input/output contracts and domain types. |

This keeps controllers thin, services testable, and data access swappable.

## Dependency injection strategy
- NestJS DI container wires everything; dependencies are **constructor-injected** against interfaces/tokens where useful.
- **Global modules** for `PrismaService`, `ConfigService`, `LoggerService`, queue, and integration clients (`StripeService`, `S3Service`, `FirebaseService`, `FcmService`) so they're injectable everywhere without re-importing.
- **Provider scope:** default singleton; request-scoped only where strictly needed (e.g., request context/correlation id) to avoid performance cost.
- Integration clients are wrapped in **injectable adapter services** so third parties (Stripe, S3, Firebase) can be mocked in tests and swapped without touching business logic.

---

# NestJS Project Structure

```
src/
├── main.ts                      # Bootstrap: app, global pipes/filters/interceptors, versioning, Swagger
├── app.module.ts                # Root module: imports all feature + global modules
│
├── config/                      # Typed configuration & validation
│   ├── config.module.ts         #   Global ConfigModule setup
│   ├── configuration.ts         #   Loads & groups env vars (db, jwt, stripe, aws, firebase)
│   └── env.validation.ts        #   Schema validation of env at boot (fail fast)
│
├── database/                    # Persistence layer
│   ├── prisma.module.ts         #   Global Prisma module
│   ├── prisma.service.ts        #   Prisma client lifecycle (connect/disconnect, tx helpers)
│   └── seeds/                   #   Seed scripts (roles, permissions, demo data)
│   # (prisma/schema.prisma lives at repo root by Prisma convention)
│
├── common/                      # Cross-cutting, framework-level building blocks
│   ├── decorators/              #   @CurrentUser, @Roles, @Permissions, @Public
│   ├── guards/                  #   JwtAuthGuard, RolesGuard, PermissionsGuard, OwnershipGuard
│   ├── interceptors/            #   Response transform, logging, timeout
│   ├── filters/                 #   GlobalExceptionFilter (error envelope)
│   ├── pipes/                   #   ValidationPipe config, parsing pipes
│   ├── interfaces/              #   Shared TS interfaces (JwtPayload, ApiResponse)
│   ├── constants/               #   Enums, role names, permission keys
│   └── utils/                   #   Pure helpers (pagination, money, dates)
│
├── integrations/                # External service adapters (injectable, mockable)
│   ├── firebase/                #   Firebase Admin init + ID-token verification
│   ├── stripe/                  #   StripeService (intents, customers, refunds, webhooks)
│   ├── aws-s3/                  #   S3Service (presigned URLs, upload/delete)
│   └── fcm/                     #   FcmService (push send, topic mgmt)
│
├── queue/                       # Async processing
│   ├── queue.module.ts          #   BullMQ/Redis setup
│   └── processors/              #   notification, billing, sync-reconcile jobs
│
├── modules/                     # Feature modules (bounded contexts)
│   ├── auth/
│   ├── users/
│   ├── customers/
│   ├── technicians/
│   ├── services/                #   services, packages, subscriptions, coupons
│   ├── bookings/                #   bookings, status history, assignments
│   ├── payments/
│   ├── invoices/
│   ├── notifications/
│   ├── chat/
│   ├── reviews/
│   ├── reports/                 #   service reports + chemical applications (compliance)
│   └── admin/                   #   dashboard, user mgmt, reporting endpoints
│
└── health/                      # Liveness/readiness probes for orchestration
```

**Folder explanations**
- **`main.ts`** — application bootstrap; registers global `ValidationPipe`, `GlobalExceptionFilter`, logging/transform interceptors, URI versioning, CORS, and Swagger.
- **`app.module.ts`** — composition root; imports every feature module and the global modules.
- **`config/`** — centralizes and validates environment variables at boot so misconfiguration fails immediately, not at first request.
- **`database/`** — Prisma client wrapper, connection lifecycle, transaction helpers, and seed scripts. The `schema.prisma` itself lives at repo root per Prisma convention.
- **`common/`** — reusable framework pieces: guards (auth/role/permission/ownership), decorators (`@Roles`, `@CurrentUser`), interceptors, the global exception filter that produces the Step 4 error envelope, and shared utilities.
- **`integrations/`** — thin adapter services around Firebase, Stripe, S3, and FCM. Business logic depends on these adapters, never on the vendor SDK directly — keeping vendors swappable and tests clean.
- **`queue/`** — BullMQ + Redis for background jobs: sending notifications, running recurring billing cycles, retrying failed payments, and reconciling offline-synced data.
- **`modules/`** — one folder per bounded context, each self-contained with its controller(s), service(s), DTOs, guards/interceptors as needed.
- **`health/`** — health-check endpoints for load balancers/orchestrators.

---

# Module Breakdown

> Each module follows controller → service → repository, with DTOs for I/O and Prisma models as entities. Guards/interceptors are listed where module-specific; global ones (JWT, roles) apply everywhere unless `@Public`.

### Auth Module
- **Purpose:** Login, registration, token issuance/refresh, password reset, Firebase token exchange, RBAC bootstrap.
- **Controllers:** `AuthController` (`/auth/*`).
- **Services:** `AuthService` (credential & Firebase verification, token orchestration), `TokenService` (sign/verify/rotate JWTs), `PasswordService` (hash/compare, reset tokens).
- **DTOs:** `RegisterDto`, `LoginDto`, `RefreshDto`, `ForgotPasswordDto`, `ResetPasswordDto`, `FirebaseLoginDto`.
- **Entities (Prisma):** `User`, `Role`, `Permission`, `RolePermission`, refresh-token store.
- **Guards:** issues tokens consumed by the global `JwtAuthGuard`.
- **Interceptors:** auth-event audit interceptor.

### Users Module
- **Purpose:** Core user record management shared across roles; role/permission lookups.
- **Controllers:** `UsersController` (internal/admin-facing user ops; `/auth/me` delegates here).
- **Services:** `UsersService`, `RolesService`, `PermissionsService`.
- **DTOs:** `UpdateUserDto`, `UpdateStatusDto`.
- **Entities:** `User`, `Role`, `Permission`, `RolePermission`.
- **Guards:** `RolesGuard`, `PermissionsGuard` consume this module's data.

### Customers Module
- **Purpose:** Customer profiles and addresses (incl. encrypted access data).
- **Controllers:** `CustomersController` (`/customers/*`), addresses sub-routes.
- **Services:** `CustomersService`, `AddressesService` (handles 🔒 field encryption).
- **DTOs:** `UpdateCustomerDto`, `CreateAddressDto`, `UpdateAddressDto`.
- **Entities:** `Customer`, `Address`.
- **Guards:** `OwnershipGuard` (customer can only touch own data); Admin bypass.

### Technicians Module
- **Purpose:** Technician profiles, licensing, availability, job list.
- **Controllers:** `TechniciansController` (`/technicians/*`).
- **Services:** `TechniciansService`, `AvailabilityService`.
- **DTOs:** `CreateTechnicianDto`, `UpdateTechnicianDto`, `UpdateAvailabilityDto`.
- **Entities:** `Technician`, `TechnicianAssignment` (read side).
- **Guards:** `RolesGuard` (Admin to create; Technician self-scope).

### Services Module *(catalog: services, packages, subscriptions, coupons)*
- **Purpose:** Service catalog, recurring packages, subscriptions, and coupons/discounts.
- **Controllers:** `ServicesController`, `PackagesController`, `SubscriptionsController`, `CouponsController`.
- **Services:** `ServicesService`, `PackagesService`, `SubscriptionsService`, `CouponsService` (validation & redemption rules).
- **DTOs:** `CreateServiceDto`, `CreatePackageDto`, `CreateSubscriptionDto`, `ValidateCouponDto`, `CreateCouponDto`.
- **Entities:** `Service`, `ServicePackage`, `PackageService`, `Subscription`, `Coupon`, `CouponUsage`.
- **Guards:** Admin for catalog mutations; Customer for subscribe/validate.

### Bookings Module
- **Purpose:** The core lifecycle — create, reschedule, cancel, status transitions, assignment, status history.
- **Controllers:** `BookingsController` (`/bookings/*`).
- **Services:** `BookingsService` (rules: lead time, overlap, cancellation), `AssignmentService` (dispatch, license/availability checks), `StatusHistoryService`.
- **DTOs:** `CreateBookingDto`, `RescheduleBookingDto`, `CancelBookingDto`, `AssignTechnicianDto`, `UpdateStatusDto`.
- **Entities:** `Booking`, `BookingStatusHistory`, `TechnicianAssignment`.
- **Guards:** `OwnershipGuard` (customer), assignment scope (technician), Admin full.
- **Interceptors:** status-change → notification + audit.

### Payments Module
- **Purpose:** Payment intents, confirmation, refunds, Stripe webhooks.
- **Controllers:** `PaymentsController` (`/payments/*`), `PaymentWebhookController` (raw-body, signature-verified).
- **Services:** `PaymentsService` (orchestration), depends on `StripeService` adapter.
- **DTOs:** `CreateIntentDto`, `ConfirmPaymentDto`, `RefundDto`.
- **Entities:** `Payment`, `Invoice` (write side).
- **Guards:** Customer (owner) for intents; Admin for refunds; webhook is `@Public` + signature check.
- **Interceptors:** idempotency interceptor on intent/create.

### Invoices Module
- **Purpose:** Invoice generation, listing, detail, PDF export.
- **Controllers:** `InvoicesController` (`/invoices/*`).
- **Services:** `InvoicesService`, `InvoicePdfService` (server-side PDF, stored to S3).
- **DTOs:** `InvoiceQueryDto`.
- **Entities:** `Invoice`, `Payment` (read).
- **Guards:** `OwnershipGuard`; Admin full.

### Notifications Module
- **Purpose:** Persist notifications, manage device tokens, dispatch via FCM/SMS/email through the queue.
- **Controllers:** `NotificationsController` (`/notifications/*`), device registration.
- **Services:** `NotificationsService`, `DeviceTokenService`; enqueues to `FcmService`/email/SMS processors.
- **DTOs:** `RegisterDeviceDto`, `NotificationQueryDto`.
- **Entities:** `Notification`, device-token store.
- **Interceptors:** none special; work is async via queue.

### Chat Module *(future per PRD; module scaffolded)*
- **Purpose:** Conversations and messages between customer and staff.
- **Controllers:** `ChatController` (`/conversations/*`).
- **Services:** `ConversationsService`, `MessagesService`.
- **DTOs:** `CreateConversationDto`, `SendMessageDto`, `MessageQueryDto`.
- **Entities:** `ChatConversation`, `ChatMessage`.
- **Guards:** participant-only access guard.
- **Note:** real-time delivery (WebSocket/gateway) is a future enhancement; REST contract exists now.

### Reviews Module
- **Purpose:** Customer ratings/reviews and Admin moderation.
- **Controllers:** `ReviewsController` (`/reviews/*`).
- **Services:** `ReviewsService` (one-per-booking rule, publish/moderation).
- **DTOs:** `CreateReviewDto`, `ModerateReviewDto`, `ReviewQueryDto`.
- **Entities:** `Review`.
- **Guards:** Customer (owner of completed booking); Admin moderate.

### Reports Module *(service reports + compliance)*
- **Purpose:** Technician service reports and the **append-only chemical/compliance records** — the regulatory backbone.
- **Controllers:** `ReportsController` (`/bookings/{id}/report`, report retrieval, compliance export).
- **Services:** `ServiceReportsService`, `ChemicalApplicationsService` (validates required compliance fields; append-only writes), `ComplianceExportService`.
- **DTOs:** `SubmitServiceReportDto`, `ChemicalApplicationDto`.
- **Entities:** `ServiceReport`, `ChemicalApplication`, `UploadedFile` (links).
- **Guards:** Technician (assigned) to submit; Admin to export.
- **Interceptors:** report submission → audit + customer notification.

### Admin Module
- **Purpose:** Operational dashboard, cross-cutting user management, reporting/analytics.
- **Controllers:** `AdminController` (`/admin/*`).
- **Services:** `DashboardService` (aggregations), `AdminReportsService` (revenue, utilization, retention, chemical usage).
- **DTOs:** `DashboardQueryDto`, `ReportQueryDto`, `UpdateUserStatusDto`.
- **Entities:** read-only aggregation across modules (via their services).
- **Guards:** `RolesGuard` (Admin only); future sub-role permission checks.

---

# Authentication Architecture

### JWT flow
1. Client authenticates (credentials or Firebase) → backend validates.
2. Backend issues a **short-lived access token** (e.g., ~15 min) and a **refresh token** (longer-lived, stored hashed server-side).
3. Client sends `Authorization: Bearer <access>` on every request; global `JwtAuthGuard` verifies signature, expiry, and loads the user/role context.
4. Access token carries `sub`, `role`, and minimal claims; permissions resolved server-side from `role_permissions`.

### Refresh tokens
- Stored **hashed** in a refresh-token table with device/session metadata and expiry.
- `/auth/refresh` validates, **rotates** (issues new pair, invalidates the old) to limit replay.
- Logout and password-change revoke refresh tokens; suspicious refresh attempts are rejected and audited.

### Firebase integration
- **Firebase = identity provider** for customer login flows (email/password, social, phone OTP) and email verification.
- The Flutter app obtains a **Firebase ID token**, sends it to `/auth/login` (Firebase mode); the backend verifies it via **Firebase Admin SDK** (`FirebaseService.verifyIdToken`), finds/creates the matching `User`, then **issues its own app JWTs**.
- After exchange, the app uses **only the DNR app JWT** — Firebase is not re-checked per request, avoiding latency.
- **Technicians/Admins** are provisioned by Admin; they can authenticate via the same mechanism but are never self-registered.

### Role-Based Access Control (RBAC)
- Three primary roles (`Customer`, `Technician`, `Admin`), with `role_permissions` enabling fine-grained permissions and future sub-roles (Dispatcher, Owner).
- `RolesGuard` checks the route's `@Roles(...)`; `PermissionsGuard` checks `@Permissions(...)`; `OwnershipGuard` enforces resource ownership/assignment on top of role.
- Authorization is always server-side; the client role only drives UI.

---

# Authorization Strategy

| Capability area | Customer | Technician | Admin |
|---|---|---|---|
| Own profile/addresses | ✅ manage own | ✅ own profile/availability | ✅ all |
| Browse catalog/packages | ✅ | ✅ (context) | ✅ manage |
| Create/reschedule/cancel booking | ✅ own | ❌ | ✅ any |
| View bookings | ✅ own | ✅ assigned | ✅ all |
| Update job status | ❌ | ✅ assigned | ✅ |
| Assign/reassign technician | ❌ | ❌ | ✅ |
| Submit service report + chemicals | ❌ | ✅ assigned | ✅ (correct) |
| Payments (pay own invoice) | ✅ own | ❌ | ✅ |
| Refunds | ❌ | ❌ | ✅ |
| Invoices | ✅ own | ❌ | ✅ all |
| Reviews | ✅ create own | ❌ | ✅ moderate |
| GPS: push location | ❌ | ✅ own active job | — |
| GPS: view tech location | ✅ own booking | — | ✅ |
| Manage services/packages/coupons | ❌ | ❌ | ✅ |
| Manage users/technicians | ❌ | ❌ | ✅ |
| Dashboards & reports | ❌ | ❌ | ✅ |
| Compliance export | ❌ | ❌ | ✅ |

Ownership rule: role grants the *capability*; `OwnershipGuard` ensures the *specific resource* belongs to (or is assigned to) the caller.

---

# Error Handling Strategy

- A single **`GlobalExceptionFilter`** converts all errors into the Step 4 error envelope (`code`, `message`, `details[]`, `request_id`).
- Custom **domain exceptions** (e.g., `BookingConflictException`, `CouponInvalidException`) map to precise HTTP codes (`409`/`422`) so clients can react meaningfully.
- `ValidationPipe` (whitelist + transform) auto-produces `400` with field-level `details`.
- Integration failures (Stripe/S3/Firebase) are caught in adapters and translated to safe, non-leaky errors; raw vendor errors never reach clients.
- Every error carries a `request_id` correlating to logs.

---

# Logging Strategy

- **Structured JSON logging** (e.g., Pino/Nest Logger) with levels and a **correlation/request id** threaded via interceptor.
- A **logging interceptor** records method, path, status, latency, and user id (never secrets/PII payloads).
- **Audit logging** (separate from app logs) writes sensitive actions — refunds, status/permission changes, assignments, chemical applications — to `audit_logs`.
- Logs shipped to centralized monitoring (e.g., CloudWatch) with **Sentry** for exceptions.
- **Never log:** passwords, tokens, card data, gate codes, or other 🔒 fields.

---

# File Upload Strategy

- Binary files (photos, signatures, invoice PDFs) live in **AWS S3**; only metadata in `uploaded_files`.
- **Presigned URL pattern** preferred for large/mobile uploads: backend issues a short-lived presigned PUT URL; client uploads directly to S3; backend records metadata on confirmation. Reduces backend load and works well with the technician app.
- Small files may pass through a backend multipart endpoint where simpler.
- Enforce **type/size validation**, virus-scan hook (future), and **private buckets** with signed GET URLs for retrieval (no public objects).
- Offline technician media is queued locally and uploaded via presigned URLs on reconnect, decoupled from the report's data sync.

---

# Notification Architecture

- Events (booking confirmed, reminder, en route, completion, payment) are emitted by services and **enqueued** (BullMQ) — never sent on the request path.
- **Processors** fan out per channel: `FcmService` (push), email (SES/SendGrid), SMS (Twilio).
- `Notification` rows persisted for the in-app feed; device tokens managed per user.
- **Scheduled jobs** generate reminders and recurring-plan service/billing events.
- Retries and dead-letter handling on the queue for delivery resilience.

---

# Stripe Integration Architecture

- Wrapped in an injectable **`StripeService`** adapter (no vendor SDK calls in business logic).
- **Customers:** a Stripe customer is created/linked (`stripe_customer_id`) for saved methods and recurring billing.
- **One-time payments:** backend creates a **PaymentIntent**; client confirms with the provider SDK; **no card data touches the backend** (PCI scope minimized).
- **Recurring billing:** subscription cycles billed via scheduled jobs/Stripe; **failed payments** trigger retry + notification.
- **Webhooks:** dedicated raw-body endpoint with **signature verification**; events update `payments`/`invoices` idempotently.
- **Refunds:** Admin-only, audited.

---

# API Versioning Strategy

- **URI versioning** via NestJS `VersioningType.URI` → `/api/v1`.
- New versions only for breaking changes; additive changes ship in-place.
- Deprecations communicated via `Deprecation`/`Sunset` headers and changelog.
- Swagger/OpenAPI generated per version as the contract source of truth.

---

# Environment Configuration

- **Typed config** loaded and **validated at boot** (`env.validation.ts`); the app refuses to start on missing/invalid vars.
- Grouped namespaces: `database`, `jwt`, `firebase`, `stripe`, `aws`, `fcm`, `redis`, `app`.
- **Secrets** (DB creds, JWT secret, Stripe keys, AWS keys, Firebase service account) come from a managed secrets store / KMS — **never committed**.
- Separate `.env`/secret sets per environment: **development, staging, production**.
- Feature flags (e.g., enable Chat/GPS) configurable to honor the MVP boundary.

---

# Security Best Practices

1. **TLS everywhere**; HSTS; secure CORS allow-list.
2. **Helmet** for secure headers; global **rate limiting** (stricter on auth/payment).
3. **JWT** short-lived + rotating hashed refresh tokens; revoke on logout/password change.
4. **RBAC + ownership** enforced on every route, server-side.
5. **No card data** stored or logged; Stripe tokens only.
6. **Column-level encryption** for 🔒 fields (phone, gate_code, access_notes, license_number); keys in KMS.
7. **Input validation/whitelisting** via global pipe; reject unknown fields.
8. **Idempotency keys** on booking/payment creation.
9. **Webhook signature verification**; raw-body handling isolated.
10. **Audit trail** for sensitive actions; append-only compliance tables.
11. **Presigned, private S3**; no public buckets; signed expiring URLs.
12. **Dependency scanning** and least-privilege IAM for AWS/Firebase/Stripe keys.

---

# Scalability Recommendations

- **Stateless app** behind a load balancer; scale horizontally (containers/ECS/K8s).
- **Prisma connection pooling** (PgBouncer) as concurrency grows.
- **Read replicas** for Admin dashboard/reporting; route heavy reads off the primary.
- **Redis** for caching (catalog, availability, permissions) and as the BullMQ backend.
- **Queue-based async** keeps notifications/billing/sync off the request path and independently scalable.
- **Partition + retention** for high-volume tables (`technician_locations`, `audit_logs`) — handled at DB layer.
- **CDN** in front of S3 for media/report delivery.
- Modular monolith can later **split into services** along existing module seams if scale demands — but not for MVP.

---

# Backend Architecture Review

The design fully realizes the prior steps in NestJS: thirteen feature modules map 1:1 to the Step 4 API groups and Step 3 data domains, organized in a clean controller→service→repository layering with DI-driven, mockable integration adapters for Firebase, Stripe, S3, and FCM. Cross-cutting concerns (auth, RBAC, ownership, validation, errors, logging, idempotency) are centralized in `common/` and applied globally, so feature modules stay focused on business rules. The dual-auth model is reconciled coherently (Firebase as IdP, app-issued JWTs for sessions), payments keep card data out of scope, and the compliance/audit requirements from earlier steps are first-class in the Reports module and audit strategy. Async work is correctly pushed to a queue, and the structure scales horizontally while leaving a clean path to service extraction later.

# Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Dual auth (Firebase + app JWT) complexity** — easy to over- or under-verify | Medium–High | Verify Firebase token once at exchange; document the boundary; thorough auth tests |
| **Compliance fields still unconfirmed** (carried from Steps 1–3) — shapes Reports DTOs/validation | High | Confirm jurisdiction rules before building the Reports module |
| Prisma in a modular monolith — one schema shared across modules can blur ownership | Medium | Enforce module-owned model boundaries by convention/review; no cross-module repo access |
| Stripe webhook + idempotency correctness | Medium | Signature verify, idempotent handlers, dedicated raw-body route, replay tests |
| Offline-sync reconciliation logic underestimated | Medium | Treat sync as its own workstream; idempotency keys; conflict rules from Step 2 |
| Building future modules (Chat/GPS) too early | Low | Scaffold contracts, gate behind feature flags per MVP |

# Recommendations Before Authentication Module Design

1. **Lock the dual-auth boundary**: decide exactly which flows go through Firebase (likely customer social/phone/email) vs direct backend credentials (possibly technicians/admins), and confirm the app-JWT exchange model. This is the single most important decision for the next step.
2. **Confirm token lifetimes & refresh policy** (access TTL, refresh TTL, rotation, device/session tracking, max concurrent sessions).
3. **Finalize roles & permission catalog** (the `role_permissions` seed) so guards have concrete keys to check.
4. **Confirm the four long-standing inputs** still open from earlier steps — compliance fields above all, plus retention, payment provider region, and which future modules to build for MVP.
5. **Provision integration credentials/sandboxes** (Firebase project + service account, Stripe test keys, AWS S3 bucket + IAM, FCM) so the auth and payment work isn't blocked.

Once the auth boundary and token policy are locked, the Authentication Module design can proceed cleanly.

*Next step on approval: Authentication Module Design.*
