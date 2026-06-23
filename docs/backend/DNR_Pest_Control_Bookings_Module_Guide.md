# DNR Pest Control — Bookings & Scheduling Module (Step 21)

**Module:** `bookings` (NestJS) — production-ready
**Builds on:** Prisma schema (Step 17) · Auth (18) · Users & Profiles (19) · Services (20) · API Spec (4)
**Scope:** Bookings & Scheduling ONLY. No other modules generated.

> **Open inputs handled explicitly (the ones flagged for many steps):**
> - **Business rules are config-driven with PLACEHOLDER defaults** — `booking.minLeadTimeHours` (24), `booking.rescheduleCutoffHours` (24), `booking.cancelFeeWindowHours` (24), `booking.windowSlots` (9–12 / 12–15 / 15–18). Set real values in config before production.
> - **Service-area validation** uses the schema's `address.isServiceable` flag as a **pluggable seam** (`assertServiceable`). Drop your geocoding/polygon/zip logic in there when defined.
> - **Cancellation fee** is computed as an *eligibility flag* only; the actual fee amount/charge is owned by the **Payments module**.
> - **Pricing/coupon/tax**: booking `price` is a snapshot of the service base price, `discountAmount = 0`. Coupons are linked but full validation + discount/tax computation belongs to **Payments**.

> **Status reconciliation:** requested "Assigned"/"Rescheduled" are NOT booking-status enum values in the approved schema. "Assigned" is represented via the `TechnicianAssignment` relation (assigning moves PENDING→CONFIRMED); "Rescheduled" changes the window and writes a status-history note (status unchanged). See `enums/booking-status.ts`.

---

## Module Structure
```
src/modules/bookings/
├── bookings.module.ts
├── bookings.controller.ts          # all endpoints
├── bookings.service.ts             # lifecycle: create/list/detail/reschedule/cancel/status/history/calendar
├── scheduling.service.ts           # availability slots + capacity checks (SRP)
├── assignment.service.ts           # assign/reassign with conflict checks (SRP)
├── enums/
│   └── booking-status.ts           # state machine, active/terminal sets, role buckets
├── interfaces/
│   └── booking.interfaces.ts       # pagination, time window, availability slot
└── dto/
    ├── create-booking.dto.ts
    ├── reschedule-booking.dto.ts
    ├── cancel-booking.dto.ts
    ├── update-status.dto.ts
    ├── assign-technician.dto.ts
    ├── query-bookings.dto.ts
    └── availability-query.dto.ts
```

## Why three services (SOLID)
- **BookingsService** — booking lifecycle + role-scoped reads.
- **SchedulingService** — availability/capacity (no ownership concerns).
- **AssignmentService** — dispatch logic (technician conflict checks, reassignment).

---

## Features → Endpoints

| Feature | Method/Path | Roles | Notes |
|---|---|---|---|
| Availability slots | `GET /api/v1/bookings/availability?date=` | any authed | capacity per window slot |
| Calendar | `GET /api/v1/bookings/calendar?from=&to=` | Technician, Admin* | role-scoped |
| Create booking | `POST /api/v1/bookings` | Customer, Admin-manage* | admin may pass `customerId` |
| List bookings | `GET /api/v1/bookings` | any authed | role-scoped + filter/paginate |
| Booking detail | `GET /api/v1/bookings/:id` | any authed | role-scoped |
| Status history | `GET /api/v1/bookings/:id/status-history` | any authed | role-scoped |
| Reschedule | `PATCH /api/v1/bookings/:id/reschedule` | Customer (own), Admin-manage* | cutoff enforced for non-admins |
| Cancel | `POST /api/v1/bookings/:id/cancel` | Customer (own), Admin-manage* | returns `cancellationFeeEligible` |
| Update status | `POST /api/v1/bookings/:id/status` | Technician (assigned), Admin-dispatch* | state machine enforced |
| Assign / reassign | `POST /api/v1/bookings/:id/assign` | Admin-dispatch* | conflict-checked, transactional |

\* Admin buckets: **view** = Super/Ops/Dispatcher/Support · **dispatch** = Super/Ops/Dispatcher · **manage** = Super/Ops/Dispatcher/Support.

## Authorization model
- Coarse: `@Roles` + global `RolesGuard`.
- Fine: in-service **role scoping** — customers see/act on their own bookings; technicians see/act on assigned bookings; admins see all. Status transitions validated by the **state machine** and role (technicians limited to field statuses on their own jobs).

## Booking Status History Tracking
Every create/assign/reschedule/cancel/status-change writes a `BookingStatusHistory` row (append-only) inside the same transaction, with `previousStatus`, `newStatus`, `changedById`, and a `note`.

## Error Handling
- 400 — validation, illegal transition, out-of-area, overlap, no capacity, lead/cutoff violations, invalid service/coupon.
- 403 — role/ownership (e.g. technician updating a non-assigned booking).
- 404 — booking/technician not found.
- 409 — technician double-booked on assignment.
All via the foundation's global exception filter (standard envelope + `request_id`).

## Logging
- `Logger` per service logs create/assign/reschedule/cancel/status changes (ids only). Sensitive actions also captured by the foundation audit layer (`audit_logs`).

## Transaction Handling
- **Create** (booking + initial status history + image linking), **assign** (retire old + create new + PENDING→CONFIRMED + history), **reschedule** (update + history), **cancel** (update + retire assignment + history), **status update** (update + history + complete assignment) — each wrapped in `prisma.$transaction` for atomicity.

---

## Setup Instructions
1. Place files under `src/modules/bookings/`.
2. Register `BookingsModule` in `app.module.ts`.
3. Add the `booking` config namespace in `src/config/configuration.ts`:
   ```
   booking: {
     minLeadTimeHours: Number(process.env.BOOKING_MIN_LEAD_HOURS ?? 24),
     rescheduleCutoffHours: Number(process.env.BOOKING_RESCHEDULE_CUTOFF_HOURS ?? 24),
     cancelFeeWindowHours: Number(process.env.BOOKING_CANCEL_FEE_WINDOW_HOURS ?? 24),
     windowSlots: [['09:00','12:00'],['12:00','15:00'],['15:00','18:00']],
   }
   ```
4. Requires Auth (global guards + decorators), Users & Profiles, and Services modules (earlier steps), plus the global `ValidationPipe`.
5. No new packages.

> ⚠️ **Before production:** confirm the placeholder rule values, the **service-area logic** (replace the `isServiceable` seam if needed), **timezone** handling for window slots (currently UTC), and the **cancellation-fee amount** (Payments module).

## Testing Instructions
**Unit (mock Prisma/Scheduling):**
- create: inactive service → 400; non-serviceable address → 400; overlap → 400; lead-time violation → 400; no capacity → 400; success → PENDING + history row + images linked.
- assign: terminal booking → 400; unavailable technician → 400; overlapping assignment → 409; success → assignment + PENDING→CONFIRMED + history.
- updateStatus: technician not assigned → 403; technician illegal target → 403; illegal transition → 400; COMPLETED → assignment COMPLETED.
- reschedule: non-admin within cutoff → 400; overlap → 400.
- cancel: terminal → 400; within fee window → `cancellationFeeEligible:true`.
- scoping: customer/technician only see their own/assigned; admin sees all.

**e2e (Supertest + seeded data):**
```
GET  /api/v1/bookings/availability?date=2026-07-01          → slots w/ capacity
POST /api/v1/bookings (customer)                            → 201 PENDING
POST /api/v1/bookings/:id/assign (dispatcher)               → 200 CONFIRMED + assignment
POST /api/v1/bookings/:id/status {status:"EN_ROUTE"} (assigned tech) → 200
POST /api/v1/bookings/:id/status {status:"EN_ROUTE"} (other tech)    → 403
POST /api/v1/bookings/:id/cancel (customer own)             → 200 cancellationFeeEligible
GET  /api/v1/bookings (technician)                          → only assigned
```

---

## Example API Requests

**Check availability**
```
GET /api/v1/bookings/availability?date=2026-07-01
Authorization: Bearer <customer token>
```
```json
[
  { "start":"2026-07-01T09:00:00.000Z","end":"2026-07-01T12:00:00.000Z","capacity":5,"booked":2,"available":3 },
  { "start":"2026-07-01T12:00:00.000Z","end":"2026-07-01T15:00:00.000Z","capacity":5,"booked":5,"available":0 }
]
```

**Create a booking (customer)**
```
POST /api/v1/bookings
Authorization: Bearer <customer token>

{
  "serviceId": "<uuid>",
  "addressId": "<uuid>",
  "scheduledWindowStart": "2026-07-01T09:00:00.000Z",
  "scheduledWindowEnd": "2026-07-01T12:00:00.000Z",
  "notes": "Ants in the kitchen; dog in the yard",
  "imageFileIds": ["<uuid>"]
}
```

**Assign a technician (dispatcher)**
```
POST /api/v1/bookings/<uuid>/assign
Authorization: Bearer <dispatcher token>

{ "technicianId": "<uuid>" }
```

**Technician updates status**
```
POST /api/v1/bookings/<uuid>/status
Authorization: Bearer <technician token>

{ "status": "EN_ROUTE", "note": "Leaving previous job" }
```

**Reschedule (customer)**
```
PATCH /api/v1/bookings/<uuid>/reschedule
Authorization: Bearer <customer token>

{ "scheduledWindowStart":"2026-07-03T12:00:00.000Z",
  "scheduledWindowEnd":"2026-07-03T15:00:00.000Z",
  "reason":"Out of town" }
```

---

**Stopping after the Bookings module, per instruction.** No other modules generated. Next in the build order: **Payments** (invoices/Stripe/refunds; needs the financial-policy + tax inputs) and **Reports** (service reports + compliance; needs the chemical-field set). COMPLETED bookings are the trigger point both will hook into.
