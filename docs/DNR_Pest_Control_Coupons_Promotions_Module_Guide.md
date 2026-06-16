## DNR Pest Control — Coupons, Discounts & Promotions Module (Step 27)

**Modules:** `coupons` + `promotions` (NestJS) — production-ready
**Builds on:** Prisma schema (17) · Auth (18) · Users & Profiles (19) · Services (20) · Bookings (21) · Payments (24) · Invoices (25) · Subscriptions (26)
**Tech:** NestJS · Prisma · PostgreSQL
**Scope:** Coupons & Promotions ONLY. No other modules generated.

> ⚠️ **REQUIRED SCHEMA ADDITION — please approve.** There is **no `Promotion`/`Campaign` model** in the approved schema. The promotions sub-module introduces one (a deliberate, flagged change):
> ```prisma
> model Promotion {
>   id          String    @id @default(uuid()) @db.Uuid
>   name        String
>   description String?
>   bannerText  String?   @map("banner_text")
>   couponId    String?   @db.Uuid @map("coupon_id")
>   coupon      Coupon?   @relation(fields: [couponId], references: [id], onDelete: SetNull)
>   startsAt    DateTime  @map("starts_at")
>   endsAt      DateTime? @map("ends_at")
>   isActive    Boolean   @default(true) @map("is_active")
>   createdAt   DateTime  @default(now()) @map("created_at")
>   updatedAt   DateTime  @updatedAt @map("updated_at")
>   deletedAt   DateTime? @map("deleted_at")
>   @@index([isActive, startsAt])
>   @@map("promotions")
> }
> ```
> Add a back-relation on `Coupon`: `promotions Promotion[]`. Then `prisma migrate dev --name add_promotion`.

> **Schema reconciliations (flagged):**
> - `DiscountType` is only `PERCENTAGE` / `FIXED` — **"free service" = a 100% (or full-value) coupon**; no new enum value.
> - `CouponUsage` has `bookingId` but **no `subscriptionId`**, and `Subscription` has **no coupon link**. So booking redemption is fully tracked; **subscription discounts are validate/quote-only here** — applying a discount to a Stripe subscription is a Stripe-coupon concern (Subscriptions module), and full subscription redemption tracking would need a `CouponUsage.subscriptionId` (flagged).
> - `Coupon` has **no per-service / subscription-only scope fields** — only `minOrderAmount` + limits + dates are enforced. Finer restrictions need schema additions (flagged).

---

## Module Structure
```
src/modules/coupons/
├── coupons.module.ts
├── coupons.controller.ts        # admin CRUD/usage + customer apply/validate/remove
├── coupons.service.ts           # orchestration, redemption, anti-abuse, tracking
├── validation.service.ts        # PURE discount engine + rule checks (clean arch)
├── enums/ coupon-status.ts      # derived status, role bucket, code normalize
├── interfaces/ coupon.interfaces.ts
└── dto/ create / update / apply / validate / query

src/modules/promotions/
├── promotions.module.ts
├── promotions.controller.ts     # admin manage + customer active list
├── promotions.service.ts
└── dto/ create-promotion / update-promotion
```

## Clean Architecture
- **`CouponValidationService`** — pure business rules + discount math, no DB. Trivial to unit-test, reusable by Payments/Subscriptions for quoting.
- **`CouponsService`** — orchestration, persistence, transactions, anti-abuse.
- **`PromotionsService`** — marketing layer over coupons.

## Discount Engine
- PERCENTAGE → `amount × value/100`; FIXED → `value`. Result rounded to 2 dp, clamped to `[0, amount]` (a discount never exceeds the order; a "free service" coupon zeroes it).
- Returns `{ valid, reason?, discount, finalAmount }`.

## Coupon Rules Enforced
Expiration (`validFrom`/`validUntil`), global usage (`maxRedemptions`), per-customer limit (`perCustomerLimit` via `CouponUsage` count), minimum order (`minOrderAmount`), enabled flag. Derived status: **ACTIVE / EXPIRED / DISABLED / EXHAUSTED**.

## Anti-Abuse Protection
- Codes normalized (trim + uppercase) → no case/space evasion.
- **One coupon per booking**; cannot apply to an **already-paid** booking (checks for PAID/PARTIALLY_PAID invoice).
- **Atomic global-limit guard:** redemption increments via `updateMany` gated on `redemptionCount < maxRedemptions`, so concurrent redemptions can't over-redeem (if the guarded update affects 0 rows → `409`).
- Per-customer limit checked against `CouponUsage` within the transaction.
  > For **strict single-use-per-customer**, add a partial unique index (raw SQL migration):
  > `CREATE UNIQUE INDEX uniq_coupon_customer ON coupon_usage(coupon_id, customer_id);`
  > (Only valid when per-customer limit is exactly 1.)
- Removal reverses cleanly (delete usage + decrement count + clear booking) and is blocked once paid.

## Features → Endpoints

### Coupons
| Feature | Method/Path | Roles |
|---|---|---|
| Validate / quote (no redemption) | `POST /api/v1/coupons/validate` | any authed |
| Apply to booking | `POST /api/v1/coupons/apply` | Customer (own) / admin |
| Remove from booking | `DELETE /api/v1/coupons/booking/:bookingId` | Customer (own) / admin |
| Create | `POST /api/v1/coupons` | Super/Ops |
| List | `GET /api/v1/coupons` | Super/Ops |
| Detail | `GET /api/v1/coupons/:id` | Super/Ops |
| Edit | `PATCH /api/v1/coupons/:id` | Super/Ops |
| Disable | `PATCH /api/v1/coupons/:id/disable` | Super/Ops |
| Usage stats | `GET /api/v1/coupons/:id/usage` | Super/Ops |
| Usage history | `GET /api/v1/coupons/:id/usage/history` | Super/Ops |

### Promotions
| Feature | Method/Path | Roles |
|---|---|---|
| Active promotions | `GET /api/v1/promotions` | any authed |
| All promotions | `GET /api/v1/promotions/all` | Super/Ops |
| Create / Update / Delete | `POST` · `PATCH /:id` · `DELETE /:id` | Super/Ops |

## Booking & Subscription Integration
- **Booking:** `apply` sets `Booking.couponId` + `Booking.discountAmount` and records `CouponUsage`. Payments/Invoices already read `discountAmount` (invoice subtotal − discount + tax).
- **Subscription:** `validate` with `amount` quotes a discount; **apply a Stripe coupon in the Subscriptions module** to actually discount recurring billing (and add `CouponUsage.subscriptionId` for tracking — flagged).

## Error Handling
- 400 — invalid value/dates, min-order not met, expired/not-started, paid booking.
- 403 — wrong role / not owner.
- 404 — coupon/booking/promotion not found.
- 409 — coupon already on booking, or limit reached under concurrency.

## Logging / Transaction Handling
- `Logger` records create/disable/apply/remove (ids/codes only).
- Apply and remove run in `$transaction` (increment/decrement + usage row + booking update together).

---

## Setup Instructions
1. Add the `Promotion` model (+ `Coupon.promotions` back-relation) and migrate.
2. (Optional, strict single-use) add the partial unique index above.
3. Place files under `src/modules/coupons/` and `src/modules/promotions/`; register `CouponsModule` and `PromotionsModule` in `app.module.ts`.
4. Requires Auth (guards/decorators) + global `ValidationPipe`. No new packages.

## Testing Instructions
**Unit (CouponValidationService — no mocks needed):**
- PERCENTAGE/FIXED math; clamp to amount; 100% → finalAmount 0.
- disabled/expired/exhausted/not-started/min-order/per-customer → correct `reason`.

**Unit (CouponsService, mock Prisma):**
- create: bad percentage (>100) → 400; duplicate code → 409; validUntil ≤ validFrom → 400.
- apply: not owner → 403; already has coupon → 409; paid booking → 400; success → usage row + increment + booking discount.
- atomic guard: simulate guarded `updateMany` count 0 → 409.
- remove: paid → 400; success → decrement + cleared booking.

**e2e:**
```
POST /api/v1/coupons (ops) {code:"SPRING20",discountType:"PERCENTAGE",value:20,maxRedemptions:100,perCustomerLimit:1,validFrom:...} → 201
POST /api/v1/coupons/validate (customer) {code:"SPRING20",bookingId:...} → {valid:true,discount,finalAmount}
POST /api/v1/coupons/apply (customer) {code:"SPRING20",bookingId:...} → discount applied
POST /api/v1/coupons/apply (same customer, 2nd booking) → 400 (per-customer limit)
GET  /api/v1/coupons/:id/usage (ops) → {redemptionCount, uniqueCustomers, totalDiscount}
GET  /api/v1/promotions (customer) → active promos
```

---

## Example API Requests

**Create a percentage coupon (admin)**
```
POST /api/v1/coupons
Authorization: Bearer <ops token>

{ "code": "SPRING20", "discountType": "PERCENTAGE", "value": 20,
  "minOrderAmount": 50, "maxRedemptions": 500, "perCustomerLimit": 1,
  "validFrom": "2026-03-01T00:00:00Z", "validUntil": "2026-04-01T00:00:00Z" }
```

**Apply to a booking (customer)**
```
POST /api/v1/coupons/apply
Authorization: Bearer <customer token>

{ "code": "SPRING20", "bookingId": "<uuid>" }
```
```json
{ "bookingId":"…","code":"SPRING20","discount":"24.00","finalAmount":"96.00" }
```

---

## Example Coupon Scenarios
1. **Percentage with cap by order:** `WELCOME15` (15%) on a $120 booking → $18 off, total $102.
2. **Fixed amount:** `FALL25` (FIXED $25) on a $120 booking → $25 off; on a $20 booking → clamped to $20 (free).
3. **Free service:** `FREEINSPECT` (PERCENTAGE 100) on an inspection → $0 total.
4. **Minimum order:** `BIG10` (FIXED $10, minOrderAmount $80) on a $60 booking → rejected ("Minimum order amount is 80").
5. **Per-customer limit 1:** second apply by the same customer → rejected.
6. **Global limit / exhausted:** the 501st redemption of a 500-cap coupon → `409` (atomic guard).
7. **Expired/disabled:** past `validUntil` → EXPIRED; `disable` → DISABLED; both rejected at validate/apply.
8. **Promotion banner:** `SPRING20` linked to a "Spring Sale" promotion → appears in `GET /promotions` while live; auto-hidden once the coupon expires.

---

**Stopping after the Coupons & Promotions module, per instruction.** No other modules generated. Remaining: **Reports** (service reports + the pesticide/compliance field set — the last long-open input), plus **Notifications** / **Reviews** / **Admin**.
