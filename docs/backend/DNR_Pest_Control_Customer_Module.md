# DNR Pest Control — Customer Module Design (Step 9)

**Product:** DNR Pest Control app
**Builds on:** All prior approved steps (PRD · Architecture · DB · API · Backend · Auth · Flutter Arch · UI/UX)
**Module:** Customer (residential + commercial)
**Document type:** Functional Module Design
**Version:** Draft 1.0
**Scope note:** Functional design only — flows, components, validation, API mapping, edge cases. **No code.** Endpoints referenced are from the Step 4 API Spec; visual tokens/components from Step 8.

---

# Customer Module Overview

### Objectives
Deliver the complete self-service experience a customer needs to discover, book, pay for, track, and review pest control services — and manage recurring plans — with minimal friction and maximum transparency.

### User goals
- Book the right service quickly, for the right property, at a convenient time window.
- Know what's happening (confirmation, reminders, technician en route, what was treated).
- Pay easily and see invoices/history.
- Get help and follow up (reschedule, cancel, message, review).
- Manage recurring treatments without phone calls.

### Business goals
- Drive **recurring-plan adoption** and retention (core revenue, per PRD).
- Reduce office call volume via self-service.
- Reduce no-shows through reminders and clear scheduling.
- Increase trust (transparency + proof of service) → reviews, referrals, repeat business.
- Capture clean booking/payment data for operations and reporting.

---

# Customer Dashboard

### Dashboard layout
Top app bar (greeting + property/notification icons) → scrollable body (16 padding) → bottom nav (Home · Bookings · Services · Account).

### Widgets
- **Primary CTA:** "Book a Service" (full-width, `primary/500`).
- **Upcoming appointment card:** next booking with service, date + **time window**, status badge, and a "Track technician" entry when `en_route`/`in_progress`.
- **Active plan card** (if subscribed): plan name, next service date, manage link.
- **Recent bookings strip:** last 2–3 with status.
- **Notifications summary:** unread count + latest item, tap → feed.
- Optional **coupon/promo banner**.

### Quick actions
Book service · View invoices · Manage plan · Add/select address.

### Recent bookings
- Source: `GET /bookings?limit=3` (own scope). Tappable → Booking Details.

### Upcoming appointments
- Source: `GET /bookings?status=confirmed,en_route,in_progress&from=now`. Shows soonest first; en-route exposes tracking.

### Notifications summary
- Source: unread count from `GET /notifications?unread=true`. Tap → Notifications feed.

**Loading/empty:** skeleton cards while loading; empty state ("No bookings yet — Book your first service") with primary CTA.

---

# Customer Profile Management

### Personal information
- Fields: full name, email (read-only if Firebase-managed), phone, customer type (residential/commercial), company name (commercial).
- Source/update: `GET /customers/me`, `PATCH /customers/me`.

### Phone verification
- Optional/configurable (policy open). If enabled: OTP via SMS (provider), verify before phone-dependent features. Status badge "Verified".

### Email verification
- Handled by **Firebase** (Step 6). Status read from token; unverified users may see a soft prompt (and, if policy enforces, be blocked from booking until verified).

### Profile editing
- Inline edit or edit sheet; validation on save; success snackbar.

### Password management
- For Firebase-managed accounts, **password change/reset is via Firebase** (Step 6). "Change password" triggers Firebase reset flow; no password handled by backend. (For social-only accounts, hide password option.)

---

# Address Management

### Add address
- Bottom-sheet form: label, line1, line2, city, state, postal, country, property type, **access notes**, **gate code** (sensitive 🔒), optional map pin.
- API: `POST /customers/me/addresses`. Validation: required line1/city/state/postal/country; postal format by country.

### Edit address
- Same form pre-filled; `PATCH /customers/me/addresses/{id}`.

### Delete address
- Confirm dialog; `DELETE /customers/me/addresses/{id}`. **Blocked (409)** if referenced by an active booking → show explanation.

### Set default address
- Toggle/"Set as default"; stored on customer (`default_address_id`). Default pre-selected in booking.

### Service area validation
- On add/select, validate the address falls within DNR's serviceable area (geocode + service-area check).
- If **out of area**: show clear message and prevent booking for that address (see Edge Cases). Allow saving the address but flag it "Not serviceable".

---

# Service Booking Workflow

A stepped flow with a persistent progress indicator, "Back", and contextual "Continue". State held in a Riverpod booking notifier; nothing is created server-side until **confirm** (Step 9/10). An `Idempotency-Key` is generated at review and reused on submit.

### Step 1 — Select service type
- **Purpose:** One-time service vs recurring plan.
- **UI:** two large selectable cards (One-time / Plan); short descriptions.
- **Validation:** a selection required to continue.
- **API:** none yet (drives subsequent steps).
- **Errors:** none.

### Step 2 — Select pest category
- **Purpose:** Narrow to the pest problem (rodents, termites, roaches, etc.).
- **UI:** category grid/chips with icons; "Not sure / General inspection" option.
- **Validation:** one category (or "Not sure") required.
- **API:** `GET /services?category=…` to fetch matching services (cached catalog).
- **Errors:** empty category → show all services; network error → retry on catalog fetch.

### Step 3 — Select service package
- **Purpose:** Choose the specific service (or plan tier).
- **UI:** list of service/package cards (name, short desc, **price**, est. duration); plan cards show cadence/billing.
- **Validation:** one selection; commercial users may see commercial-tier options.
- **API:** `GET /services/{id}` / `GET /packages` for detail.
- **Errors:** unavailable/inactive item hidden; price load failure → retry.

### Step 4 — Select address
- **Purpose:** Where service happens.
- **UI:** address selector (default pre-selected) + "Add new address"; serviceability check on selection.
- **Validation:** an address required and **must be in service area**.
- **API:** `GET /customers/me/addresses`; service-area validation.
- **Errors:** out-of-area → block with message; no addresses → inline add.

### Step 5 — Select date and time
- **Purpose:** Pick a date and **time window**.
- **UI:** calendar (future dates only) + window chips (e.g., 9–12, 12–3, 3–6); unavailable windows disabled.
- **Validation:** date ≥ minimum lead time (policy); a window selected.
- **API:** availability check for date/window (and, where applicable, suggested assignability).
- **Errors:** past/too-soon date blocked; no availability → suggest next available; `422` lead-time violation handled.

### Step 6 — Upload images
- **Purpose:** Let the customer show the pest problem (helps the tech prepare).
- **UI:** optional photo grid (camera/gallery), captions optional, progress per image.
- **Validation:** optional; type/size limits enforced.
- **API:** `POST /files` (S3 presigned flow); file ids attached to the booking payload.
- **Errors:** unsupported type/too large → inline; upload failure → retry; offline → allow proceeding without images.

### Step 7 — Add notes
- **Purpose:** Free-text context (pets, severity, special access).
- **UI:** multiline field with char counter; quick-tag chips (e.g., "pets on site").
- **Validation:** optional; max length.
- **API:** included in booking payload.
- **Errors:** length exceeded → inline.

### Step 8 — Review booking
- **Purpose:** Confirm everything + price (incl. coupon).
- **UI:** summary (service, address, date/window, images count, notes) + **coupon field** + price breakdown (subtotal, discount, total).
- **Validation:** coupon validated before applying.
- **API:** `POST /coupons/validate` (on apply); compute/display price.
- **Errors:** invalid/expired coupon (`422`) → message, keep editable; price mismatch → re-fetch.

### Step 9 — Payment
- **Purpose:** Pay (one-time) or set up auto-pay (plan).
- **UI:** payment method (saved last4 or add via **Stripe payment sheet**), amount, "Pay & Confirm"; plans require a saved method for recurring billing.
- **Validation:** valid payment method; explicit user confirmation (per security rules).
- **API:** create booking (`POST /bookings` with `Idempotency-Key`) → `POST /payments/intent` → confirm via Stripe → `POST /payments/{id}/confirm`. (Order can be: create booking pending → pay → confirm.)
- **Errors:** payment failure → retry / change method (booking stays pending, not lost); double-tap protected by idempotency.
- **Security:** no card data in app; Stripe-tokenized only.

### Step 10 — Booking confirmation
- **Purpose:** Reassure and orient.
- **UI:** success screen (checkmark, booking summary, date/window, what's next), "View booking" + "Done"; confirmation notification fired.
- **Validation:** none.
- **API:** booking now `confirmed`; `GET /bookings/{id}` for detail.
- **Errors:** if confirmation fetch fails, still show success (server has the booking) + retry detail load.

> Plan note: enrolling in a plan also creates a **subscription** (`POST /subscriptions`) and schedules the first/recurring bookings.

---

# Booking Management

### Upcoming bookings
- `GET /bookings?status=pending,confirmed,en_route,in_progress`. Cards with status badge; tap → detail.

### Past bookings
- `GET /bookings?status=completed,cancelled,no_show`. Includes "Rebook" and "Leave review" (if eligible).

### Reschedule booking
- `PATCH /bookings/{id}` with new window. **Policy-gated** (reschedule cutoff); blocked states disabled. Errors: `409` conflict, `422` outside cutoff → explain.

### Cancel booking
- `POST /bookings/{id}/cancel` with reason. Confirm dialog; **cancellation fee** shown if within fee window. Errors: `422` non-cancellable state.

### Booking details
- Header (service + status), schedule, address, assigned technician, **status timeline** (`GET /bookings/{id}/status-history`), **service report** when completed (pests/areas/recommendations), invoice link, map (en route), actions (reschedule/cancel/track/pay/review by state).

---

# Payment Experience

### Payment methods
- Manage via Stripe (saved cards by last4); add/remove through the payment sheet. Plans need a default method for auto-pay. No raw card data stored/handled in app.

### Invoice viewing
- `GET /invoices` (own), `GET /invoices/{id}` (detail with line items + payments), `GET /invoices/{id}/pdf` (download/share). Status badges (paid/overdue/pending/refunded).

### Payment history
- List of payments with amount, date, method, status; tied to invoices/bookings. Refunds shown clearly.

---

# Real-Time Tracking *(en-route view; live GPS is post-MVP per PRD)*

### Technician tracking
- When booking is `en_route`/`in_progress`, show map with latest technician location: `GET /bookings/{id}/technician-location`.
- MVP fallback (if live GPS deferred): show status + last-known/ETA without continuous tracking.

### ETA updates
- Display estimated arrival from status + (future) location; update on status changes and (future) location pings.

### Status changes
- Status timeline updates (confirmed → en_route → arrived → in_progress → completed) via push + on-screen badge; pull-to-refresh and (future) real-time push.

---

# Chat Experience *(future per PRD; designed now)*

### Customer–technician messaging
- Conversation list → thread. `GET /conversations`, `POST /conversations`, `GET /conversations/{id}/messages`, `POST /conversations/{id}/messages`. Scoped to participants.

### Image sharing
- Attach via `POST /files` → reference `attachment_file_id` in the message.

### Read receipts
- Per-message `read_at`; show single/double-tick style; unread counts on the list.

---

# Reviews & Ratings

### Rating workflow
- Prompted after completion (and from past booking). Star (1–5) + optional comment.

### Review submission
- `POST /reviews` (one per booking; `409` if exists). Submitted reviews are `is_published=false` pending Admin moderation.

### Review editing rules
- Editable while **pending moderation / within a short window** (policy, e.g., 24h); once published, edits disabled (or require re-moderation). One review per booking enforced.

---

# Notifications

### Push notifications (FCM)
- Booking confirmed, reminder (before window), technician en route, completion, payment receipt/failure, plan renewal, chat message. Deep-link to relevant screen (role-checked). Device token via `POST /notifications/devices`.

### SMS notifications
- Key transactional events (confirmation, reminder, en route) via SMS provider for reliability, respecting opt-in.

### Email notifications
- Confirmations, invoices/receipts (with PDF), plan updates. Respect preferences.

**Preferences:** per-channel toggles in Profile; quiet-hours respected where feasible.

---

# Customer User Flows

### New customer
```
Splash → Onboarding → Register (email/Google/Apple) → (verify email) → Profile setup + add address
→ Dashboard → Book Service (Steps 1–10) → Payment → Confirmation
→ Reminder push → Track en route → Service completed → View report → Pay (if not prepaid) → Review
```

### Returning customer
```
Splash → (silent token refresh) → Dashboard (upcoming + recent)
→ Rebook from history OR new booking (saved address/method speed it up) → Confirm → done
→ Manage bookings (reschedule/cancel), pay invoices, message, review
```

### Recurring (plan) customer
```
Dashboard shows Active Plan card → plan auto-generates bookings
→ Reminders before each visit → auto-pay per cycle → service report after each visit
→ Manage plan (pause/cancel within terms), update payment method
→ Renewal notifications
```

---

# Edge Cases

| Case | Behavior |
|---|---|
| **Failed payment** | Booking remains `pending` (not lost); show failure, allow retry / change method; for plans, retry schedule + notification; never double-charge (idempotency) |
| **Technician cancellation** | Customer notified; booking returns to needing reassignment; offer reschedule/auto-reassign; apologize + no fee |
| **Customer no-show** | After window, Admin/tech marks `no_show`; policy fee may apply; customer notified with rebook option |
| **Out-of-service-area booking** | Block at address selection with clear message; capture lead for possible expansion; suggest contacting office |
| **Connectivity issues** | Cached reads still viewable; booking submit requires connectivity (queue + retry with idempotency); image uploads retry; clear offline messaging; never silently drop a booking |
| **Coupon invalid/expired** | `422` at validate/confirm → message, keep flow editable |
| **Double submit** | Idempotency-Key prevents duplicate bookings/charges |
| **Session expiry mid-flow** | Silent refresh; if it fails, preserve in-progress booking state where possible, prompt re-login, resume |

---

# Security Considerations

- **Auth & ownership:** all customer endpoints scoped to the authenticated customer; backend enforces ownership (Steps 4/6). Role gates UI only.
- **Sensitive data:** gate codes/access notes are 🔒 (encrypted, limited exposure); shown to customer who owns them and the assigned technician only.
- **Payments:** no card data in app; Stripe tokenization; explicit confirmation before paying.
- **Account safety:** secure token storage; forced logout on refresh failure; password reset via Firebase.
- **Privacy:** customer-uploaded images stored privately (signed URLs); no PII in logs; notifications avoid leaking sensitive detail on lock screens.
- **Explicit consent:** terms acceptance at registration; payment and cancellation actions confirmed.

---

# Analytics Events

| Event | When | Key properties |
|---|---|---|
| `booking_started` | Enters Step 1 | entry_point, service_type |
| `booking_step_completed` | Each step advance | step_number, step_name |
| `booking_completed` | Confirmation (Step 10) | booking_id, service_id/package_id, amount, is_recurring, coupon_used |
| `payment_completed` | Payment success | payment_id, invoice_id, amount, method |
| `payment_failed` | Payment failure | reason_code, amount |
| `review_submitted` | Review posted | booking_id, rating |
| `chat_initiated` | First message in a convo | conversation_id, booking_id? |
| `booking_cancelled` | Cancel confirmed | booking_id, fee_applied, reason |
| `plan_subscribed` | Subscription created | package_id, billing_cycle |

(No PII in analytics payloads; use ids. Respect consent/opt-out.)

---

# Customer Module Readiness Review

### 1. Risks
| Risk | Severity | Note |
|---|---|---|
| **Booking-then-payment ordering & failure recovery** | High | Must guarantee no lost bookings / no double charges; idempotency + clear pending state |
| **Service-area validation source** undefined | Medium–High | Needs the actual serviceable-area definition / geocoding approach |
| **Live tracking expectation vs MVP** | Medium | Live GPS is post-MVP; manage UX expectations with status-based fallback |
| **Email/phone verification policy** unconfirmed | Medium | Determines whether booking is blocked pre-verification |
| **Coupon/cancellation/reschedule rules** need exact values | Medium | Cutoffs, fees, limits must be concrete |
| **Chat scope** (MVP vs future) | Low–Medium | Confirm to avoid building ahead of scope |

### 2. Recommendations
1. **Lock the booking↔payment transaction model** (create-pending → pay → confirm) and failure recovery before building — it's the riskiest customer flow.
2. **Define service-area validation** (zip list, radius, or polygon + geocoder) so Step 4 is buildable.
3. **Confirm verification policy** (email/phone) and whether it gates booking.
4. **Provide concrete business-rule values** (lead time, reschedule cutoff, cancellation fee window, coupon limits).
5. **Decide MVP scope** for live tracking and chat; design fallbacks (already specified) accordingly.
6. **Reuse the shared component library** (Step 8) — no bespoke customer components.

### 3. Missing requirements (to be supplied)
- Serviceable-area definition + geocoding method.
- Exact booking/cancellation/reschedule/coupon business-rule values.
- Verification enforcement policy (email/phone).
- Tax handling on invoices (rate/source) for the price breakdown.
- Whether commercial customers need multi-contact / PO / contract specifics at booking.
- The four long-standing inputs (compliance fields chiefly — affects the report shown in Booking Details).

### 4. Readiness score before Technician Module Design
**8 / 10 — Ready to proceed.**
The Customer Module is fully specified end-to-end and maps cleanly to existing APIs, screens, and flows. It can move forward in parallel; the open items above are refinements rather than blockers, **except** the booking↔payment transaction model and service-area definition, which should be confirmed before Customer-module *implementation* (not before Technician *design*). Resolving those two lifts this to ~9.5/10.

*Next step on approval: Technician Module Design.*
