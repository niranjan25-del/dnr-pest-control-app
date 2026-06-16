# DNR Pest Control — Admin Module Design (Step 11)

**Product:** DNR Pest Control platform
**Builds on:** All prior approved steps (PRD · Architecture · DB · API · Backend · Auth · Flutter Arch · UI/UX · Customer Module · Technician Module)
**Module:** Admin (business operations & management)
**Document type:** Functional Module Design
**Version:** Draft 1.0
**Scope note:** Functional design only — flows, components, rules, API mapping, permissions, edge cases. **No code.** Endpoints from Step 4; per Step 2, the **recommended primary surface is a web admin dashboard** (the in-app Flutter admin mirrors core ops for parity/MVP).

> Sub-role note: Steps 1/5/6 anticipated Admin **sub-roles**. This module formalizes four (Super Admin, Operations Manager, Dispatcher, Customer Support) via the existing `roles`/`permissions`/`role_permissions` model. Whether all four ship in MVP or only a single "Admin" role is a confirm item (see Review).

---

# Admin Module Overview

### Business objectives
- Run the entire operation from one control center: customers, technicians, bookings, catalog, payments, plans, and reporting.
- Maximize **recurring-revenue** management and retention.
- Provide accurate financial and **compliance** oversight and exports.

### Operational objectives
- Efficient dispatch with no double-bookings and minimal idle time.
- Real-time visibility into job status and exceptions.
- Fast resolution of payment, scheduling, and customer issues.

### Management goals
- Data-driven staffing and growth decisions (utilization, revenue, churn).
- Clean audit trail and role-scoped access for accountability.
- Scalable processes as the business grows.

---

# Admin Dashboard

Layout: stat-card grid + exceptions + today's schedule + notifications. Primary surface = web (denser tables); in-app mirrors essentials.

| Widget | Purpose | Data source | Actions |
|---|---|---|---|
| **Total bookings** | Volume KPI (period) | `GET /admin/reports/booking` | Filter by range; drill to list |
| **Active bookings** | In-flight jobs now | `GET /bookings?status=confirmed,en_route,in_progress` | Open board, dispatch |
| **Revenue summary** | Headline revenue (period) | `GET /admin/reports/revenue` | Range filter, export |
| **Monthly revenue** | Trend over months | revenue report (grouped) | View chart, export |
| **Technician performance** | Utilization/ratings snapshot | `GET /admin/reports/technician` | Drill to technician |
| **Customer growth** | New customers trend | `GET /admin/reports/customer` | Range filter |
| **Pending payments** | Overdue/unpaid invoices | `GET /invoices?status=overdue,issued` | Open invoice, chase/refund |
| **Notifications center** | Ops alerts (unassigned, failures) | `GET /admin/dashboard` exceptions + notifications | Resolve, broadcast |

Dashboard is **exceptions-first** (unassigned jobs, overdue invoices, failed payments, follow-ups) — the highest time-saver per PRD. Skeleton loading; empty/error states standard.

---

# Customer Management

- **Customer listing:** `GET /customers` (paginated table).
- **Search:** name/email/phone (`?search=`).
- **Filters:** customer_type (residential/commercial), status, date joined, has-active-plan.
- **Customer profile view:** `GET /customers/{id}` — profile, addresses, plan(s).
- **Booking history:** customer's bookings (status, dates, technician).
- **Payment history:** invoices/payments for the customer.
- **Customer notes:** internal notes (`customers.notes`); audited.
- **Account suspension:** `PATCH /admin/users/{userId}/status` → suspend/activate (revokes sessions; audited; cannot self-suspend).

Mobile: table collapses to list cards (Step 8 responsive rule).

---

# Technician Management

- **Technician listing:** `GET /technicians` (table: name, license, expiry, availability, status).
- **Profile management:** create (`POST /technicians`) / edit (`PATCH /technicians/{id}`).
- **Certifications:** license number (🔒), expiry, skills; **expiry-warning badges**; alerts as expiry nears (future).
- **Service areas:** assign territories (drives assignment + dispatch).
- **Availability:** view/override availability and working hours.
- **Performance metrics:** jobs completed, on-time %, ratings, revenue, avg completion (`GET /admin/reports/technician`).
- **Assignment management:** see current/queued jobs; reassign; balance workload.

---

# Booking Management

- **Booking creation:** Admin books on behalf of a customer (`POST /bookings`, created_by = admin).
- **Booking editing:** reschedule (`PATCH /bookings/{id}`), edit details within rules.
- **Booking cancellation:** `POST /bookings/{id}/cancel` (reason, fee rules).
- **Booking reassignment:** `POST /bookings/{id}/assign` (availability + license/area checks; `409`/`422` guards).
- **Booking tracking:** status board; technician en-route location (`GET /bookings/{id}/technician-location`, future live).
- **Status monitoring:** real-time board grouped by status; exception highlighting (unassigned, late, follow-up).

Primary work view: a **dispatch board** (columns by status or technician swim-lanes) — the operational heart of the module.

---

# Service Management

- **Service categories:** organize services (rodents, termites, etc.).
- **Pest categories:** taxonomy used in booking and reporting (`services.category`/`target_pests`).
- **Service packages:** create/edit plans (`/packages`), set included services, cadence, billing cycle.
- **Pricing management:** base prices (services) and plan prices; centralized to prevent field inconsistency.
- **Package configuration:** visit frequency, contract length, included services; activate/deactivate.

APIs: `GET/POST/PATCH /services`, `/packages` (Admin-only mutations).

---

# Scheduling Management

- **Calendar management:** org-wide calendar of jobs (day/week), filter by technician/area.
- **Technician schedules:** per-tech day views; spot gaps/overloads.
- **Availability management:** view/override technician availability; block-out dates.
- **Capacity planning:** jobs vs available technician-hours by day/area; surface over/under capacity to guide staffing and booking acceptance.

(MVP = manual; auto-optimization future.)

---

# Payment Management

- **Transaction list:** payments table (amount, method, status, customer, date) — `GET /payments` scope via invoices.
- **Payment status:** succeeded/failed/refunded/pending; failed-payment follow-up.
- **Refund processing:** `POST /payments/{id}/refund` (Admin-only, reason, confirm dialog, audited).
- **Invoice management:** `GET /invoices`, detail, PDF; chase overdue; void where permitted.

No raw card data anywhere (Stripe tokens only).

---

# Subscription Management

- **Recurring services:** list active subscriptions (`/subscriptions`), next service/billing dates.
- **Subscription plans:** managed via packages (above).
- **Subscription modifications:** change plan/cadence/address; pause (`/subscriptions/{id}/pause`).
- **Subscription cancellations:** `/subscriptions/{id}/cancel` (contract notice rules; `422` within notice).
- Monitor failed recurring payments + retry status; renewal oversight.

---

# Coupon & Promotion Management

- **Create coupon:** `POST /coupons` (code, type %/fixed, value, min order, validity, limits).
- **Edit coupon:** `PATCH /coupons/{id}`; activate/deactivate.
- **Expiration rules:** valid_from/valid_until.
- **Usage limits:** max_redemptions, per_customer_limit; redemption_count tracked.
- **Campaign management:** group coupons into campaigns; track usage via `coupon_usage`; basic performance (redemptions, discount given). (Advanced marketing = future.)

---

# Reviews & Ratings Management

- **Review monitoring:** list reviews (`/reviews`), filter by rating/technician/published.
- **Response management:** *(future)* official responses to reviews.
- **Flagging/moderation:** publish/hide (`PATCH /reviews/{id}/publish`); flag inappropriate; audit moderation actions.

---

# Notification Management

- **Push notifications:** targeted/broadcast via FCM (audience: all, role, segment).
- **SMS campaigns:** transactional + opt-in campaigns (provider).
- **Email campaigns:** announcements, receipts, plan updates.
- **System announcements:** in-app banners/notices.
- Broadcasts require **explicit confirm** (irreversible mass action); audited; respect opt-outs and quiet hours. (Advanced segmentation = future.)

---

# Reports & Analytics

Export options across all: **CSV / PDF**, date-range and entity filters; scheduled exports (future). Heavy queries run off read replicas (Step 5).

| Report | KPIs | Filters |
|---|---|---|
| **Revenue** | Total/period revenue, recurring vs one-time, ARPU, outstanding | range, service, plan, area |
| **Booking** | Volume, completion rate, cancellation/no-show rate, by service/area | range, status, service, area, technician |
| **Customer** | New customers, active, churn, retention, residential vs commercial | range, type, area |
| **Technician** | Jobs completed, on-time %, avg completion time, ratings, revenue/tech, utilization | range, technician, area |
| **Service/Compliance** | Service mix, **chemical-usage / application records export** (regulatory) | range, service, product, technician |

The **compliance/chemical-usage export** is the regulatory deliverable flagged since Step 1 — append-only source data.

---

# Role & Permission Management

Four sub-roles via `role_permissions`. Server-enforced (Steps 5/6); UI gated to match.

### Definitions
- **Super Admin:** full control incl. role/permission management, pricing, refunds, suspensions, compliance export, system settings.
- **Operations Manager:** day-to-day operations — bookings, technicians, scheduling, catalog/pricing (view/edit per policy), reports; no role management.
- **Dispatcher:** scheduling & assignment focus — view bookings, assign/reassign, manage schedules; limited customer edits; no financial actions.
- **Customer Support:** customer-facing help — view customers/bookings, create/reschedule/cancel bookings, view invoices, moderate reviews; no refunds/pricing/role changes.

### Permissions matrix
| Capability | Super Admin | Ops Manager | Dispatcher | Support |
|---|:--:|:--:|:--:|:--:|
| View dashboard/reports | ✅ | ✅ | ◐ (ops) | ◐ (limited) |
| Manage roles/permissions | ✅ | ❌ | ❌ | ❌ |
| Suspend/activate users | ✅ | ✅ | ❌ | ❌ |
| Create/edit customers | ✅ | ✅ | ◐ | ✅ |
| Create/edit technicians | ✅ | ✅ | ❌ | ❌ |
| Create booking | ✅ | ✅ | ✅ | ✅ |
| Reschedule/cancel booking | ✅ | ✅ | ✅ | ✅ |
| Assign/reassign technician | ✅ | ✅ | ✅ | ❌ |
| Manage services/packages | ✅ | ✅ | ❌ | ❌ |
| Pricing changes | ✅ | ◐ (policy) | ❌ | ❌ |
| Manage coupons | ✅ | ✅ | ❌ | ❌ |
| Process refunds | ✅ | ◐ (cap/policy) | ❌ | ❌ |
| View invoices/payments | ✅ | ✅ | ◐ | ✅ |
| Moderate reviews | ✅ | ✅ | ❌ | ✅ |
| Send broadcasts | ✅ | ✅ | ❌ | ◐ |
| Compliance export | ✅ | ✅ | ❌ | ❌ |
| View audit logs | ✅ | ◐ | ❌ | ❌ |

(✅ full · ◐ limited/conditional · ❌ none) — exact ◐ boundaries are a confirm item.

> MVP option: ship a **single Admin role** with full access and layer these sub-roles later; the model already supports it.

---

# Audit Logs

- **Activity tracking:** sensitive actions (refunds, suspensions, role/permission changes, assignments, pricing edits, compliance exports, review moderation) → `audit_logs` with actor, before/after, ip, timestamp.
- **Change history:** per-entity history view (who changed what, when) for customers, bookings, services, technicians.
- **Login history:** auth events (login, refresh, failed login) for security review.
- Logs are append-only, write-protected from normal roles; viewable by Super Admin (and Ops per policy).

---

# Business Rules

### Booking assignment rules
- Assign only available technicians matching **service area + skill/license**; no double-booking; respect working hours; reassignment notifies affected parties.

### Technician workload rules
- Cap concurrent/overlapping jobs; balance daily load against capacity; flag overloads; respect availability/block-outs.

### Pricing rules
- Centralized prices; discounts only via valid coupons; commercial vs residential tiers; changes audited; in-flight bookings keep their agreed price.

### Refund rules
- Admin-only; reason required; cannot exceed captured amount; within provider/policy window; audited; tiered approval by role/cap (◐ in matrix).

---

# Security Requirements

- **Admin authentication:** per Step 6 (Firebase/app-JWT or direct staff path — pending confirm); **MFA strongly recommended** for Admin.
- **Role-based access:** server-enforced RBAC + ownership; least privilege; UI gating mirrors permissions.
- **Audit logging:** all sensitive actions recorded (above).
- **Sensitive data protection:** 🔒 fields (gate codes, license numbers) access-restricted and encrypted; no card data; no PII in logs; private signed URLs; web-admin session timeouts + secure cookies/headers.
- Destructive/financial actions require explicit confirmation; session revocation on role change/suspension.

---

# Edge Cases

| Case | Behavior |
|---|---|
| **Double bookings** | Prevented at assignment (`409`); if detected, surface conflict + reassign tool |
| **Payment disputes** | Flag invoice/payment; track dispute state; refund/adjust per policy; full audit; (chargeback handling via provider, future) |
| **Technician absence** | Mark unavailable/block-out → affected jobs flagged unassigned → bulk reassign tool; notify customers if timing changes |
| **Customer complaints** | Support logs complaint (customer notes), links booking; escalation path; possible goodwill credit/refund (policy) |
| **Overdue invoices** | Exception list + reminders; restrict new bookings on severe delinquency (policy) |
| **Failed recurring payment** | Retry schedule + notify; pause plan after N failures (policy) |
| **Bulk action mistakes** | Confirmations + audit +, where feasible, undo window |

---

# Analytics Events

| Event | When | Key properties |
|---|---|---|
| `admin_booking_created` | Admin creates booking | booking_id, customer_id, channel=admin |
| `booking_reassigned` | Reassignment | booking_id, from_tech, to_tech, reason |
| `refund_processed` | Refund issued | payment_id, amount, reason, actor_role |
| `technician_added` | New technician created | technician_id |
| `service_updated` | Service/package/pricing change | entity_id, change_type |
| `coupon_created` | Coupon created | coupon_id, type, value |
| `broadcast_sent` | Mass notification | audience, channel, count |
| `user_suspended` | Suspension | user_id, actor_role |

(No PII; ids + roles; audited separately for compliance.)

---

# Admin Module Review

### 1. Risks
| Risk | Severity | Note |
|---|---|---|
| **Admin-in-Flutter UX** for dense tables/dispatch | Medium–High | Web admin recommended (Step 2); decide MVP surface to avoid double-building |
| **Sub-role permission boundaries** (◐ cells) undefined | Medium | Exact caps/conditions (refund limits, pricing edit, audit access) must be specified |
| **Refund/dispute & delinquency policies** vague | Medium | Need concrete rules (windows, caps, approval tiers, dispute handling) |
| **Broadcast/campaign abuse or error** | Medium | Confirm + audit + opt-out + rate controls; segmentation future |
| **Compliance export correctness** | High | Depends on the still-open chemical field set |
| **Capacity planning depth** for MVP | Low–Medium | Confirm how sophisticated MVP needs to be |

### 2. Recommendations
1. **Decide the Admin surface for MVP** (web-first vs in-app) before building — biggest effort driver.
2. **Confirm sub-roles for MVP** (single Admin vs four roles) and define every ◐ boundary precisely.
3. **Specify financial policies** (refund windows/caps/approvals, dispute handling, delinquency thresholds).
4. **Make the dispatch board the centerpiece** — invest UX there; it drives daily operations.
5. **Build exceptions-first dashboard** (unassigned, overdue, failed, follow-ups).
6. **Confirm the compliance export fields** (jurisdiction) — the regulatory deliverable.
7. **Keep advanced marketing/segmentation and chargeback automation as future.**

### 3. Missing requirements (to be supplied)
- **Sub-role list + exact permission boundaries** for MVP (or single-Admin decision).
- **Refund, dispute, and delinquency policies** (concrete values/approvals).
- **Compliance/chemical export field set** (jurisdiction) — long-standing top item.
- Tax handling for invoices/reporting.
- Capacity-planning sophistication required for MVP.
- Admin MFA requirement (yes/no) and session-timeout policy.
- Admin surface decision (web vs in-app) for MVP.

### 4. Readiness score before Payment System Design
**8 / 10 — Ready to proceed to Payment System Design.**
The Admin Module is comprehensively specified and maps cleanly to existing data, APIs, and RBAC. Payment System Design can proceed now; the financial-policy details above (refund/dispute/delinquency rules) should be confirmed **during** that step since they directly shape it. Resolving the financial policies and the Admin-surface decision lifts this to ~9.5/10.

*Next step on approval: Payment System Design.*
