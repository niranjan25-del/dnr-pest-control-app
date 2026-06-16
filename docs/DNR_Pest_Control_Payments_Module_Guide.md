## DNR Pest Control — Payments & Stripe Integration Module (Step 24)

**Module:** `payments` (NestJS) — production-ready
**Builds on:** Prisma schema (17) · Auth (18) · Users & Profiles (19) · Services (20) · Bookings (21) · Dispatch (22) · Addresses (23) · API Spec (4)
**Tech:** NestJS · Prisma · PostgreSQL · **Stripe** (+ Apple Pay / Google Pay)
**Scope:** Payments ONLY. No other modules generated.

> **PCI posture — no raw card data, ever.** Clients confirm PaymentIntents/SetupIntents on-device with a `client_secret`; the server only handles Stripe ids/tokens. `Payment.providerTransactionId` stores the PaymentIntent id. Apple Pay and Google Pay are supported automatically via `automatic_payment_methods` (Payment Element / Payment Request) — no separate integration.

> **OPEN INPUTS — flagged, not silently hardcoded:**
> - **Tax model** → `TaxService` is a seam with strategies `none` (default 0), `flat_rate` (config rate), or `stripe_tax` (**recommended** — enable Stripe Tax). Confirm the jurisdiction/approach before production.
> - **Refund policy** (caps / approval tiers) → admin refund currently trusts the finance role; customer refunds are gated by a config window only. A formal refund-request + approval workflow would need a small schema addition (flagged).

> **Status reconciliation:** the approved `PaymentStatus` enum has **no `PROCESSING`** (`PENDING, SUCCEEDED, FAILED, REFUNDED, PARTIALLY_REFUNDED`). Stripe's in-flight "processing" maps to `PENDING`. Refunds reflect on the existing `Payment`/`Invoice` rows (no separate refund table; partial → `PARTIALLY_REFUNDED`).

---

## Module Structure
```
src/modules/payments/
├── payments.module.ts
├── payments.controller.ts        # customer + finance-admin endpoints
├── webhook.controller.ts         # PUBLIC Stripe webhook (signature-verified)
├── payments.service.ts           # orchestration + webhook reconciliation
├── stripe.service.ts             # the ONLY Stripe SDK touchpoint
├── tax.service.ts                # tax seam (OPEN INPUT)
├── enums/ payment.enums.ts       # role buckets + Stripe→schema method mapping
├── interfaces/ payment.interfaces.ts
└── dto/ create-payment-intent · refund-payment · refund-request · query-payments
```

## Payment lifecycle (one-time booking)
1. **Customer** `POST /payments/intents { bookingId }` → server creates/reuses an **Invoice** (subtotal = booking price, discount, tax via `TaxService`, total), ensures a **Stripe Customer**, writes a `Payment(PENDING)`, and creates a **PaymentIntent** (idempotency key `pi_<paymentId>`). Returns `clientSecret`.
2. **Client** confirms the intent on-device (card / Apple Pay / Google Pay). No card data hits our server.
3. **Webhook** reconciles (source of truth):
   - `payment_intent.succeeded` → `Payment.SUCCEEDED` + `paidAt` + real method (card/apple_pay/google_pay) + `Invoice.PAID`.
   - `payment_intent.payment_failed` → `Payment.FAILED`.
   - `charge.refunded` → `Payment.REFUNDED|PARTIALLY_REFUNDED` + `Invoice.REFUNDED|PARTIALLY_PAID`.
   - `payment_method.attached` → logged (saved-method lifecycle lives in Stripe).

## Features → Endpoints
| Feature | Method/Path | Roles |
|---|---|---|
| Create payment intent | `POST /api/v1/payments/intents` | Customer |
| Save a method (setup intent) | `POST /api/v1/payments/setup-intent` | Customer |
| List saved methods | `GET /api/v1/payments/methods` | Customer |
| Remove a saved method | `DELETE /api/v1/payments/methods/:pmId` | Customer |
| My payment history | `GET /api/v1/payments/me` | Customer |
| Request refund (policy) | `POST /api/v1/payments/:id/refund-request` | Customer |
| List/monitor payments | `GET /api/v1/payments` | Finance view |
| Payment detail | `GET /api/v1/payments/:id` | Finance view |
| Process refund (full/partial) | `POST /api/v1/payments/:id/refund` | Finance manage |
| Stripe webhook | `POST /api/v1/webhooks/stripe` | Public (signature-verified) |

Finance view = Super/Ops/Support · Finance manage = Super/Ops.

## Security Controls
- **No raw card data**; on-device confirmation via `client_secret`.
- **Webhook signature verification** over the **raw body** (reject on mismatch).
- **Idempotency keys** on PaymentIntent + Refund creation; webhook handlers are idempotent (safe on Stripe retries).
- **Ownership checks**: customers act only on their own payments/methods (detach verifies the method belongs to their Stripe customer).
- Amounts are **server-derived** from the invoice — never trusted from the client.

## Error Handling
- 400 — already paid, refund exceeds original, PI creation failure, bad/missing webhook signature.
- 403 — wrong role, not owner, refund window passed.
- 404 — booking/payment/method not found.

## Logging / Transaction Handling
- `Logger` records intent creation, success/fail, refunds (ids only; no PAN/secrets).
- Transactions wrap success reconciliation (payment + invoice) and refund state (payment + invoice). Invoice + first Payment row are created before the Stripe call so we hold an id for idempotency/metadata.

---

## Setup Instructions
1. `npm i stripe`.
2. Place files under `src/modules/payments/`; register `PaymentsModule` in `app.module.ts`.
3. **Enable raw body** for webhook verification in `main.ts`:
   ```ts
   const app = await NestFactory.create(AppModule, { rawBody: true });
   ```
   (Keep the global JSON parser for other routes; `rawBody:true` exposes `req.rawBody`.)
4. Add a `payments` config namespace:
   ```ts
   payments: {
     stripeSecretKey: process.env.STRIPE_SECRET_KEY,
     stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
     currency: process.env.PAYMENTS_CURRENCY ?? 'usd',
     taxStrategy: process.env.PAYMENTS_TAX_STRATEGY ?? 'none', // none | flat_rate | stripe_tax
     taxRate: Number(process.env.PAYMENTS_TAX_RATE ?? 0),       // used for flat_rate
     customerRefundWindowHours: Number(process.env.PAYMENTS_CUSTOMER_REFUND_WINDOW_HOURS ?? 24),
   }
   ```
5. The webhook route is `@Public()`; ensure global guards remain (it bypasses JWT, RolesGuard passes with no @Roles).

## Stripe Configuration
- **Dashboard:** enable Apple Pay & Google Pay (Payment methods settings); register your domain for Apple Pay; enable **Stripe Tax** if using `stripe_tax`.
- **Webhook endpoint:** add `https://<api-host>/api/v1/webhooks/stripe`; subscribe to `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `payment_method.attached`; copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
- **API version** is pinned in `stripe.service.ts` (`2024-06-20`); upgrade deliberately.

## Environment Variables
| Variable | Required | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | yes | `sk_test_…` / `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | yes | `whsec_…` from the webhook endpoint |
| `PAYMENTS_CURRENCY` | no | default `usd` (2-decimal currencies assumed) |
| `PAYMENTS_TAX_STRATEGY` | no | `none` \| `flat_rate` \| `stripe_tax` |
| `PAYMENTS_TAX_RATE` | no | e.g. `0.0875` for `flat_rate` |
| `PAYMENTS_CUSTOMER_REFUND_WINDOW_HOURS` | no | default `24` |

## Testing Instructions
**Unit (mock Stripe/Prisma/Tax):**
- createBookingPaymentIntent: already-paid invoice → 400; creates invoice with tax from TaxService; idempotency key `pi_<paymentId>`.
- webhook handlers: succeeded sets SUCCEEDED+PAID+method; duplicate event is a no-op (idempotent); refunded full vs partial.
- adminRefund: amount > original → 400; non-succeeded → 400.
- customerRefundRequest: outside window → 403.
- detachPaymentMethod: method not owned → 403.

**Integration (Stripe test mode + CLI):**
```
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
# create an intent, confirm with test card 4242 4242 4242 4242
stripe trigger payment_intent.succeeded
stripe trigger charge.refunded
```
- Verify signature failure path with a bad secret → 400.

---

## Example API Requests

**Create a payment intent (customer)**
```
POST /api/v1/payments/intents
Authorization: Bearer <customer token>

{ "bookingId": "<uuid>", "savePaymentMethod": true }
```
```json
{ "paymentId":"…","invoiceId":"…","clientSecret":"pi_..._secret_...","amount":129.00,"currency":"USD","status":"requires_payment_method" }
```
The client confirms `clientSecret` with Stripe.js / Payment Element (handles card, Apple Pay, Google Pay).

**List saved methods (customer)**
```
GET /api/v1/payments/methods
Authorization: Bearer <customer token>
```
```json
[ { "id":"pm_...","brand":"visa","last4":"4242","expMonth":12,"expYear":2030,"wallet":null } ]
```

**Process a partial refund (finance admin)**
```
POST /api/v1/payments/<uuid>/refund
Authorization: Bearer <ops token>

{ "amount": 25.00, "reason": "Partial service not completed" }
```

**Stripe webhook (Stripe → server)**
```
POST /api/v1/webhooks/stripe
Stripe-Signature: t=...,v1=...
<raw JSON event body>
```

---

**Stopping after the Payments module, per instruction.** No other modules generated. Remaining in the build order: **Reports** (service reports + the pesticide/compliance field set — the last long-open input) and the supporting **Notifications**/**Admin** modules.
