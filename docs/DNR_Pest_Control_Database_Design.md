# DNR Pest Control — Database Design Document (Step 3)

**Product:** DNR Pest Control Platform
**Database engine:** PostgreSQL (relational; chosen in System Architecture, Step 2)
**Builds on:** Approved Product Discovery (Step 1) + System Architecture (Step 2)
**Document type:** Logical Database Design
**Version:** Draft 1.0
**Scope note:** Logical design only — entities, fields, types, keys, constraints, relationships, and strategy. **No SQL/DDL** in this step. Physical DDL is produced after this design is approved.

### Conventions used throughout
- **Primary keys:** `UUID` (server-generated), unless a natural key is clearly better.
- **Timestamps:** `created_at`, `updated_at` as `TIMESTAMPTZ` on all mutable tables.
- **Soft delete:** `deleted_at TIMESTAMPTZ NULL` on entity tables (see Soft Delete Strategy).
- **Money:** `NUMERIC(10,2)` with an explicit `currency` where relevant — never floats.
- **Enums:** modelled as Postgres native `ENUM` or `VARCHAR` + `CHECK` (noted per field).
- **Encrypted fields:** flagged 🔒 (application/column-level encryption — see Security).

---

# Database Overview

The schema is organized into eight logical domains, all in a single PostgreSQL database (single-company, per the PRD):

| Domain | Tables |
|---|---|
| Identity & Access | `users`, `roles`, `permissions`, `role_permissions` |
| Profiles | `customers`, `technicians`, `addresses` |
| Catalog | `services`, `service_packages`, `package_services`, `coupons`, `coupon_usage` |
| Booking & Scheduling | `bookings`, `booking_status_history`, `technician_assignments`, `subscriptions` |
| Billing | `invoices`, `payments` |
| Field Work & Compliance | `service_reports`, `chemical_applications`, `technician_locations`, `uploaded_files` |
| Engagement | `reviews`, `notifications`, `chat_conversations`, `chat_messages` |
| Governance | `audit_logs` |

Tables `package_services`, `role_permissions`, `chemical_applications`, and `technician_locations` are **supporting tables** added beyond the requested list because the requirements (RBAC, recurring plans, compliance logging, GPS tracking) cannot be modelled correctly without them.

> MVP vs future: `chat_*`, `technician_locations` (live GPS), and parts of `coupons` are **future** per the PRD/architecture, but are designed now so the model is forward-compatible.

---

# Entity Relationship Design (ERD)

### Entities and how they connect (narrative)

- A **user** is the root identity. Each user has exactly one **role**; roles hold many **permissions** (many-to-many via `role_permissions`).
- A user is extended by exactly one profile: a **customer** *or* a **technician** (one-to-one). Admins need no profile table — they are users with the Admin role.
- A **customer** owns many **addresses** (one-to-many). Sensitive access data (gate codes) lives on the address, encrypted.
- The catalog holds **services** (individual treatments) and **service_packages** (recurring plans). A package bundles many services (many-to-many via `package_services`).
- A **booking** is the central transactional entity: it belongs to one customer, one address, references one service or one package, and optionally a **subscription** (if recurring) and a **coupon**.
- A booking has many **booking_status_history** rows (full status timeline) and one or more **technician_assignments** (normally one active assignment, but history is retained).
- A **subscription** represents an active recurring plan for a customer and generates future bookings.
- A booking produces one **invoice**; an invoice receives one or more **payments**.
- A completed booking yields one **service_report**, which has many **chemical_applications** (the compliance core) and is linked to **uploaded_files** (photos, signature).
- During a job, a technician emits many **technician_locations** (GPS time-series).
- A completed booking can have one **review** (from the customer about the technician).
- **notifications** belong to a user. **chat_conversations** link a customer and a technician/admin (optionally tied to a booking) and contain many **chat_messages**.
- **coupons** are used via **coupon_usage** records (one per redemption).
- **audit_logs** record sensitive changes across the system.

A visual ERD will be produced alongside the physical DDL; this document defines the logical structure that diagram will reflect.

---

# Tables

### 1. `users`
**Purpose:** Root identity and authentication record for every person (customer, technician, admin).

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| phone | VARCHAR(20) | UNIQUE (nullable), 🔒 |
| password_hash | VARCHAR(255) | NOT NULL (hashed, never plaintext) |
| role_id | UUID | **FK → roles.id**, NOT NULL |
| full_name | VARCHAR(150) | NOT NULL |
| status | ENUM(active, inactive, suspended) | NOT NULL, default active |
| email_verified_at | TIMESTAMPTZ | NULL |
| last_login_at | TIMESTAMPTZ | NULL |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL |
| deleted_at | TIMESTAMPTZ | NULL (soft delete) |

### 2. `roles`
**Purpose:** RBAC roles (Customer, Technician, Admin, + future Dispatcher/Owner).

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| name | VARCHAR(50) | UNIQUE, NOT NULL |
| description | VARCHAR(255) | NULL |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL |

### 3. `permissions`
**Purpose:** Granular action permissions assignable to roles.

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| name | VARCHAR(100) | UNIQUE, NOT NULL (e.g., `booking.create`) |
| description | VARCHAR(255) | NULL |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL |

### 4. `role_permissions` *(supporting, M:N)*
**Purpose:** Maps permissions to roles.

| Field | Type | Key / Constraint |
|---|---|---|
| role_id | UUID | **FK → roles.id** |
| permission_id | UUID | **FK → permissions.id** |
| — | — | **PK (role_id, permission_id)** |

### 5. `customers`
**Purpose:** Customer-specific profile extending a user.

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| user_id | UUID | **FK → users.id**, UNIQUE, NOT NULL (1:1) |
| customer_type | ENUM(residential, commercial) | NOT NULL |
| company_name | VARCHAR(150) | NULL (commercial only) |
| default_address_id | UUID | **FK → addresses.id**, NULL |
| stripe_customer_id | VARCHAR(100) | NULL (payment provider token ref) |
| notes | TEXT | NULL |
| created_at / updated_at / deleted_at | TIMESTAMPTZ | — |

### 6. `technicians`
**Purpose:** Technician profile, licensing, and availability.

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| user_id | UUID | **FK → users.id**, UNIQUE, NOT NULL (1:1) |
| employee_code | VARCHAR(50) | UNIQUE, NULL |
| license_number | VARCHAR(100) | NULL, 🔒 |
| license_expiry | DATE | NULL |
| skills | JSONB | NULL (service types/pests qualified for) |
| is_available | BOOLEAN | NOT NULL, default true |
| hired_at | DATE | NULL |
| created_at / updated_at / deleted_at | TIMESTAMPTZ | — |

### 7. `addresses`
**Purpose:** Service locations owned by customers; includes encrypted access data.

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| customer_id | UUID | **FK → customers.id**, NOT NULL |
| label | VARCHAR(50) | NULL (Home, Office) |
| line1 | VARCHAR(255) | NOT NULL |
| line2 | VARCHAR(255) | NULL |
| city | VARCHAR(100) | NOT NULL |
| state | VARCHAR(100) | NOT NULL |
| postal_code | VARCHAR(20) | NOT NULL |
| country | VARCHAR(2) | NOT NULL (ISO) |
| latitude | NUMERIC(9,6) | NULL |
| longitude | NUMERIC(9,6) | NULL |
| access_notes | TEXT | NULL, 🔒 |
| gate_code | VARCHAR(50) | NULL, 🔒 |
| property_type | VARCHAR(50) | NULL |
| created_at / updated_at / deleted_at | TIMESTAMPTZ | — |

### 8. `services`
**Purpose:** Individual treatment offerings and base pricing.

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| name | VARCHAR(150) | NOT NULL |
| description | TEXT | NULL |
| category | VARCHAR(100) | NULL (e.g., rodents, termites) |
| target_pests | JSONB | NULL |
| base_price | NUMERIC(10,2) | NOT NULL, CHECK ≥ 0 |
| estimated_duration_min | INTEGER | NULL |
| is_active | BOOLEAN | NOT NULL, default true |
| created_at / updated_at / deleted_at | TIMESTAMPTZ | — |

### 9. `service_packages`
**Purpose:** Recurring/bundled plans (the recurring-revenue core).

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| name | VARCHAR(150) | NOT NULL |
| description | TEXT | NULL |
| price | NUMERIC(10,2) | NOT NULL, CHECK ≥ 0 |
| billing_cycle | ENUM(monthly, quarterly, seasonal, annual) | NOT NULL |
| visit_frequency | VARCHAR(50) | NOT NULL |
| contract_length_months | INTEGER | NULL |
| is_active | BOOLEAN | NOT NULL, default true |
| created_at / updated_at / deleted_at | TIMESTAMPTZ | — |

### 10. `package_services` *(supporting, M:N)*
**Purpose:** Which services are included in each package.

| Field | Type | Key / Constraint |
|---|---|---|
| package_id | UUID | **FK → service_packages.id** |
| service_id | UUID | **FK → services.id** |
| — | — | **PK (package_id, service_id)** |

### 11. `subscriptions`
**Purpose:** A customer's active recurring plan; generates bookings.

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| customer_id | UUID | **FK → customers.id**, NOT NULL |
| package_id | UUID | **FK → service_packages.id**, NOT NULL |
| address_id | UUID | **FK → addresses.id**, NOT NULL |
| status | ENUM(active, paused, cancelled, expired) | NOT NULL, default active |
| start_date | DATE | NOT NULL |
| end_date | DATE | NULL |
| next_billing_date | DATE | NULL |
| next_service_date | DATE | NULL |
| created_at / updated_at / deleted_at | TIMESTAMPTZ | — |

### 12. `bookings`
**Purpose:** Central transactional entity for a scheduled job (one-time or plan-generated).

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| customer_id | UUID | **FK → customers.id**, NOT NULL |
| address_id | UUID | **FK → addresses.id**, NOT NULL |
| service_id | UUID | **FK → services.id**, NULL |
| subscription_id | UUID | **FK → subscriptions.id**, NULL |
| coupon_id | UUID | **FK → coupons.id**, NULL |
| booking_type | ENUM(one_time, recurring) | NOT NULL |
| scheduled_window_start | TIMESTAMPTZ | NOT NULL |
| scheduled_window_end | TIMESTAMPTZ | NOT NULL |
| status | ENUM(pending, confirmed, en_route, in_progress, completed, cancelled, no_show, follow_up) | NOT NULL |
| price | NUMERIC(10,2) | NOT NULL, CHECK ≥ 0 |
| discount_amount | NUMERIC(10,2) | default 0 |
| created_by | UUID | **FK → users.id** (customer or admin) |
| created_at / updated_at / deleted_at | TIMESTAMPTZ | — |
| — | — | CHECK (service_id IS NOT NULL OR subscription_id IS NOT NULL) |

### 13. `booking_status_history`
**Purpose:** Immutable timeline of every status change on a booking.

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| booking_id | UUID | **FK → bookings.id**, NOT NULL |
| previous_status | VARCHAR(30) | NULL |
| new_status | VARCHAR(30) | NOT NULL |
| changed_by | UUID | **FK → users.id**, NOT NULL |
| note | TEXT | NULL |
| created_at | TIMESTAMPTZ | NOT NULL (append-only; no update/delete) |

### 14. `technician_assignments`
**Purpose:** Assignment of a technician to a booking; history retained.

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| booking_id | UUID | **FK → bookings.id**, NOT NULL |
| technician_id | UUID | **FK → technicians.id**, NOT NULL |
| assigned_by | UUID | **FK → users.id**, NOT NULL |
| status | ENUM(active, reassigned, completed, cancelled) | NOT NULL |
| assigned_at | TIMESTAMPTZ | NOT NULL |
| created_at / updated_at | TIMESTAMPTZ | — |
| — | — | Partial UNIQUE: one `active` assignment per booking |

### 15. `invoices`
**Purpose:** Billable document generated from a booking or subscription cycle.

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| invoice_number | VARCHAR(50) | UNIQUE, NOT NULL |
| customer_id | UUID | **FK → customers.id**, NOT NULL |
| booking_id | UUID | **FK → bookings.id**, NULL |
| subscription_id | UUID | **FK → subscriptions.id**, NULL |
| subtotal | NUMERIC(10,2) | NOT NULL |
| tax_amount | NUMERIC(10,2) | default 0 |
| discount_amount | NUMERIC(10,2) | default 0 |
| total_amount | NUMERIC(10,2) | NOT NULL |
| currency | VARCHAR(3) | NOT NULL |
| status | ENUM(draft, issued, paid, partially_paid, overdue, void, refunded) | NOT NULL |
| issued_at | TIMESTAMPTZ | NULL |
| due_date | DATE | NULL |
| created_at / updated_at / deleted_at | TIMESTAMPTZ | — |

### 16. `payments`
**Purpose:** Payment transactions against invoices (provider-tokenized; no raw card data).

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| invoice_id | UUID | **FK → invoices.id**, NOT NULL |
| amount | NUMERIC(10,2) | NOT NULL, CHECK > 0 |
| currency | VARCHAR(3) | NOT NULL |
| method | ENUM(card, cash, bank_transfer, other) | NOT NULL |
| provider | VARCHAR(50) | NULL (e.g., stripe) |
| provider_transaction_id | VARCHAR(255) | NULL (token reference only) |
| status | ENUM(pending, succeeded, failed, refunded) | NOT NULL |
| paid_at | TIMESTAMPTZ | NULL |
| created_at / updated_at | TIMESTAMPTZ | — |

> **No PAN, CVV, or expiry stored anywhere.** Only the provider's token/reference is persisted (PCI scope minimized, per Step 2).

### 17. `reviews`
**Purpose:** Customer rating/feedback for a completed booking and technician.

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| booking_id | UUID | **FK → bookings.id**, UNIQUE, NOT NULL |
| customer_id | UUID | **FK → customers.id**, NOT NULL |
| technician_id | UUID | **FK → technicians.id**, NOT NULL |
| rating | SMALLINT | NOT NULL, CHECK 1–5 |
| comment | TEXT | NULL |
| is_published | BOOLEAN | default false |
| created_at / updated_at / deleted_at | TIMESTAMPTZ | — |

### 18. `notifications`
**Purpose:** Per-user notification records across channels.

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| user_id | UUID | **FK → users.id**, NOT NULL |
| type | VARCHAR(50) | NOT NULL (booking_confirmed, reminder, etc.) |
| channel | ENUM(push, sms, email, in_app) | NOT NULL |
| title | VARCHAR(150) | NOT NULL |
| body | TEXT | NULL |
| payload | JSONB | NULL (deep-link data) |
| read_at | TIMESTAMPTZ | NULL |
| sent_at | TIMESTAMPTZ | NULL |
| created_at | TIMESTAMPTZ | NOT NULL |

### 19. `chat_conversations` *(future)*
**Purpose:** A messaging thread between a customer and technician/admin, optionally tied to a booking.

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| booking_id | UUID | **FK → bookings.id**, NULL |
| customer_id | UUID | **FK → customers.id**, NOT NULL |
| staff_user_id | UUID | **FK → users.id**, NOT NULL (technician/admin) |
| status | ENUM(open, closed) | default open |
| created_at / updated_at | TIMESTAMPTZ | — |

### 20. `chat_messages` *(future)*
**Purpose:** Individual messages within a conversation.

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| conversation_id | UUID | **FK → chat_conversations.id**, NOT NULL |
| sender_id | UUID | **FK → users.id**, NOT NULL |
| body | TEXT | NULL |
| attachment_file_id | UUID | **FK → uploaded_files.id**, NULL |
| read_at | TIMESTAMPTZ | NULL |
| created_at | TIMESTAMPTZ | NOT NULL (append-only) |

### 21. `service_reports`
**Purpose:** The technician's record of work performed on a completed job.

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| booking_id | UUID | **FK → bookings.id**, UNIQUE, NOT NULL |
| technician_id | UUID | **FK → technicians.id**, NOT NULL |
| pests_found | JSONB | NULL |
| areas_treated | JSONB | NULL |
| summary | TEXT | NULL |
| recommendations | TEXT | NULL |
| weather_conditions | VARCHAR(100) | NULL |
| customer_signature_file_id | UUID | **FK → uploaded_files.id**, NULL |
| signed_at | TIMESTAMPTZ | NULL |
| created_at / updated_at | TIMESTAMPTZ | — |

### 22. `chemical_applications` *(supporting — compliance core)*
**Purpose:** Per-product chemical/pesticide application record. **Append-only, audited** — the regulatory backbone flagged in Steps 1–2.

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| service_report_id | UUID | **FK → service_reports.id**, NOT NULL |
| product_name | VARCHAR(150) | NOT NULL |
| epa_registration_number | VARCHAR(100) | NULL |
| target_pest | VARCHAR(100) | NULL |
| quantity_used | NUMERIC(10,3) | NOT NULL |
| unit | VARCHAR(20) | NOT NULL |
| concentration | VARCHAR(50) | NULL |
| application_method | VARCHAR(100) | NULL |
| application_area | VARCHAR(150) | NULL |
| applied_at | TIMESTAMPTZ | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL (no update/delete) |

> Exact field set must be validated against your region's regulations (open PRD question Q4) before DDL.

### 23. `technician_locations` *(supporting — future GPS)*
**Purpose:** GPS time-series for en-route/live tracking; high-volume.

| Field | Type | Key / Constraint |
|---|---|---|
| id | BIGINT | **PK** (sequence — high volume) |
| technician_id | UUID | **FK → technicians.id**, NOT NULL |
| booking_id | UUID | **FK → bookings.id**, NULL |
| latitude | NUMERIC(9,6) | NOT NULL |
| longitude | NUMERIC(9,6) | NOT NULL |
| recorded_at | TIMESTAMPTZ | NOT NULL |

> Candidate for **time-series partitioning** and short retention (see Data Retention).

### 24. `uploaded_files`
**Purpose:** Central metadata for all stored files (photos, signatures, report PDFs). Binary lives in object storage; only metadata here.

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| uploaded_by | UUID | **FK → users.id**, NOT NULL |
| related_entity_type | VARCHAR(50) | NOT NULL (booking, service_report, chat, etc.) |
| related_entity_id | UUID | NULL (polymorphic reference) |
| file_type | VARCHAR(50) | NOT NULL (image, pdf, signature) |
| storage_key | VARCHAR(512) | NOT NULL (object storage path) |
| mime_type | VARCHAR(100) | NULL |
| size_bytes | BIGINT | NULL |
| created_at | TIMESTAMPTZ | NOT NULL |
| deleted_at | TIMESTAMPTZ | NULL |

> Polymorphic link kept simple; integrity enforced in the application layer.

### 25. `coupons`
**Purpose:** Discount definitions.

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| code | VARCHAR(50) | UNIQUE, NOT NULL |
| discount_type | ENUM(percentage, fixed) | NOT NULL |
| value | NUMERIC(10,2) | NOT NULL, CHECK > 0 |
| min_order_amount | NUMERIC(10,2) | default 0 |
| max_redemptions | INTEGER | NULL |
| redemption_count | INTEGER | default 0 |
| per_customer_limit | INTEGER | NULL |
| valid_from | TIMESTAMPTZ | NOT NULL |
| valid_until | TIMESTAMPTZ | NULL |
| is_active | BOOLEAN | default true |
| created_at / updated_at / deleted_at | TIMESTAMPTZ | — |

### 26. `coupon_usage`
**Purpose:** One row per redemption; enforces limits and supports reporting.

| Field | Type | Key / Constraint |
|---|---|---|
| id | UUID | **PK** |
| coupon_id | UUID | **FK → coupons.id**, NOT NULL |
| customer_id | UUID | **FK → customers.id**, NOT NULL |
| booking_id | UUID | **FK → bookings.id**, NULL |
| discount_applied | NUMERIC(10,2) | NOT NULL |
| used_at | TIMESTAMPTZ | NOT NULL |

### 27. `audit_logs`
**Purpose:** Tamper-evident record of sensitive actions and data changes.

| Field | Type | Key / Constraint |
|---|---|---|
| id | BIGINT | **PK** (sequence) |
| actor_user_id | UUID | **FK → users.id**, NULL (null = system) |
| action | VARCHAR(100) | NOT NULL (create/update/delete/login/refund) |
| entity_type | VARCHAR(100) | NOT NULL |
| entity_id | UUID | NULL |
| before_data | JSONB | NULL |
| after_data | JSONB | NULL |
| ip_address | INET | NULL |
| user_agent | VARCHAR(255) | NULL |
| created_at | TIMESTAMPTZ | NOT NULL (append-only) |

---

# Relationships

### One-to-One (1:1)
- `users` ↔ `customers` (a user is at most one customer)
- `users` ↔ `technicians`
- `bookings` ↔ `service_reports`
- `bookings` ↔ `reviews`

### One-to-Many (1:N)
- `roles` → `users`
- `customers` → `addresses`, `bookings`, `subscriptions`, `invoices`, `coupon_usage`
- `service_packages` → `subscriptions`
- `subscriptions` → `bookings`
- `bookings` → `booking_status_history`, `technician_assignments`, `invoices`
- `invoices` → `payments`
- `technicians` → `technician_assignments`, `service_reports`, `technician_locations`, `reviews`
- `service_reports` → `chemical_applications`
- `users` → `notifications`, `audit_logs`, `uploaded_files`
- `chat_conversations` → `chat_messages`
- `coupons` → `coupon_usage`

### Many-to-Many (M:N)
- `roles` ↔ `permissions` (via `role_permissions`)
- `service_packages` ↔ `services` (via `package_services`)
- `coupons` ↔ `customers`/`bookings` (resolved through `coupon_usage`)

### Polymorphic
- `uploaded_files` → any entity (via `related_entity_type` + `related_entity_id`; integrity enforced in app layer).

---

# Indexing Strategy

| Table | Recommended indexes |
|---|---|
| users | UNIQUE(email), UNIQUE(phone), INDEX(role_id), INDEX(status) |
| customers / technicians | UNIQUE(user_id) |
| addresses | INDEX(customer_id); composite INDEX(latitude, longitude) for geo lookups |
| bookings | INDEX(customer_id), INDEX(status), INDEX(scheduled_window_start), composite INDEX(status, scheduled_window_start) for dispatch boards, INDEX(subscription_id) |
| booking_status_history | INDEX(booking_id, created_at) |
| technician_assignments | INDEX(technician_id), INDEX(booking_id), partial UNIQUE(booking_id) WHERE status='active' |
| invoices | UNIQUE(invoice_number), INDEX(customer_id), INDEX(status), INDEX(due_date) |
| payments | INDEX(invoice_id), INDEX(status), INDEX(provider_transaction_id) |
| subscriptions | INDEX(customer_id), INDEX(status), INDEX(next_billing_date), INDEX(next_service_date) |
| reviews | INDEX(technician_id), INDEX(rating) |
| notifications | composite INDEX(user_id, read_at), INDEX(created_at) |
| chat_messages | INDEX(conversation_id, created_at) |
| service_reports | UNIQUE(booking_id), INDEX(technician_id) |
| chemical_applications | INDEX(service_report_id), INDEX(applied_at), INDEX(product_name) for compliance queries |
| technician_locations | composite INDEX(technician_id, recorded_at); partition by time |
| uploaded_files | INDEX(related_entity_type, related_entity_id), INDEX(uploaded_by) |
| coupons | UNIQUE(code), INDEX(is_active, valid_until) |
| coupon_usage | INDEX(coupon_id), INDEX(customer_id) |
| audit_logs | INDEX(entity_type, entity_id), INDEX(actor_user_id), INDEX(created_at) |

General guidance: index all foreign keys; use partial indexes for status-filtered "hot" queries (active assignments, unpaid invoices); add composite indexes matching the dispatch board and reporting access patterns; avoid over-indexing write-heavy tables (`technician_locations`, `audit_logs`).

---

# Audit & Logging Strategy

- **`audit_logs`** captures create/update/delete on sensitive entities (users, payments, invoices, refunds, permission changes, chemical applications) with before/after JSONB snapshots.
- **Append-only tables** for legally/operationally important history: `booking_status_history`, `chemical_applications`, `chat_messages`, `audit_logs`, `payments` — no updates or deletes permitted; corrections are new rows.
- **Compliance trail:** every `chemical_application` is permanently retained and never soft-deleted, satisfying the regulatory requirement from Steps 1–2.
- **Auth events** (login, refresh, failed login, password change) logged for security monitoring.
- Logs should be write-protected from normal app roles (enforced at DB privilege level in the physical step).

---

# Soft Delete Strategy

- **Soft delete (`deleted_at`)** on user-facing entity tables: `users`, `customers`, `technicians`, `addresses`, `services`, `service_packages`, `subscriptions`, `bookings`, `invoices`, `reviews`, `coupons`, `uploaded_files`.
- All standard reads filter `WHERE deleted_at IS NULL`.
- **Never soft-delete** append-only/compliance tables (`chemical_applications`, `booking_status_history`, `audit_logs`, `payments`) — these are permanent records.
- **Hard delete** reserved for: GDPR-style erasure requests, expired GPS data, and orphaned temp files — executed by controlled background jobs, never by user action.
- Unique constraints (e.g., email) must account for soft-deleted rows (partial unique index on active rows) to allow re-registration.

---

# Data Retention Strategy

| Data | Retention | Rationale |
|---|---|---|
| Chemical/compliance records | Long-term (per regulation, often 2–7 yrs+) | Legal requirement |
| Invoices & payments | Per tax/accounting law (often 7 yrs) | Financial compliance |
| Bookings & service reports | Long-term while customer active | History & disputes |
| `technician_locations` (GPS) | Short (e.g., 30–90 days) then purge/aggregate | High volume, low long-term value |
| Notifications | Medium (e.g., 6–12 months) | Reduce table bloat |
| Chat messages | Medium–long | Support/dispute reference |
| Audit logs | Long-term | Security & compliance |
| Soft-deleted records | Grace period, then archival/hard delete | Recovery window |

Exact durations must be confirmed against your region's legal and tax requirements before implementation.

---

# Security Considerations

### Personally Identifiable Information (PII)
- PII (names, emails, phones, addresses, gate codes, access notes, license numbers) restricted by RBAC; technicians see only their assigned jobs' access data.
- Column-level encryption (🔒) for the most sensitive fields: `phone`, `gate_code`, `access_notes`, `license_number`.
- Right-to-erasure supported via controlled hard delete while preserving legally required financial/compliance records (anonymize rather than delete where law conflicts).

### Payment Data
- **No card data stored** — no PAN, CVV, or expiry anywhere in the schema.
- Only the payment provider's **token/customer reference** (`stripe_customer_id`, `provider_transaction_id`) is persisted, keeping PCI scope minimal.
- Refunds and payment mutations are audited and Admin-only.

### Encryption Requirements
- **In transit:** TLS for all client↔backend and backend↔provider traffic.
- **At rest:** full-database and object-storage encryption.
- **Column-level:** application-layer encryption for 🔒 fields, with keys held in a managed secrets/KMS service (not in the database).
- Passwords stored only as strong salted hashes.

---

# Scalability Recommendations

- **Vertical first:** a single well-indexed PostgreSQL instance comfortably handles a single-company workload at launch.
- **Read replicas** for reporting/analytics and the Admin dashboard's heavy queries, protecting transactional performance.
- **Partition high-volume tables:** time-partition `technician_locations` and `audit_logs` by month; this also makes retention purges cheap (drop old partitions).
- **Caching (Redis):** session/permission lookups, service catalog, and availability checks.
- **Connection pooling** (e.g., PgBouncer) as concurrent clients grow.
- **Archival tier:** move aged invoices/reports to cheaper storage while keeping them queryable for compliance.
- **Forward path:** the schema avoids hard single-tenant assumptions in a way that would block adding a `tenant_id` later if DNR ever goes multi-branch/multi-tenant — but that is intentionally **not** built now.

---

# Database Design Review

The design covers all 24 requested tables plus four supporting tables required for correctness (`role_permissions`, `package_services`, `chemical_applications`, `technician_locations`). It is normalized (broadly 3NF) with deliberate, documented exceptions (JSONB for flexible attributes like skills/pests; polymorphic file links). Every requested capability — auth/RBAC, profiles, booking, scheduling, payments, invoices, reviews, notifications, chat, GPS, service reports, file uploads, recurring services, and coupons — maps to concrete tables and relationships. Compliance, audit, soft-delete, retention, and security strategies are defined and trace directly back to risks raised in Steps 1 and 2.

# Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Compliance fields unconfirmed** (PRD Q4) — `chemical_applications` is a best-guess set | High | Validate required fields against your region's law before DDL; this table is hardest to change later |
| Polymorphic `uploaded_files` lacks DB-level FK integrity | Medium | Enforce in app layer; consider per-type link tables if integrity becomes critical |
| `technician_locations` volume could grow fast | Medium | Partition + short retention from day one |
| JSONB fields (skills, pests, areas) can drift without structure | Low–Medium | Define and validate JSON shapes in the app; revisit if querying needs grow |
| Soft delete + unique constraints (email reuse) | Low | Partial unique indexes on active rows |
| Chat/GPS designed but not in MVP — risk of premature build | Low | Keep tables defined but defer implementation per PRD |

# Recommendations Before API Design

1. **Confirm the `chemical_applications` field set** against your operating region's pesticide-reporting regulations. This is the single most important input and the costliest to change after launch.
2. **Confirm tax/financial and compliance retention periods** so retention and archival jobs are built correctly.
3. **Confirm the payment provider** (Stripe vs regional) — it determines the token/reference fields on `customers` and `payments`.
4. **Confirm which future tables to physically build now** (`chat_*`, `technician_locations`) vs defer, so the API surface matches MVP scope.
5. **Confirm JSONB vs normalized** for `skills`, `target_pests`, and `areas_treated` — fine as JSONB for MVP, but decide before APIs expose them.

Once the compliance fields and retention rules are confirmed, this design is ready to drive physical DDL and the API contract.

*Next step on approval: API Design.*
