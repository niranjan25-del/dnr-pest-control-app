## DNR Pest Control — Subscriptions & Recurring Services Module (Step 26)

**Modules:** `subscriptions` + `plans` (NestJS) — production-ready
**Builds on:** Prisma schema (17) · Auth (18) · Users & Profiles (19) · Services (20) · Bookings (21) · Dispatch (22) · Addresses (23) · Payments (24) · Invoices (25)
**Tech:** NestJS · Prisma · PostgreSQL · **Stripe Subscriptions**
**Scope:** Subscriptions & Plans ONLY. No other modules generated.

> **No schema change needed** — `ServicePackage.stripePriceId` already exists. A "plan" is a recurring `ServicePackage` + a Stripe Price.

> **Reconciliations (flagged):**
> - `SubscriptionStatus` has **no `PENDING`**. We use Stripe's recommended **`default_incomplete`** flow: the pre-payment ("incomplete") state lives in Stripe, and the LOCAL `Subscription` row is **created/activated on the first successful payment** (webhook). If you want a locally-visible pending row, add `PENDING` to the enum (small migration, optional).
> - `BookingType` is **`RECURRING`** (not "SUBSCRIPTION") — recurring visits use that.
> - `BillingCycle.SEASONAL` is **not** a standard Stripe recurring interval — rejected for Stripe-billed plans (use MONTHLY/QUARTERLY/ANNUAL, or model seasonal cadence separately).

> **Overlap with Services (Step 20):** both touch `ServicePackage` (single model). The Services module owns general catalog attributes; the **Plans** module owns the **Stripe billing linkage** (Product/Price). `createPlan` provisions both the package row and the Stripe Price.

> **Two webhook endpoints:** Payments (Step 24) owns `payment_intent.*`/`charge.*` at `/webhooks/stripe`. This module adds a **second endpoint** `/webhooks/stripe/subscriptions` for `invoice.*` + `customer.subscription.*` (Stripe supports multiple endpoints; its own signing secret). No edit to Payments required.

---

## Module Structure
```
src/modules/subscriptions/
├── subscriptions.module.ts
├── subscriptions.controller.ts              # customer self-service + admin
├── subscriptions.webhook.controller.ts      # PUBLIC billing webhook
├── subscriptions.service.ts                 # lifecycle + Stripe + webhook reconcile
├── renewal.service.ts                        # @Cron reminders + expiry
├── stripe-billing.service.ts                 # Stripe products/prices/subscriptions
├── enums/ subscription-status.ts             # Stripe→enum mapping, role buckets
├── interfaces/ subscription.interfaces.ts
└── dto/ create-subscription · change-plan · cancel-subscription · override-renewal · query-subscriptions

src/modules/plans/
├── plans.module.ts
├── plans.controller.ts                       # /plans (admin manage + browse)
├── plans.service.ts                          # package + Stripe Price provisioning
└── dto/ create-plan · update-plan · query-plans
```

## Stripe Subscription Integration (best practices)
- **Prices are immutable** → changing a plan price creates a NEW Stripe Price and repoints the package; existing subscriptions keep their price unless migrated.
- **`default_incomplete`** + `save_default_payment_method: on_subscription` + expanded `latest_invoice.payment_intent` → returns a `client_secret` for **SCA-safe first-payment confirmation** on-device.
- **Plan change** uses `proration_behavior: create_prorations`.
- **Pause/Resume** via `pause_collection` (`{behavior:'void'}` / `null`).
- **Cancel** graceful (`cancel_at_period_end`) by default; **immediate** for admins.
- Billing is **automatic** (Stripe) — we never charge on a timer.

## Recurring Booking + Invoice + Billing Integration
On `invoice.payment_succeeded` (subscription invoice):
1. **Upsert** the local `Subscription` (create on first payment → `ACTIVE`; update period thereafter).
2. **Create a local `Invoice`** (idempotent by `stripeInvoiceId`) with amounts from the Stripe invoice; status `PAID`.
3. **Create a `RECURRING` Booking** for the period (technician assigned later via Dispatch).
4. **Emit `invoice.paid`** → the Invoices module (Step 25) generates + stores the PDF.

## Renewal Reminders & Failed Payments
- **Reminders:** `renewal.service` `@Cron` (daily 6am) emits `subscription.renewal_reminder` for subscriptions billing within `subscriptions.reminderDays`.
- **Failed payments:** `invoice.payment_failed` → status `PAST_DUE` + `subscription.payment_failed` event; Stripe dunning retries; final failure → `customer.subscription.deleted` → `CANCELLED`.
- **Expiry:** the cron sets `EXPIRED` once `endDate` passes.

## Features → Endpoints

### Plans (admin manage · any-authed browse)
| Feature | Method/Path | Roles |
|---|---|---|
| Browse plans | `GET /api/v1/plans` | any authed |
| Plan detail | `GET /api/v1/plans/:id` | any authed |
| Create plan (+Stripe price) | `POST /api/v1/plans` | Super/Ops |
| Update plan (price→new Stripe price) | `PATCH /api/v1/plans/:id` | Super/Ops |
| Activate / Deactivate | `PATCH /api/v1/plans/:id/activate` · `/deactivate` | Super/Ops |

### Subscriptions
| Feature | Method/Path | Roles |
|---|---|---|
| Subscribe | `POST /api/v1/subscriptions` | Customer (+admin on behalf) |
| My subscriptions | `GET /api/v1/subscriptions/me` | Customer |
| Upgrade/Downgrade | `PATCH /api/v1/subscriptions/:id/change-plan` | Customer/admin |
| Pause / Resume | `PATCH /api/v1/subscriptions/:id/pause` · `/resume` | Customer/admin |
| Cancel | `POST /api/v1/subscriptions/:id/cancel` | Customer/admin (immediate=admin) |
| List all | `GET /api/v1/subscriptions` | Subscription view |
| Override renewal | `PATCH /api/v1/subscriptions/:id/override-renewal` | Super/Ops |
| Detail | `GET /api/v1/subscriptions/:id` | Customer (own)/admin |
| Billing webhook | `POST /api/v1/webhooks/stripe/subscriptions` | Public (signed) |

View = Super/Ops/Support · Manage = Super/Ops.

## Error Handling
- 400 — non-subscribable plan, SEASONAL plan, non-serviceable address, illegal state change.
- 403 — wrong role / not owner; non-admin attempting immediate cancel.
- 404 — plan/subscription not found.

## Logging / Transaction Handling
- `Logger` records create/change/pause/resume/cancel + webhook reconciliation (ids only).
- Local invoice creation is idempotent (unique `stripeInvoiceId`); subscription activation is an upsert keyed by `stripeSubscriptionId` (safe on retried webhooks).

---

## Setup Instructions
1. `npm i stripe @nestjs/event-emitter @nestjs/schedule` (most already present).
2. Ensure `EventEmitterModule.forRoot()` and `ScheduleModule.forRoot()` are registered (foundation).
3. Register `SubscriptionsModule` and `PlansModule` in `app.module.ts`.
4. Add a `subscriptions` config namespace:
   ```ts
   subscriptions: {
     stripeWebhookSecret: process.env.STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET,
     systemUserId: process.env.SUBSCRIPTIONS_SYSTEM_USER_ID, // creator of recurring bookings
     reminderDays: Number(process.env.SUBSCRIPTION_REMINDER_DAYS ?? 3),
     serviceLeadDays: Number(process.env.SUBSCRIPTION_SERVICE_LEAD_DAYS ?? 7),
   }
   // reuses payments.stripeSecretKey + payments.currency
   ```
5. **Stripe dashboard:** add a SECOND webhook endpoint → `https://<host>/api/v1/webhooks/stripe/subscriptions`, subscribed to `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`; put its signing secret in `STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET`.
6. `rawBody: true` must be enabled in `main.ts` (already required by Payments) for webhook verification.

## Environment Variables
| Variable | Required | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | yes | shared with Payments |
| `STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET` | yes | second webhook endpoint's secret |
| `PAYMENTS_CURRENCY` | no | default `usd` |
| `SUBSCRIPTIONS_SYSTEM_USER_ID` | rec. | creator id for recurring bookings (falls back to `BILLING_SYSTEM_USER_ID`) |
| `SUBSCRIPTION_REMINDER_DAYS` | no | default 3 |
| `SUBSCRIPTION_SERVICE_LEAD_DAYS` | no | default 7 (placeholder cadence — align with visitFrequency/timezone) |

## Testing Instructions
**Unit (mock Prisma/Stripe/EventEmitter):**
- create: non-subscribable plan → 400; non-serviceable address → 400; returns client_secret.
- changePlan/pause/resume/cancel: state guards (e.g. pause only ACTIVE); immediate cancel requires admin.
- webhook onInvoicePaid: upserts ACTIVE, creates idempotent invoice, creates RECURRING booking, emits `invoice.paid`.
- onInvoiceFailed → PAST_DUE; onSubscriptionDeleted → CANCELLED.
- RenewalService: reminders within window emit events; expiry sets EXPIRED.

**Integration (Stripe test mode + CLI):**
```
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe/subscriptions
# subscribe (test card 4242...), confirm clientSecret
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

---

## Example API Requests

**Create a plan (admin)**
```
POST /api/v1/plans
Authorization: Bearer <ops token>

{ "name": "Quarterly Home Shield", "price": 49.00, "billingCycle": "QUARTERLY",
  "visitFrequency": "quarterly", "contractLengthMonths": 12, "serviceIds": ["<svc>"] }
```

**Subscribe (customer)**
```
POST /api/v1/subscriptions
Authorization: Bearer <customer token>

{ "planId": "<package uuid>", "addressId": "<address uuid>" }
```
```json
{ "stripeSubscriptionId":"sub_...","clientSecret":"pi_..._secret_...","status":"incomplete" }
```
Client confirms the `clientSecret`; on success the webhook activates the subscription.

**Upgrade / downgrade**
```
PATCH /api/v1/subscriptions/<uuid>/change-plan
Authorization: Bearer <customer token>

{ "newPlanId": "<package uuid>" }
```

**Cancel at period end**
```
POST /api/v1/subscriptions/<uuid>/cancel
Authorization: Bearer <customer token>

{ "reason": "Moving out of area" }
```

---

**Stopping after the Subscriptions module, per instruction.** No other modules generated. Remaining: **Reports** (service reports + the pesticide/compliance field set — the last long-open input), plus **Notifications** / **Admin**.
