## DNR Pest Control — Reviews & Ratings Module (Step 31)

**Module:** `reviews` (NestJS) — production-ready
**Builds on:** Prisma schema (17) · Auth (18) · Users & Profiles (19) · Bookings (21) · Dispatch (22)
**Tech:** NestJS · Prisma · PostgreSQL
**Scope:** Reviews ONLY. No other modules generated.

> ⚠️ **REQUIRED SCHEMA ADDITIONS — please approve.** The approved `Review` model has only `isPublished` (bool) and no response/moderation fields. To support the 4 statuses + admin responses:
> ```prisma
> enum ReviewStatus { PENDING PUBLISHED HIDDEN FLAGGED }
>
> // add to model Review:
>   status           ReviewStatus @default(PENDING)
>   moderationReason String?      @map("moderation_reason")
>   adminResponse    String?      @map("admin_response")
>   adminResponseAt  DateTime?    @map("admin_response_at")
>   respondedById    String?      @db.Uuid @map("responded_by_id")
>   @@index([status])
> ```
> `prisma migrate dev --name review_status_moderation`. `isPublished` is kept in sync (`true ⇔ PUBLISHED`) so existing indexes/queries keep working. Also apply the rating CHECK noted in the schema: `ALTER TABLE reviews ADD CONSTRAINT rating_range CHECK (rating BETWEEN 1 AND 5);`

> **Reconciliations (no migration):**
> - **Duplicate prevention is built in:** `Review.bookingId` is `@unique` → one review per booking, enforced by the DB (a race yields `P2002` → 409).
> - **Service ratings have no Review.serviceId** → derived by joining `Booking.serviceId`. Subscription-covered bookings (serviceId null) won't contribute to a service average — expected.
> - **Rating aggregates** are computed on the fly (avg/count/distribution). For very high read volume you can denormalize counters onto TechnicianProfile/Service later (optional).

---

## Module Structure
```
src/modules/reviews/
├── reviews.module.ts
├── reviews.controller.ts      # customer create/edit/history · public listings · admin moderate/respond
├── reviews.service.ts         # lifecycle, eligibility, anti-abuse, aggregates, moderation
├── moderation.service.ts      # content evaluation + action→status mapping (integration point)
├── enums/ review-status.ts    # ReviewStatus, ModerationAction, roles, analytics events
└── dto/ create · update · moderate · respond · query
```

## Review Eligibility Rules
A review is allowed only when: the booking exists, its status is **COMPLETED**, the actor is the booking's **customer**, the booking has an **assigned technician** (to attribute the rating), and **no review exists yet** (unique). Anything else → 400/403/409.

## Review Statuses & Visibility
- **PENDING** — awaiting moderation (when auto-publish is off).
- **PUBLISHED** — visible to everyone.
- **HIDDEN** — taken down by an admin; not publicly visible; not editable.
- **FLAGGED** — caught by the content filter or admin; hidden from public, queued for review.

Visibility: non-admins see **PUBLISHED only** on technician/service listings; the **owner** sees their own (any status) via history; **admins** see all and can filter by status.

## Rating Calculation Logic
`average` = `AVG(rating)` over **PUBLISHED, non-deleted** reviews (2-dp); `count` = number of such reviews; `distribution` = per-star (1–5) counts. Technician summary filters by `technicianId`; service summary joins `Booking.serviceId`. Hidden/flagged/pending reviews never affect public averages.

## Anti-Abuse Protection
- **One review per booking** (DB unique) — no duplicates.
- **Completed-only + ownership** — can't review others' or unfinished jobs.
- **Edit window** (`reviews.editWindowDays`, default 7) — edits locked afterward; hidden reviews can't be edited; edits **re-run moderation**.
- **Content moderation** — banned-words filter (config) routes hits to FLAGGED; clean integration point for a real moderation API.
- Bounded comment length (2000).

## Admin Moderation & Responses
- `PATCH /reviews/:id/moderate { action: PUBLISH|HIDE|FLAG, reason? }`.
- `POST /reviews/:id/response { response }` — public business reply (`adminResponse` + timestamp + responder).

## Features → Endpoints
| Feature | Method/Path | Roles |
|---|---|---|
| Create review | `POST /api/v1/reviews` | Customer |
| Edit (within window) | `PATCH /api/v1/reviews/:id` | Customer (own) |
| My review history | `GET /api/v1/reviews/me` | Customer |
| Technician reviews + summary | `GET /api/v1/reviews/technician/:id` | any authed (published) / admin (all) |
| Technician summary | `GET /api/v1/reviews/technician/:id/summary` | any authed |
| Service reviews + summary | `GET /api/v1/reviews/service/:id` | any authed / admin |
| Service summary | `GET /api/v1/reviews/service/:id/summary` | any authed |
| All reviews (moderation queue) | `GET /api/v1/reviews?status=FLAGGED` | Super/Ops/Support |
| Moderate | `PATCH /api/v1/reviews/:id/moderate` | Super/Ops/Support |
| Respond | `POST /api/v1/reviews/:id/response` | Super/Ops/Support |

## Analytics Events
Emitted via EventEmitter2 (analytics sink / dashboards can listen):
`analytics.review.submitted`, `analytics.review.updated`, `analytics.review.hidden`, `analytics.review.response_added`.

## Error Handling / Logging
- 400 — not completed / no technician / edit window passed / hidden.
- 403 — not your booking or review.
- 404 — booking/review not found.
- 409 — already reviewed (unique).
- `Logger` records create, moderation transitions, responses (ids only).

---

## Setup Instructions
1. Apply the schema additions + rating CHECK, then migrate. No new packages.
2. Ensure `EventEmitterModule.forRoot()` is registered (foundation) for analytics events.
3. Register `ReviewsModule` in `app.module.ts`.
4. Add config:
   ```ts
   reviews: {
     editWindowDays: Number(process.env.REVIEW_EDIT_WINDOW_DAYS ?? 7),
     autoPublish: (process.env.REVIEW_AUTO_PUBLISH ?? 'true') === 'true',
     bannedWords: process.env.REVIEW_BANNED_WORDS ?? '',
   }
   ```

## Testing Instructions
**Unit (mock Prisma/moderation):**
- create: non-completed → 400; not owner → 403; no technician → 400; duplicate (P2002) → 409; banned word → FLAGGED; clean + autoPublish → PUBLISHED.
- update: past window → 400; hidden → 400; edit re-evaluates status.
- summarize: average rounds to 2dp; only PUBLISHED counted; distribution sums to count.
- moderate: HIDE → status HIDDEN + isPublished false + hidden event; respond → fields set + event.
- visibility: non-admin technician list excludes non-PUBLISHED; owner history shows all.

**e2e:**
```
POST /reviews (customer, completed booking) → 201 PUBLISHED
POST /reviews (same booking again) → 409
GET  /reviews/technician/:id/summary → { average, count, distribution }
PATCH /reviews/:id/moderate (ops) { "action":"HIDE" } → hidden, drops out of public average
POST /reviews/:id/response (ops) { "response":"Thanks for your feedback!" }
```

---

## Example API Requests

**Leave a review**
```
POST /api/v1/reviews
Authorization: Bearer <customer token>

{ "bookingId": "<uuid>", "rating": 5, "comment": "On time and thorough." }
```

**Edit within the window**
```
PATCH /api/v1/reviews/<id>
Authorization: Bearer <customer token>

{ "rating": 4, "comment": "Updated: great follow-up." }
```

**Technician rating summary**
```
GET /api/v1/reviews/technician/<id>/summary
→ { "average": 4.7, "count": 32, "distribution": { "1":0,"2":1,"3":2,"4":4,"5":25 } }
```

**Moderate + respond (admin)**
```
PATCH /api/v1/reviews/<id>/moderate   { "action": "FLAG", "reason": "Possible spam" }
POST  /api/v1/reviews/<id>/response   { "response": "We're sorry to hear this — reaching out now." }
```

---

**Stopping after the Reviews & Ratings module, per instruction.** No other modules generated. The remaining backend piece is **Service Reports** (incl. the append-only `ChemicalApplication` compliance table — still pending the jurisdiction-specific pesticide field set), plus an optional **Admin/Audit** module.
