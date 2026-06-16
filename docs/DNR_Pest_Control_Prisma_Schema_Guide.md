# DNR Pest Control — Prisma Schema: Explanation & Migration Guide (Step 17)

**Companion to:** `schema.prisma`
**Builds on:** Database Design (Step 3) + Backend Foundation (Step 16)
**Engine:** PostgreSQL · Prisma ORM · NestJS
**Version:** Draft 1.0

> Deliverable scope: schema + database design only. **No NestJS modules.** Stopping after the schema, per instruction.

---

# Prisma Schema Overview

### Design decisions
- **One identity, separate profiles.** `User` holds auth/identity; `CustomerProfile` and `TechnicianProfile` are 1:1 extensions. Admins are `User`s with an admin `Role` — no separate profile table.
- **Role model + enum, unified.** `Role.name` is typed by the `UserRole` enum (canonical names incl. the four admin sub-roles), while `Permission`/`RolePermission` provide fine-grained RBAC. This satisfies both "enum" and "model" needs without duplication.
- **Status model extended (as recommended).** `BookingStatus` gains `ARRIVED` and `WAITING`; `ACCEPTED` lives on `AssignmentStatus` (it's an assignment-level acknowledgement, not a booking state). This is the cleanest mapping of the technician workflow.
- **Append-only tables** for legal/financial integrity: `BookingStatusHistory`, `ChemicalApplication`, `Payment`, `ChatMessage`, `AuditLog` — corrections are new rows, never updates/deletes.
- **No card data.** `Payment` stores only `providerTransactionId` (token) + `stripeCustomerId`/`stripeSubscriptionId` references.
- **JSONB for flexible attributes** (`skills`, `targetPests`, `areasTreated`, `pestsFound`, `payload`, `serviceAreas`) where structure varies; relational everywhere correctness/reporting matters.
- **Polymorphic `UploadedFile`** via `relatedEntityType`/`relatedEntityId` (app-enforced) for generic attachments, **plus** explicit relations for signature and chat attachment where integrity matters.
- **BigInt sequence PKs** for high-volume `TechnicianLocation` and `AuditLog`; UUIDs elsewhere.

### Naming conventions
- Models **PascalCase**; tables **snake_case** via `@@map`. Fields **camelCase** in Prisma; snake_case columns via `@map`. This gives idiomatic TypeScript and idiomatic Postgres simultaneously.
- Enums SCREAMING_SNAKE values; FK fields suffixed `Id`.

### Scalability considerations
- Indexed all FKs + status/date columns; **composite indexes** for hot access paths (dispatch board, notifications, status history, locations).
- High-volume tables flagged for **time-partitioning** + **short retention** (locations, audit logs).
- Single primary now; **read replica** later for reporting (Step 5). Schema avoids hard single-tenant coupling so a `tenantId` could be added later if ever needed.

---

# Enums (rationale)

- **UserRole** — canonical roles incl. admin sub-roles (Super Admin, Ops Manager, Dispatcher, Customer Support) + Technician + Customer; used as `Role.name`.
- **BookingStatus** — full lifecycle incl. new `ARRIVED`, `WAITING`.
- **AssignmentStatus** — `ASSIGNED/ACCEPTED/DECLINED/REASSIGNED/COMPLETED/CANCELLED` (acceptance lives here).
- **PaymentStatus / PaymentMethod** — includes `APPLE_PAY`/`GOOGLE_PAY` (Step 12) and `PARTIALLY_REFUNDED`.
- **SubscriptionStatus / BillingCycle** — recurring plans incl. `PAST_DUE` for dunning.
- **InvoiceStatus, DiscountType, NotificationType/Channel, MessageStatus, ConversationStatus, DevicePlatform, FileType** — map directly to module behaviors.

---

# Models (explanations)

- **User** — root identity/auth; `passwordHash` nullable (Firebase-managed customers don't store it); `firebaseUid` links Firebase identity. Many activity back-relations.
- **Role / Permission / RolePermission** — RBAC; `Role.name` typed by `UserRole`; M:N permissions.
- **RefreshToken** — hashed, rotating session store (Step 6); device/expiry/revoke for session management.
- **DeviceToken** — FCM push targets per user/device.
- **CustomerProfile** — customer extension; `stripeCustomerId`; `defaultAddress` (named relation distinct from `addresses`).
- **TechnicianProfile** — licensing (`licenseNumber` 🔒, `licenseExpiry`), `skills`/`serviceAreas` JSON, availability.
- **Address** — service locations; `gateCode`/`accessNotes` 🔒; lat/lng for geo + service-area; geo composite index.
- **ServiceCategory / Service** — catalog with category normalization, pricing, target pests.
- **ServicePackage / PackageService** — recurring plans bundling services (M:N); `stripePriceId`.
- **Coupon / CouponUsage** — discounts + per-redemption tracking and limits.
- **Subscription** — active recurring plan; mirrors Stripe (`stripeSubscriptionId`); next billing/service dates.
- **Booking** — central transactional entity; references service or subscription (CHECK ensures one), optional coupon; `createdBy`; rich back-relations. Composite index for the dispatch board.
- **BookingStatusHistory** — append-only status timeline.
- **TechnicianAssignment** — assignment lifecycle; partial-unique (active assignment per booking) enforced in migration SQL.
- **Invoice / Payment** — billing; invoice mirrors Stripe; payment is a token-only, append-only ledger.
- **Review** — one per booking (unique), customer→technician rating; `rating` CHECK in migration.
- **Notification** — per-user multi-channel feed; composite index on `(userId, readAt)`.
- **ChatConversation / ChatParticipant / ChatMessage** — participant-based threads (more flexible than fixed customer/staff columns); messages append-only with `status`/`readAt`.
- **ServiceReport** — completed-job record; signature via explicit relation; links chemical applications.
- **ChemicalApplication** — compliance core; **placeholder field set pending jurisdiction**; append-only; indexed for compliance queries.
- **TechnicianLocation** — GPS time-series (future); BigInt PK; partition + retention candidate.
- **UploadedFile** — file metadata (binary in S3); polymorphic + explicit relations.
- **AuditLog** — tamper-evident sensitive-action log; BigInt PK; append-only.

---

# Performance Optimizations

- **Composite indexes:** `Booking(status, scheduledWindowStart)` for the dispatch board; `Notification(userId, readAt)`; `BookingStatusHistory(bookingId, createdAt)`; `ChatMessage(conversationId, createdAt)`; `TechnicianLocation(technicianId, recordedAt)`.
- **Search optimization:** index `Coupon.code`, `Invoice.invoiceNumber`, `User.email/phone`, `Service.isActive`. For customer/free-text search, add Postgres **GIN/trigram** indexes in migration (e.g., on `User.fullName`, `Address.line1`) — added via raw SQL.
- **Reporting optimization:** date/status indexes on `Booking`, `Invoice`, `Payment`; run heavy reports on a **read replica**; consider **materialized views** for revenue/utilization dashboards (created in migration, refreshed on schedule).
- **Geo:** composite `(latitude, longitude)`; upgrade to **PostGIS** if true spatial queries/polygthe service-area polygons are needed.

---

# Soft Delete Strategy

- `deletedAt` on entity tables (`User`, `CustomerProfile`, `TechnicianProfile`, `Address`, `ServiceCategory`, `Service`, `ServicePackage`, `Subscription`, `Booking`, `Invoice`, `Review`, `Coupon`, `UploadedFile`).
- Standard reads filter `deletedAt IS NULL` — implement via a **Prisma middleware/extension** so it's automatic and not forgotten per-query.
- **Never soft-delete** append-only/compliance tables (`ChemicalApplication`, `BookingStatusHistory`, `Payment`, `AuditLog`).
- Unique constraints that must allow re-use after deletion (e.g., `User.email`) should be enforced as **partial unique indexes** `WHERE deleted_at IS NULL` (raw SQL in migration; Prisma's `@unique` is unconditional).

---

# Audit Strategy

- **`AuditLog`** captures create/update/delete + auth/financial events with before/after JSONB, actor, IP, UA.
- Append-only tables provide domain-specific history (`BookingStatusHistory`, `Payment`, `ChemicalApplication`, `ChatMessage`).
- Write audit entries in the **service layer / Prisma extension** on sensitive operations; restrict table writes via DB privileges so normal roles can't tamper.
- Compliance records (`ChemicalApplication`) retained per regulation; never deleted.

---

# Migration Strategy

1. **Author** `schema.prisma` (this file) → `npx prisma migrate dev --name init` to create the initial migration + apply locally.
2. **Augment with raw SQL** in the generated migration for things Prisma can't express:
   - Partial unique index: `CREATE UNIQUE INDEX ... ON technician_assignments(booking_id) WHERE status IN ('ASSIGNED','ACCEPTED');`
   - Partial unique on soft-deleted uniques: `CREATE UNIQUE INDEX ... ON users(email) WHERE deleted_at IS NULL;`
   - CHECK constraints: `reviews.rating BETWEEN 1 AND 5`; `quantity_used >= 0`; `Booking` "service_id OR subscription_id NOT NULL".
   - GIN/trigram search indexes; materialized views for reporting.
   - Time-partitioning for `technician_locations` and `audit_logs` (declarative partitioning by month).
3. **Seed** roles/permissions (canonical `UserRole` set + permission keys) and dev data via `prisma db seed`.
4. **Staging/prod:** use `npx prisma migrate deploy` (no dev resets); review each migration; back up before applying.
5. **Discipline:** one logical change per migration; never edit applied migrations; keep `schema.prisma` and DB in lockstep.

---

# Prisma Best Practices (applied)

- snake_case DB via `@@map`/`@map`; idiomatic TS models.
- Explicit `onDelete` referential actions (Cascade for tightly-owned children; Restrict for protected references; SetNull for optional links).
- Named relations where multiple relations share a pair (e.g., `CustomerDefaultAddress` vs `CustomerAddresses`).
- Decimal for money; BigInt for high-volume PKs; `@db.Uuid`, `@db.Char`, `@db.Inet`, `@db.SmallInt` for correct Postgres types.
- Soft-delete + audit centralized via **Prisma extensions/middleware** (not per-query).
- Generated client injected via a global `PrismaService` (Step 16).

---

# Risks & Improvements

### Risks
| Risk | Severity | Note |
|---|---|---|
| **`ChemicalApplication` field set unconfirmed** | High | Placeholder; finalize against jurisdiction before prod migration — costliest table to change later |
| **Polymorphic `UploadedFile`** lacks DB-level FK for generic links | Medium | App-enforced; acceptable, but validate references in service layer |
| **Soft-delete via `@unique`** is unconditional in Prisma | Medium | Use partial unique indexes (raw SQL) for email/phone reuse after delete |
| **Partial unique (active assignment)** not expressible in Prisma | Medium | Add via raw SQL migration (documented above) |
| **JSONB drift** (`skills`, pests, areas) | Low–Medium | Validate shapes in app; revisit if heavy querying emerges |
| **High-volume tables** (`technician_locations`, `audit_logs`) | Medium | Partition + short retention from day one to avoid bloat |
| **Decimal handling in JS** | Low | Use Prisma.Decimal / a decimal lib; never coerce to JS number for money |

### Improvements (optional / future)
- **PostGIS** for real service-area polygons + spatial arrival checks (replaces lat/lng heuristics).
- **Materialized views** for revenue/utilization/retention dashboards.
- **Outbox table** for reliable event/notification dispatch (transactional outbox pattern) if delivery guarantees tighten.
- **Tenant column** if the business ever goes multi-branch/multi-tenant (currently intentionally single-tenant).
- **Tax model** tables/fields once the tax approach (Stripe Tax vs manual) is confirmed (Step 12).

---

**Stopping here per instruction.** Delivered: complete `schema.prisma` + this explanation/migration guide. No NestJS modules generated. Awaiting approval to proceed (e.g., to module implementation or to finalize the migration with the raw-SQL augmentations above).

> Single remaining schema-affecting confirmation: the **`ChemicalApplication` field set** for your jurisdiction. Everything else in the schema is production-ready; that one table should be confirmed before the production migration is locked.
