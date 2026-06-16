# DNR Pest Control — System Architecture Design (Step 2)

**Product:** DNR Pest Control Mobile Application
**Platform:** Flutter (iOS + Android), single codebase
**Builds on:** Approved Product Discovery & Requirements (Step 1)
**Document type:** System Architecture Design
**Version:** Draft 1.0
**Scope note:** Architecture and design decisions only. No code. Database schema and API contracts are deliberately deferred to the next step (Database Design).

### Carried-forward assumptions (from PRD)
- Single company (not multi-tenant SaaS).
- Both residential and commercial customers.
- Recurring plans and **integrated payments are in MVP**.
- **Offline-first** technician experience is a first-class requirement.
- Three roles in one Flutter app: Customer, Technician, Admin.
- A **relational database (PostgreSQL)** is the system of record (chosen here; modelled in Step 3).

> Where the PRD left an open question, this document makes a **recommended decision** and labels it so you can override it before Database Design.

---

## 1. High-Level Architecture

The system uses a **layered, service-oriented architecture** with a single backend serving all three roles. Clients are thin; business rules, compliance, and payments live server-side.

```
                         ┌─────────────────────────────────────────┐
                         │              CLIENTS (Flutter)            │
                         │  Customer app   Technician app   Admin    │
                         │  (mobile)        (mobile, offline) (web/   │
                         │                                    tablet) │
                         └───────────────┬─────────────────────────-─┘
                                         │  HTTPS / REST (+ optional WebSocket)
                                         ▼
                         ┌─────────────────────────────────────────┐
                         │            API / APPLICATION LAYER        │
                         │  Auth & RBAC · Booking · Scheduling ·     │
                         │  Jobs · Treatment/Compliance · Payments · │
                         │  Notifications · Reporting · Sync         │
                         └───────┬───────────────┬───────────────-──┘
                                 │               │
                 ┌───────────────▼──┐     ┌──────▼─────────────┐
                 │  DATA LAYER       │     │  ASYNC / QUEUE      │
                 │  PostgreSQL       │     │  Background jobs:    │
                 │  Object storage   │     │  notifications,      │
                 │  Cache (Redis)    │     │  billing, sync recon │
                 └───────────────────┘     └─────────┬───────────┘
                                                      │
                         ┌────────────────────────────▼────────────┐
                         │           THIRD-PARTY SERVICES            │
                         │  Payments · Push · SMS/Email · Maps ·     │
                         │  Object storage · Monitoring              │
                         └───────────────────────────────────────────┘
```

**Key principles**
- **Single source of truth** in PostgreSQL; clients hold only cached/offline copies.
- **Thin clients, thick backend** — booking rules, assignment rules, pricing, and payments are enforced server-side so they can't be bypassed or duplicated.
- **Stateless API** behind a load balancer for horizontal scaling.
- **Asynchronous work** (notifications, recurring billing, sync reconciliation) handled off the request path via a queue/worker.

---

## 2. Mobile Architecture

One Flutter codebase, role-aware at runtime. The signed-in user's role determines which feature modules and navigation are exposed.

### 2.1 Layered structure (within the app)
| Layer | Responsibility |
|---|---|
| Presentation | Screens, widgets, navigation (role-gated) |
| State management | App/session state, feature state |
| Domain | Use cases / business logic that must run client-side (validation, offline rules) |
| Data | Repositories abstracting remote API vs local database |
| Local persistence | Offline store + sync engine |

### 2.2 Recommended choices
| Concern | Recommendation | Rationale |
|---|---|---|
| State management | **Riverpod** (or Bloc) | Testable, scales across three role modules |
| Local/offline DB | **SQLite via Drift** (relational) | Matches relational backend; supports queries techs need offline |
| Networking | Dio/HTTP client with interceptors | Token refresh, retry, error handling |
| Secure storage | flutter_secure_storage (Keychain/Keystore) | Tokens, sensitive cache (gate codes) |
| Media | Local capture + deferred upload | Photos taken offline, uploaded on reconnect |

### 2.3 Offline-first design (critical for Technician)
- The technician app must function with **no connectivity**: load assigned jobs, capture treatment data, chemicals/quantities, photos, notes, and signatures locally.
- **Sync engine** queues all field changes and uploads when online, with conflict handling:
  - Field-captured records (treatment logs, photos, signatures) are **append-only / tech-owned** → low conflict risk.
  - Job assignment/schedule is **server-owned** → server wins; client refreshes.
  - Use record versioning + timestamps; flag true conflicts for Admin review rather than silently overwriting.
- Media uploads are chunked/retried and decoupled from the data sync.

### 2.4 Role-specific notes
- **Customer:** mostly online; light offline caching of history/upcoming jobs.
- **Technician:** full offline capability is mandatory.
- **Admin:** see Section 4 — recommended on web/tablet rather than phone.

---

## 3. Backend Architecture

### 3.1 Style
A **modular monolith** is recommended for MVP rather than microservices: one deployable backend organized into clear internal modules (Auth, Customers, Scheduling, Jobs, Treatment/Compliance, Payments, Notifications, Reporting, Sync). This gives clean boundaries without the operational overhead of distributed services — appropriate for a single-company app at launch, and it can be split later if needed.

### 3.2 Internal modules / services
| Module | Responsibility |
|---|---|
| Auth & Identity | Login, tokens, role & permission resolution |
| Customer & Property | Accounts, properties, access notes |
| Catalog & Pricing | Services, plans, prices, booking/cancellation rules |
| Scheduling & Dispatch | Appointments, availability, technician assignment |
| Jobs & Treatment | Job lifecycle, status, treatment & **chemical/compliance** capture, photos, signatures |
| Payments & Billing | Invoices, one-time charges, recurring plan billing, refunds |
| Notifications | Push/SMS/email orchestration |
| Reporting & Analytics | Operational dashboards, compliance exports |
| Sync | Offline reconciliation endpoints for the technician app |

### 3.3 Recommended technology path
| Option | Description | When to choose |
|---|---|---|
| **A — Custom API + PostgreSQL** (e.g., Node/NestJS or Django) | Full control over business rules, compliance, reporting | **Recommended.** Best fit for payments + compliance + complex rules |
| B — Managed BaaS (Supabase / Firebase) | Faster start; auth, DB, storage bundled | Viable if speed-to-market trumps control; Supabase keeps Postgres |

**Recommendation: Option A (custom API over PostgreSQL)**, optionally accelerated by managed auth and storage. The compliance logging, recurring billing logic, and assignment rules are too central to delegate fully to a generic BaaS, and server-side rule enforcement is a core principle here.

### 3.4 Asynchronous processing
- **Queue + workers** (e.g., a job/message queue) for: sending notifications, processing recurring billing cycles, retrying failed payments, generating reports, and reconciling sync batches.
- **Scheduled jobs** for: generating recurring appointments, plan renewals, payment retries, and certification-expiry alerts (future).

---

## 4. Admin Dashboard Architecture

**Open PRD decision resolved here:**

**Recommendation: a dedicated web admin dashboard (e.g., React) sharing the same backend API**, rather than running Admin inside the Flutter mobile app.

| Approach | Pros | Cons |
|---|---|---|
| **Web dashboard (recommended)** | Best for dense data tables, scheduling grids, reports, multi-window work | Second codebase |
| Flutter Web (reuse mobile) | Single codebase | Weaker for heavy data grids/reporting; compromised UX |

Rationale: Admin work is desktop-centric (dispatch boards, large tables, exports). A purpose-built web app gives a far better experience and is faster to evolve for reporting. It consumes the **same API and auth** as the mobile clients, so there's no backend duplication.

If minimizing scope is paramount for MVP, Flutter Web is an acceptable fallback — but flag it as technical debt.

The dashboard surfaces: operational overview (today's jobs/exceptions), customer & technician management, schedule/dispatch board, catalog & pricing, invoicing/payment oversight, compliance records & exports, and reports.

---

## 5. Authentication Architecture

### 5.1 Model
- **Token-based auth (JWT)**: short-lived access token + refresh token.
- **Role-Based Access Control (RBAC)** with three primary roles (Customer, Technician, Admin) and room for Admin sub-roles (Dispatcher, Owner/Manager) as noted in the PRD.
- All authorization is **enforced server-side**; the client role only controls what UI is shown, never what's permitted.

### 5.2 Recommendation
| Concern | Recommendation |
|---|---|
| Identity provider | Managed auth (e.g., **Auth0 / Firebase Auth / Supabase Auth**) or custom auth in the API |
| Session | Access + refresh tokens; secure refresh rotation |
| Token storage (mobile) | Platform secure storage (Keychain/Keystore) |
| Permissions | Role + permission claims resolved server-side per request |
| Account creation | Per PRD: support **both** self-registration (Customer) and Admin-created accounts (Technician always Admin-created) |
| Sensitive actions | Re-auth/confirmation for payments, refunds, permission changes |

### 5.3 Notes
- Technicians and Admins are **provisioned by Admin**, not self-registered.
- Optional: social/passwordless login for customers (future), MFA for Admin (recommended).

---

## 6. Third-Party Services

| Capability | Recommended service(s) | Notes |
|---|---|---|
| Payments | **Stripe** (or regional equivalent) | Tokenized, PCI-compliant; supports recurring billing & retries |
| Push notifications | **Firebase Cloud Messaging (FCM)** | Cross-platform iOS/Android |
| SMS / Email | **Twilio (SMS)** + **SendGrid/SES (email)** | Reminders, confirmations, receipts |
| Maps & navigation | **Google Maps SDK**; hand-off to device maps for turn-by-turn | Display + navigation launch |
| Object/file storage | **Cloud object storage (e.g., S3 / GCS)** | Service photos, report PDFs, signatures |
| Crash & monitoring | **Sentry** + platform analytics | Stability and usage insight |
| Report generation | Server-side PDF generation | Service reports, compliance exports |

> Routing optimization, live GPS tracking, and accounting/CRM integrations are **future** per the PRD and intentionally not wired into MVP.

---

## 7. Security Architecture

### 7.1 Core controls
- **Transport security:** TLS/HTTPS everywhere; certificate pinning on mobile recommended.
- **Encryption at rest:** database and object storage encrypted; secrets in a managed secrets store.
- **RBAC enforced server-side** on every request.
- **PCI scope minimized:** card data never touches DNR servers or the app — handled via the payment provider's tokenization. (This directly addresses the PRD payment risk.)
- **Sensitive customer data** (gate codes, access notes) encrypted and access-restricted; only shown to the assigned technician and Admin.

### 7.2 Compliance & auditability
- **Immutable audit log** for chemical/treatment records: who applied what, where, when, quantity, target pest, conditions — addressing the PRD's regulatory risk.
- Treatment records are append-only with full history; corrections are tracked, not overwritten.
- Compliance exports (PDF/CSV) for audits.

### 7.3 Application security
- Input validation and rate limiting on the API.
- Secure token handling and refresh rotation.
- Least-privilege access for internal services and third parties.
- Privacy-respecting defaults; data retention policy defined with the business.

---

## 8. Data Flow

### 8.1 Booking flow
1. Customer selects service/plan, property, and time window in the app.
2. App requests price & availability from the API (rules enforced server-side).
3. API creates a pending appointment; assignment routed to Admin queue or auto-suggested.
4. Confirmation notification sent (push/SMS/email).
5. Recurring plans generate future appointments via scheduled jobs.

### 8.2 Service execution & offline sync flow
1. Technician app pulls assigned jobs (cached locally).
2. Tech works **offline**: updates status, records treatment, chemicals/quantities, photos, notes, signature — all stored locally.
3. On reconnect, the **sync engine** uploads queued changes; server validates and reconciles (server-owned vs tech-owned records).
4. Media uploaded separately with retry.
5. Job completion triggers invoice generation and customer notification.

### 8.3 Payment flow
1. On completion (or per plan cycle), the backend creates an invoice.
2. Customer pays via the payment provider (tokenized); for plans, billing runs automatically.
3. Failed payments trigger retry + notification; refunds are Admin-only.
4. The app never handles raw card data.

### 8.4 Notification flow
- Events (booking confirmed, reminder, en route, completion, payment) are published to the notification module, which dispatches via FCM/SMS/email asynchronously.

---

## 9. Scalability Plan

The MVP targets a single business, so the near-term priority is **reliability and cost-efficiency**, with clear room to grow.

| Layer | Scaling approach |
|---|---|
| API | Stateless instances behind a load balancer; scale horizontally |
| Database | Start single PostgreSQL with automated backups; add **read replicas** for reporting load as it grows |
| Caching | **Redis** for sessions, availability lookups, and hot reads |
| Async work | Queue + worker pool scales independently of the API |
| Media | Object storage + CDN for photo/report delivery |
| Reporting | Offload heavy queries to a read replica to protect transactional performance |

**Growth path:** if DNR later expands to multiple branches or becomes multi-tenant, the modular monolith can be split into services, and tenancy can be introduced at the data layer — but that is explicitly **not** built into MVP.

---

## 10. Recommended Architecture Decisions

| # | Decision | Recommendation | Why |
|---|---|---|---|
| 1 | Backend style | Modular monolith | Right complexity/operability balance for single company |
| 2 | Backend stack | Custom API over **PostgreSQL** | Control over compliance, billing, rules |
| 3 | Database | **PostgreSQL** (relational) | Recurring billing, reporting, relationships, audit |
| 4 | Mobile offline store | SQLite/Drift + sync engine | Mandatory offline tech workflow |
| 5 | Admin client | **Dedicated web dashboard**, shared API | Best UX for data-heavy admin work |
| 6 | Auth | JWT + RBAC, managed identity provider | Security + speed; server-enforced |
| 7 | Payments | **Stripe**, tokenized | PCI scope minimized; recurring support |
| 8 | Notifications | FCM + Twilio + SendGrid | Reliable cross-platform delivery |
| 9 | Async processing | Queue + workers + scheduler | Billing cycles, notifications, sync |
| 10 | Compliance | Immutable, append-only audit log | Regulatory defensibility |

---

## Recommendations Before Moving to Database Design

The architecture is internally consistent and ready to drive a data model. Before Step 3 (Database Design), please confirm or override the following decisions made in this document:

1. **Admin client = dedicated web dashboard (not Flutter Web).** This affects API design and effort. Confirm or choose the Flutter Web fallback.
2. **Backend = custom API over PostgreSQL** (vs a managed BaaS like Supabase). This is the single biggest decision and shapes everything downstream.
3. **Payments = Stripe in MVP**, tokenized. Confirm the provider (regional availability matters for your operating region).
4. **Chemical/compliance fields** — the exact regulatory fields you must capture (still open from the PRD, Q4) directly determine the treatment/compliance tables. This is the most important input still missing.
5. **Multi-tenancy stays out** — confirm single-company so the data model isn't over-built.

Once those are confirmed — especially the **compliance field requirements** and the **backend stack** — the database design can proceed cleanly: entities, relationships, constraints, and the audit/compliance model.

*Next step on approval: Step 3 — Database Design.*
