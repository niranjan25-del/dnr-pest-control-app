# DNR Pest Control — Payment & Subscription System Design (Step 12)

**Product:** DNR Pest Control platform
**Builds on:** All prior approved steps (esp. Architecture (2), DB (3), API (4), Backend (5), Customer/Admin Modules)
**Tech:** Stripe · Apple Pay · Google Pay · PostgreSQL · NestJS · Flutter
**Document type:** Payment & Subscription System Design
**Version:** Draft 1.0
**Scope note:** Design only — flows, rules, integration model, edge cases. **No code.** Payment endpoints from Step 4; `payments`/`invoices`/`subscriptions`/`coupons` tables from Step 3.

> Not financial/legal/tax advice. Tax and dispute handling below are system-design recommendations; confirm rates, rules, and compliance with a qualified accountant/attorney for your jurisdiction.

> Key architecture decision (recommended): use **Stripe Billing** for recurring subscriptions (Stripe manages prices, renewals, SCA, retries/dunning) and **Stripe PaymentIntents** for one-time charges. The DNR backend keeps **mirrored records** (`subscriptions`, `invoices`, `payments`) synced via **webhooks**. Apple Pay / Google Pay are surfaced through Stripe's payment sheet — they are payment *methods*, not separate processors. Rationale: maximum reliability/PCI-minimization with least custom billing code. Alternative (fully custom recurring scheduler) is possible but riskier; not recommended.

---

# Payment System Overview

### Business objectives
- Capture revenue reliably for one-time jobs and **recurring plans** (the strategic core, per PRD).
- Minimize PCI scope and payment-ops burden by delegating to Stripe.
- Provide clean financial data for invoicing, reporting, and compliance.

### Revenue objectives
- Maximize recurring MRR and renewal success (strong dunning/recovery).
- Reduce involuntary churn from failed payments.
- Shorten cash cycle (completion → invoice → payment) and support upsells/add-ons.

### Customer experience objectives
- Fast, familiar checkout (saved cards, **Apple Pay / Google Pay** one-tap).
- Transparent pricing (taxes, discounts shown before pay).
- Effortless plan management and accessible invoices/history.
- Trustworthy: no card data handled by the app; clear receipts.

---

# Supported Payment Methods

All methods flow through **Stripe** (tokenized). The app never sees raw card data.

### Credit Cards
- **User flow:** Stripe payment sheet → enter/select card → confirm → 3DS/SCA if required → result.
- **Validation:** Stripe validates number/expiry/CVC + 3DS; backend validates amount/invoice ownership.
- **Failure scenarios:** declined, insufficient funds, expired, 3DS failed/abandoned, fraud block → mapped errors (see Payment Failure Handling).

### Debit Cards
- Same flow as credit via Stripe; some require 3DS. Same validation/failures.

### Apple Pay
- **User flow (iOS):** "Apple Pay" button in the sheet → Face/Touch ID → tokenized card → confirm.
- **Validation:** device/wallet + Stripe; merchant must be configured (Apple Pay merchant ID, domain/app association).
- **Failure scenarios:** wallet unavailable, auth failed, unsupported device/region → fall back to card entry.

### Google Pay
- **User flow (Android):** "Google Pay" button → select card → confirm.
- **Validation:** Google Pay + Stripe; merchant config required.
- **Failure scenarios:** wallet unavailable/declined → fall back to card.

> Wallet availability is detected at runtime; show the wallet button only when supported, else default to card. Saving a method (for plans/auto-pay) requires explicit consent.

---

# One-Time Payment Workflow

```
1. Booking creation        → POST /bookings (status=pending, Idempotency-Key)
2. Price calculation       → base price (service) + add-ons
3. Tax calculation         → apply tax (Stripe Tax / configured rate) on taxable subtotal
4. Discount application     → validated coupon (POST /coupons/validate) reduces subtotal
5. Payment authorization    → POST /payments/intent → Stripe PaymentIntent (auth)
6. Payment capture          → confirm via Stripe (auto-capture) → POST /payments/{id}/confirm
7. Invoice generation       → invoice issued (number assigned), payment recorded
8. Confirmation notifications → push/email receipt + booking confirmed
```

- **Order guarantee (from Customer Module):** booking is created `pending`, then paid, then confirmed — a failed payment never loses the booking; idempotency prevents duplicates.
- **Auth vs capture:** default **auto-capture** on confirm for completed/booked service; **manual capture** (auth-now, capture-on-completion) is an option for jobs priced at completion — confirm policy.
- **SCA/3DS:** handled by Stripe; the sheet prompts as needed; backend treats `requires_action` states correctly via webhooks.

---

# Subscription Billing Workflow

Backed by **Stripe Billing**; local `subscriptions` mirrored via webhooks.

- **Monthly / Quarterly / Annual plans:** mapped to Stripe Prices per package `billing_cycle`. Customer enrolls (`POST /subscriptions`) with a saved method → Stripe subscription created → first invoice paid → service bookings generated.
- **Auto-renewal:** Stripe charges the saved method each cycle; on success, webhook updates `invoices`/`payments` and schedules the next service booking(s).
- **Renewal reminders:** pre-renewal notification (email/push) ahead of each charge (esp. annual); upcoming-invoice webhook drives it.
- **Failed payment recovery (dunning):** Stripe **Smart Retries** + DNR notifications; on failure → notify customer, retry schedule, grace period; after N failures → **pause/suspend** subscription (policy) and flag for Admin. Recovery on updated method resumes.

---

# Recurring Service Management

- **Subscription creation:** `POST /subscriptions` → Stripe subscription + local record + first service scheduling.
- **Pause subscription:** `/subscriptions/{id}/pause` → Stripe pause (no billing while paused) + halt service generation; resume re-enables.
- **Resume subscription:** reactivate billing + service schedule from next cycle.
- **Upgrade plan:** switch to higher Stripe Price → **proration** (Stripe) → immediate or next-cycle effect (policy); service cadence updated.
- **Downgrade plan:** switch to lower Price → typically **next-cycle** to avoid mid-cycle credits (policy); cadence updated.
- **Cancellation workflow:** `/subscriptions/{id}/cancel` → cancel at period end (default) or immediately (policy) → Stripe cancel → stop future service generation; contract **notice period** enforced (`422` if within notice).

---

# Pricing Engine

Computed **server-side** (never trust client), itemized for transparency.

| Component | Source / rule |
|---|---|
| **Base pricing** | `services.base_price` / `service_packages.price` |
| **Add-ons** | Optional extra services/products added to a booking (each priced) |
| **Emergency service fee** | Surcharge for urgent/same-day requests (configurable) |
| **Distance fee** | Optional fee by distance/zone beyond a threshold (uses address geocode) |
| **Tax** | Applied on taxable subtotal — recommend **Stripe Tax** or configured per-jurisdiction rate |
| **Promotional discounts** | Valid coupon reduces subtotal (before tax, per policy) |

Order: `subtotal = base + add-ons + fees` → `discount` → `taxable = subtotal − discount` → `tax` → `total`. Exact tax/discount ordering and fee values are **confirm items**.

---

# Coupon & Discount System

(Backed by `coupons`/`coupon_usage`; can also map to Stripe coupons for subscription discounts.)
- **Fixed discounts:** flat amount off (≥ min order).
- **Percentage discounts:** % off (optional max cap).
- **Expiration dates:** valid_from / valid_until.
- **Usage limits:** global `max_redemptions` + `per_customer_limit`; `redemption_count` tracked.
- **Customer eligibility rules:** new-customer-only, plan-only, segment (future); min order amount.
- Validation server-side at `POST /coupons/validate` and re-checked at payment (prevents stale/abused codes). Redemption recorded in `coupon_usage`.

---

# Refund Workflow

All refunds **Admin-only**, reason required, audited, processed via Stripe (`POST /payments/{id}/refund`).

| Type | Business rules | Approval | Notification |
|---|---|---|---|
| **Full refund** | Entire captured amount; within provider/policy window | Admin (Super/Ops per cap) | Customer "Refund issued" + updated invoice |
| **Partial refund** | ≤ remaining captured; reason logged | Admin per cap/policy | Customer partial-refund notice |
| **Cancellation refund** | Triggered by cancellation rules; may net a cancellation fee | Auto-eligible per policy, Admin confirms | Cancellation + refund (minus fee) notice |
| **Admin-initiated refund** | Goodwill/dispute resolution | Role-gated (caps; high amounts → Super Admin) | Customer notice + internal audit |

- Refunds update `invoices`/`payments` (status `refunded`/`partially_paid`) via Stripe webhook; never exceed captured; idempotent.
- **Approval tiers** by role/amount cap are a **confirm item** (ties to Admin Module ◐ cells).

---

# Invoice System

- **Generation:** invoice created on booking completion / each subscription cycle; mirrors Stripe invoice where applicable.
- **Numbering:** unique sequential `invoice_number` (e.g., `INV-YYYY-000123`) — gapless per accounting norms; generated server-side (concurrency-safe).
- **PDF generation:** server-side PDF stored to S3; branded; includes line items, tax, discount, totals, payment status.
- **Invoice history:** `GET /invoices` (customer: own; Admin: all), detail with payments.
- **Customer download:** `GET /invoices/{id}/pdf` (signed URL).

---

# Payment Failure Handling

Stripe errors mapped to friendly, actionable messages; booking/subscription state preserved.

| Failure | Handling |
|---|---|
| **Insufficient funds** | "Payment declined — insufficient funds"; retry / change method; booking stays pending |
| **Card declined** | Generic decline message; suggest another method; no retry loop |
| **Expired card** | Prompt update method; for plans → dunning + update-method link |
| **Stripe errors** (API/processing) | Safe generic message; log with `request_id`; retry transient; never expose raw error |
| **Network failures** | Idempotent retry; if uncertain, reconcile via webhook (source of truth) before showing failure |
| **3DS/SCA abandoned** | Treat as not-completed; allow re-attempt; booking pending |

Webhooks are the **source of truth** for final state; the client UI is optimistic but reconciles to webhook outcomes.

---

# Security Requirements

- **PCI compliance:** by using Stripe tokenization + Stripe-hosted card fields / wallets, DNR stays in the **lowest PCI scope (SAQ A-style)**; **no PAN/CVV/expiry** ever touches DNR servers, the app, logs, or DB.
- **Tokenization:** only Stripe customer/method tokens (`stripe_customer_id`, payment method ids) and `provider_transaction_id` stored.
- **Secure processing:** TLS everywhere; **webhook signature verification**; raw-body isolated endpoint; idempotency keys on intent/charge creation.
- **Sensitive data handling:** explicit consent to save methods; no card data in analytics/logs; refunds/financial actions audited; least-privilege keys in KMS; separate test/live keys per environment (Step 7 flavors).

---

# Fraud Prevention

- **Duplicate payment prevention:** **Idempotency-Key** on booking + payment creation; Stripe idempotency; webhook dedupe by event id.
- **Suspicious activity detection:** enable **Stripe Radar** (rules/ML); velocity checks (rapid repeated attempts), mismatch flags; step-up to 3DS on risk.
- **Chargeback handling:** capture/store evidence (service report, signature, photos, timestamps — strong dispute evidence!); respond to disputes via Stripe; track dispute state on the invoice; (automated evidence submission = future). The completed **service report + signature** is a key chargeback defense — a real benefit of this app.

---

# Admin Payment Management

- **Transaction monitoring:** payments/invoices tables with status filters; failed-payment and dispute queues.
- **Refund processing:** role-gated with caps/approval (above); confirm + audit.
- **Payment reporting:** by period/method/status; reconciliation against Stripe payouts.
- **Revenue analytics:** total, recurring vs one-time, MRR/ARR, churn, ARPU, outstanding/overdue, refund rate (Step 11 reports + read replicas).

---

# Customer Payment Experience

- **Saved payment methods:** add/remove via Stripe sheet; default for auto-pay; shown as brand + last4 only.
- **Payment history:** list with amount, date, method, status; receipts.
- **Invoice access:** view/download PDFs.
- **Subscription management:** view plan, next charge/service date, pause/resume/upgrade/downgrade/cancel (rules enforced); update payment method (esp. for dunning recovery).

---

# Notification Workflows

| Event | Channels | Notes |
|---|---|---|
| **Payment success** | push + email receipt | Includes invoice/PDF link |
| **Payment failure** | push + email | Actionable: retry / update method (dunning link for plans) |
| **Subscription renewal** | email (+push) | Pre-renewal reminder + post-charge receipt |
| **Refund completed** | push + email | Amount, reason, updated invoice |
| **Card expiring** | email/push | Prompt update before next cycle |
| **Dunning sequence** | email/push | Staged retries + suspension warning |

All respect preferences/opt-outs; avoid sensitive amounts on lock-screen previews where configurable.

---

# Analytics Events

| Event | When | Key properties |
|---|---|---|
| `payment_started` | Sheet opened / intent created | invoice_id, amount, method_type |
| `payment_completed` | Charge succeeded | payment_id, invoice_id, amount, method_type, wallet? |
| `payment_failed` | Charge failed | reason_code, amount, method_type |
| `subscription_created` | Plan enrolled | subscription_id, package_id, billing_cycle, amount |
| `subscription_renewed` | Renewal charge success | subscription_id, cycle, amount |
| `subscription_cancelled` | Cancel | subscription_id, reason, at_period_end? |
| `refund_processed` | Refund issued | payment_id, amount, type, actor_role |
| `dunning_recovered` | Failed renewal recovered | subscription_id, attempts |

(No PII/card data; ids + codes; respect consent.)

---

# Edge Cases

| Case | Behavior |
|---|---|
| **Partial payments** | Invoice `partially_paid`; track balance; allow follow-up payment; clear remaining-balance display |
| **Failed renewals** | Dunning retries + notify; grace period; suspend after N fails (policy); auto-recover on update |
| **Expired subscriptions** | End-of-term with no renewal → `expired`; stop service generation; offer re-subscribe |
| **Refund disputes / chargebacks** | Track dispute state; submit evidence (report/signature/photos); adjust invoice; audit; provider decides |
| **Mid-cycle plan change** | Proration (upgrade now / downgrade next cycle) per policy; cadence updated |
| **Double charge attempt** | Idempotency + webhook dedupe prevent it; reconcile to Stripe |
| **Webhook delay/out-of-order** | Treat Stripe as source of truth; idempotent handlers; reconcile on receipt |
| **Currency/timezone for cycles** | Single currency assumed; confirm; bill on consistent cycle anchor |
| **Refund after cancellation fee** | Net refund = paid − fee; itemize on invoice |

---

# Payment System Review

### 1. Risks
| Risk | Severity | Note |
|---|---|---|
| **Webhook reliability & reconciliation** | High | Stripe is source of truth; need idempotent, ordered, deduped handlers + reconciliation job |
| **Tax handling correctness** | High | Multi-jurisdiction tax is complex; recommend Stripe Tax; confirm rules (not legal/tax advice) |
| **Dunning / involuntary churn** | Medium–High | Configure Smart Retries + clear update-method UX; biggest recurring-revenue leak |
| **Refund approval tiers undefined** | Medium | Ties to Admin ◐ cells; specify caps/approvals |
| **Auth-vs-capture policy** (pay-now vs pay-on-completion) | Medium | Confirm per service type |
| **Apple/Google Pay merchant setup** lead time | Medium | Merchant IDs, domain/app association, entitlements |
| **Proration policy** for plan changes | Low–Medium | Define upgrade/downgrade behavior |

### 2. Recommendations
1. **Use Stripe Billing + PaymentIntents** (recommended model) — don't hand-roll recurring billing.
2. **Treat webhooks as source of truth**; build idempotent handlers + a periodic **reconciliation job** against Stripe.
3. **Adopt Stripe Tax** (or a tax provider) rather than hardcoding rates; confirm taxability rules with an accountant.
4. **Invest in dunning UX** (pre-dunning reminders, easy update-method, grace period) to protect MRR.
5. **Leverage service report + signature as chargeback evidence** — a genuine advantage; store and attach.
6. **Define financial policies** (refund caps/approvals, auth-vs-capture, proration, grace period, notice period) — these gate implementation.
7. **Provision wallet merchant setup early** (Apple Pay/Google Pay) due to lead time.

### 3. Missing requirements (to be supplied)
- **Tax model** (jurisdictions, taxability, Stripe Tax vs manual) + invoice tax display rules.
- **Financial policies:** refund caps/approval tiers, auth-vs-capture per service, proration, grace period, subscription notice period, cancellation-fee amounts.
- **Fee values:** emergency fee, distance-fee thresholds/zones.
- **Currency** confirmation (single currency assumed) and cycle anchor.
- **Invoice numbering format** + any statutory invoice fields for your region.
- Apple Pay / Google Pay merchant configuration details.

### 4. Readiness score before Chat & Notification Design
**8.5 / 10 — Ready to proceed to Chat & Notification Design.**
The payment/subscription system is comprehensively specified with a sound, low-risk integration model (Stripe Billing + PaymentIntents + wallets + webhooks) and maps cleanly to existing data and APIs. Chat & Notification Design can proceed now and is largely independent of the open financial-policy items. The tax model and financial policies above should be confirmed **before payment implementation** (not before the next design step); doing so lifts this to ~9.5/10.

*Next step on approval: Chat & Notification System Design.*
