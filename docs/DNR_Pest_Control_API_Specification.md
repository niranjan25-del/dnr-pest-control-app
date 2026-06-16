# DNR Pest Control — REST API Specification (Step 4)

**Product:** DNR Pest Control Platform
**Builds on:** Product Discovery (1) + System Architecture (2) + Database Design (3)
**Document type:** REST API Specification (contract)
**Version:** Draft 1.0
**Scope note:** API contract only — endpoints, parameters, request/response shapes, roles. **No backend implementation code.** JSON examples are illustrative contract payloads.

**Base URL:** `https://api.dnrpestcontrol.com`
**All endpoints prefixed with:** `/api/v1`
**Roles referenced:** `Customer`, `Technician`, `Admin`, `Public` (no auth).

---

# API Standards

## Versioning
- URI versioning: `/api/v1/...`. Breaking changes increment the major version (`/api/v2`).
- Non-breaking additions (new fields, new endpoints) ship within the current version.
- Deprecated endpoints return a `Deprecation` header and `Sunset` date.

## Authentication
- **Bearer JWT.** Header: `Authorization: Bearer <access_token>`.
- Access tokens are short-lived; refresh tokens rotate via `/auth/refresh`.
- Tokens carry `sub` (user id), `role`, and minimal claims; permissions are resolved server-side.

## Authorization
- **RBAC** enforced server-side on every request based on `role` and the `role_permissions` map.
- Ownership checks apply on top of role (e.g., a Customer may only read their own bookings; a Technician only their assigned jobs).
- Authorization failures return `403`; missing/invalid auth returns `401`.

## Error Handling
Consistent error envelope on all non-2xx responses:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary.",
    "details": [
      { "field": "email", "issue": "must be a valid email" }
    ],
    "request_id": "req_8f3a..."
  }
}
```
**Standard status codes used across the API:**

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad request / validation error |
| 401 | Unauthenticated |
| 403 | Forbidden (role/ownership) |
| 404 | Not found |
| 409 | Conflict (e.g., double booking, duplicate email) |
| 422 | Unprocessable (business rule violation) |
| 429 | Rate limited |
| 500 | Server error |

Unless noted, every endpoint can return `401`, `403`, `429`, and `500`; endpoint sections list the **notable** additional errors.

## Validation
- All inputs validated server-side; types, ranges, enums, and required fields enforced.
- Money as decimal strings/numbers (never floats client-side); dates as ISO-8601 (`TIMESTAMPTZ`).
- Pagination: `?page=`, `?limit=` (default 20, max 100); list responses include `meta` `{ page, limit, total }`.
- Filtering/sorting via documented query params; unknown params rejected with `400`.
- Idempotency: mutating payment/booking creation accepts an `Idempotency-Key` header.

---

# Authentication APIs

### POST `/auth/register`
- **Description:** Customer self-registration. (Technicians/Admins are created by Admin, not here.)
- **Required role:** Public
- **Request body:**
```json
{ "full_name": "Jane Doe", "email": "jane@example.com", "phone": "+15551234567", "password": "••••••••", "customer_type": "residential" }
```
- **Success (201):** `{ "user": { "id": "...", "email": "...", "role": "Customer" }, "access_token": "...", "refresh_token": "..." }`
- **Errors:** 400 validation, 409 email already registered.

### POST `/auth/login`
- **Description:** Authenticate and receive tokens.
- **Required role:** Public
- **Request body:** `{ "email": "jane@example.com", "password": "••••••••" }`
- **Success (200):** `{ "access_token": "...", "refresh_token": "...", "user": { "id": "...", "role": "Customer" } }`
- **Errors:** 400, 401 invalid credentials, 403 suspended account.

### POST `/auth/refresh`
- **Description:** Exchange a valid refresh token for a new access token (rotates refresh token).
- **Required role:** Public (valid refresh token)
- **Request body:** `{ "refresh_token": "..." }`
- **Success (200):** `{ "access_token": "...", "refresh_token": "..." }`
- **Errors:** 401 expired/invalid refresh token.

### POST `/auth/logout`
- **Description:** Revoke the current refresh token.
- **Required role:** Any authenticated
- **Request body:** `{ "refresh_token": "..." }`
- **Success (204):** no content.

### POST `/auth/forgot-password`
- **Description:** Trigger a password-reset email.
- **Required role:** Public
- **Request body:** `{ "email": "jane@example.com" }`
- **Success (200):** generic success (no account enumeration).

### POST `/auth/reset-password`
- **Description:** Set a new password using a reset token.
- **Required role:** Public (valid reset token)
- **Request body:** `{ "token": "...", "new_password": "••••••••" }`
- **Success (200):** success message. **Errors:** 400, 401 invalid/expired token.

### GET `/auth/me`
- **Description:** Current authenticated user + role + permissions.
- **Required role:** Any authenticated
- **Success (200):** `{ "id": "...", "full_name": "...", "role": "Customer", "permissions": ["booking.create", ...] }`

---

# Customer APIs

### GET `/customers/me`
- **Description:** Get the current customer's profile.
- **Required role:** Customer
- **Success (200):** customer profile object.

### PATCH `/customers/me`
- **Description:** Update own profile (name, phone, company_name).
- **Required role:** Customer
- **Request body (partial):** `{ "full_name": "...", "phone": "...", "company_name": "..." }`
- **Success (200):** updated profile. **Errors:** 400.

### GET `/customers/me/addresses`
- **Description:** List the customer's saved addresses.
- **Required role:** Customer
- **Success (200):** `{ "data": [ { "id": "...", "label": "Home", "line1": "...", "city": "..." } ] }`

### POST `/customers/me/addresses`
- **Description:** Add a service address (incl. access notes/gate code, stored encrypted).
- **Required role:** Customer
- **Request body:**
```json
{ "label": "Home", "line1": "12 Oak St", "city": "Chennai", "state": "TN", "postal_code": "600001", "country": "IN", "gate_code": "4821", "access_notes": "Dog in yard" }
```
- **Success (201):** created address. **Errors:** 400.

### PATCH `/customers/me/addresses/{addressId}`
- **Description:** Update an address.
- **Required role:** Customer (owner)
- **Success (200):** updated address. **Errors:** 403 not owner, 404.

### DELETE `/customers/me/addresses/{addressId}`
- **Description:** Soft-delete an address.
- **Required role:** Customer (owner)
- **Success (204).** **Errors:** 404, 409 if referenced by active booking.

### GET `/customers`
- **Description:** List/search customers.
- **Required role:** Admin
- **Query params:** `page, limit, search, customer_type, status`
- **Success (200):** paginated customer list.

### GET `/customers/{customerId}`
- **Description:** Full customer record (profile, addresses, history summary).
- **Required role:** Admin
- **Success (200):** customer detail. **Errors:** 404.

---

# Technician APIs

### GET `/technicians/me`
- **Description:** Current technician's profile (license, skills, availability).
- **Required role:** Technician
- **Success (200):** technician profile.

### PATCH `/technicians/me/availability`
- **Description:** Toggle availability / update schedule preference.
- **Required role:** Technician
- **Request body:** `{ "is_available": true }`
- **Success (200):** updated profile.

### GET `/technicians/me/jobs`
- **Description:** The technician's assigned bookings (their job list).
- **Required role:** Technician
- **Query params:** `date, status` (e.g., today's jobs)
- **Success (200):** list of assigned bookings with address + access details.

### GET `/technicians`
- **Description:** List technicians.
- **Required role:** Admin
- **Query params:** `page, limit, is_available, skill`
- **Success (200):** paginated technician list.

### POST `/technicians`
- **Description:** Create a technician account (provisioned by Admin).
- **Required role:** Admin
- **Request body:**
```json
{ "full_name": "Sam Tech", "email": "sam@dnr.com", "phone": "+15550001111", "license_number": "LIC-2231", "license_expiry": "2027-06-30", "skills": ["rodents","termites"] }
```
- **Success (201):** created technician (credentials sent to user; account creation handled per security rules). **Errors:** 400, 409 email exists.

### PATCH `/technicians/{technicianId}`
- **Description:** Update technician profile / licensing / status.
- **Required role:** Admin
- **Success (200):** updated technician. **Errors:** 404.

---

# Admin APIs

### GET `/admin/dashboard`
- **Description:** Operational summary — today's jobs, statuses, exceptions, revenue snapshot.
- **Required role:** Admin
- **Query params:** `date`
- **Success (200):**
```json
{ "jobs_today": 24, "unassigned": 3, "in_progress": 8, "completed": 11, "overdue_invoices": 5, "revenue_today": "1840.00" }
```

### GET `/admin/users`
- **Description:** List all users across roles.
- **Required role:** Admin
- **Query params:** `role, status, search, page, limit`
- **Success (200):** paginated user list.

### PATCH `/admin/users/{userId}/status`
- **Description:** Activate/suspend a user.
- **Required role:** Admin
- **Request body:** `{ "status": "suspended" }`
- **Success (200):** updated user. **Errors:** 404, 422 cannot suspend self.

### GET `/admin/reports/{reportType}`
- **Description:** Operational/financial/compliance reports (e.g., `revenue`, `utilization`, `retention`, `chemical_usage`).
- **Required role:** Admin
- **Query params:** `from, to, format` (`json|csv|pdf`)
- **Success (200):** report data or file reference. **Errors:** 400 invalid range.

---

# Booking APIs

### POST `/bookings`
- **Description:** Create a one-time booking (Customer self-book, or Admin on behalf).
- **Required role:** Customer, Admin
- **Headers:** `Idempotency-Key`
- **Request body:**
```json
{ "service_id": "...", "address_id": "...", "scheduled_window_start": "2026-06-10T09:00:00Z", "scheduled_window_end": "2026-06-10T12:00:00Z", "coupon_code": "SPRING10" }
```
- **Success (201):** created booking with `status: "pending"` and computed price/discount.
- **Errors:** 400, 409 overlapping booking on address, 422 invalid coupon / outside lead-time policy.

### GET `/bookings`
- **Description:** List bookings, scoped by role (Customer: own; Technician: assigned; Admin: all).
- **Required role:** Customer, Technician, Admin
- **Query params:** `status, from, to, page, limit`
- **Success (200):** paginated bookings.

### GET `/bookings/{bookingId}`
- **Description:** Booking detail incl. status, assignment, service/plan.
- **Required role:** Customer (owner), Technician (assigned), Admin
- **Success (200):** booking detail. **Errors:** 403, 404.

### PATCH `/bookings/{bookingId}`
- **Description:** Reschedule a booking within policy.
- **Required role:** Customer (owner), Admin
- **Request body:** `{ "scheduled_window_start": "...", "scheduled_window_end": "..." }`
- **Success (200):** updated booking. **Errors:** 409 conflict, 422 outside reschedule cutoff.

### POST `/bookings/{bookingId}/cancel`
- **Description:** Cancel a booking (cancellation fee rules applied server-side).
- **Required role:** Customer (owner), Admin
- **Request body:** `{ "reason": "..." }`
- **Success (200):** booking `status: "cancelled"` + any fee. **Errors:** 422 non-cancellable state.

### POST `/bookings/{bookingId}/assign`
- **Description:** Assign or reassign a technician (manual dispatch, MVP).
- **Required role:** Admin
- **Request body:** `{ "technician_id": "..." }`
- **Success (200):** assignment record. **Errors:** 409 technician unavailable/double-booked, 422 not licensed for service.

### POST `/bookings/{bookingId}/status`
- **Description:** Update job status (en_route → arrived → in_progress → completed / follow_up).
- **Required role:** Technician (assigned), Admin
- **Request body:** `{ "status": "en_route", "note": "..." }`
- **Success (200):** updated booking; writes `booking_status_history`. **Errors:** 422 illegal transition.

### GET `/bookings/{bookingId}/status-history`
- **Description:** Full status timeline.
- **Required role:** Customer (owner), Technician (assigned), Admin
- **Success (200):** ordered status history.

### POST `/bookings/{bookingId}/report`
- **Description:** Submit the service report (treatment, pests, chemicals, signature). Supports offline-synced payloads.
- **Required role:** Technician (assigned)
- **Request body:**
```json
{
  "pests_found": ["ants"], "areas_treated": ["kitchen","perimeter"],
  "summary": "...", "recommendations": "...",
  "chemical_applications": [
    { "product_name": "ProductX", "epa_registration_number": "1234-56", "target_pest": "ants", "quantity_used": 2.5, "unit": "L", "application_method": "spray", "applied_at": "2026-06-10T10:15:00Z" }
  ],
  "signature_file_id": "...", "photo_file_ids": ["...","..."]
}
```
- **Success (201):** created service report. **Errors:** 400, 422 missing required compliance fields.

---

# Service APIs

### GET `/services`
- **Description:** List active services (catalog).
- **Required role:** Public/Customer, Admin
- **Query params:** `category, search, page, limit`
- **Success (200):** service list.

### GET `/services/{serviceId}`
- **Description:** Service detail.
- **Required role:** Public/Customer, Admin
- **Success (200):** service object. **Errors:** 404.

### POST `/services` · PATCH `/services/{id}` · DELETE `/services/{id}`
- **Description:** Create / update / soft-delete a service.
- **Required role:** Admin
- **Request body (create):** `{ "name": "...", "category": "...", "base_price": "120.00", "estimated_duration_min": 60, "target_pests": ["roaches"] }`
- **Success:** 201 / 200 / 204. **Errors:** 400, 404, 409 in-use on delete.

### GET `/packages`
- **Description:** List recurring service packages.
- **Required role:** Public/Customer, Admin
- **Success (200):** package list with included services.

### POST `/packages` · PATCH `/packages/{id}`
- **Description:** Create/update a package (Admin), incl. linked services.
- **Required role:** Admin
- **Request body:** `{ "name": "...", "price": "49.00", "billing_cycle": "monthly", "visit_frequency": "quarterly", "service_ids": ["...","..."] }`
- **Success:** 201 / 200.

### POST `/subscriptions`
- **Description:** Enroll a customer into a recurring package.
- **Required role:** Customer, Admin
- **Request body:** `{ "package_id": "...", "address_id": "...", "start_date": "2026-06-15" }`
- **Success (201):** subscription with `next_service_date`/`next_billing_date`. **Errors:** 422 payment method required.

### GET `/subscriptions` · GET `/subscriptions/{id}`
- **Description:** List/detail subscriptions (Customer: own; Admin: all).
- **Required role:** Customer, Admin
- **Success (200):** subscription(s).

### POST `/subscriptions/{id}/cancel` · POST `/subscriptions/{id}/pause`
- **Description:** Cancel/pause a subscription (contract notice rules applied).
- **Required role:** Customer (owner), Admin
- **Success (200):** updated subscription. **Errors:** 422 within contract notice period.

### POST `/coupons/validate`
- **Description:** Validate a coupon code against a prospective order.
- **Required role:** Customer, Admin
- **Request body:** `{ "code": "SPRING10", "amount": "120.00" }`
- **Success (200):** `{ "valid": true, "discount_amount": "12.00" }`. **Errors:** 422 expired/limit reached/min not met.

### GET `/coupons` · POST `/coupons` · PATCH `/coupons/{id}`
- **Description:** Manage coupons.
- **Required role:** Admin
- **Request body (create):** `{ "code": "SPRING10", "discount_type": "percentage", "value": 10, "valid_until": "2026-09-01T00:00:00Z", "max_redemptions": 500 }`
- **Success:** 200 / 201. **Errors:** 409 duplicate code.

---

# Payment APIs

### POST `/payments/intent`
- **Description:** Create a payment intent for an invoice via the provider (returns client secret/token; no card data touches the API).
- **Required role:** Customer (owner), Admin
- **Headers:** `Idempotency-Key`
- **Request body:** `{ "invoice_id": "..." }`
- **Success (201):** `{ "payment_id": "...", "client_secret": "...", "amount": "120.00", "currency": "INR" }`
- **Errors:** 404 invoice, 409 already paid.

### POST `/payments/{paymentId}/confirm`
- **Description:** Confirm/record a completed payment (post provider confirmation).
- **Required role:** Customer (owner), Admin
- **Success (200):** payment `status: "succeeded"`, invoice updated. **Errors:** 422 payment failed.

### GET `/payments/{paymentId}`
- **Description:** Payment detail.
- **Required role:** Customer (owner), Admin
- **Success (200):** payment object. **Errors:** 404.

### POST `/payments/{paymentId}/refund`
- **Description:** Issue a refund (audited).
- **Required role:** Admin
- **Request body:** `{ "amount": "120.00", "reason": "..." }`
- **Success (200):** refund result. **Errors:** 422 amount exceeds captured.

### POST `/payments/webhook`
- **Description:** Provider webhook for async payment events (signature-verified). Not user-facing.
- **Required role:** Public (verified provider signature)
- **Success (200):** acknowledged. **Errors:** 400 invalid signature.

---

# Invoice APIs

### GET `/invoices`
- **Description:** List invoices (Customer: own; Admin: all).
- **Required role:** Customer, Admin
- **Query params:** `status, from, to, page, limit`
- **Success (200):** paginated invoices.

### GET `/invoices/{invoiceId}`
- **Description:** Invoice detail with line items and payments.
- **Required role:** Customer (owner), Admin
- **Success (200):** invoice object. **Errors:** 403, 404.

### GET `/invoices/{invoiceId}/pdf`
- **Description:** Download invoice as PDF (server-generated).
- **Required role:** Customer (owner), Admin
- **Success (200):** PDF file / signed URL. **Errors:** 404.

---

# Review APIs

### POST `/reviews`
- **Description:** Submit a rating/review for a completed booking.
- **Required role:** Customer (owner of completed booking)
- **Request body:** `{ "booking_id": "...", "rating": 5, "comment": "Great service" }`
- **Success (201):** review (`is_published: false` pending moderation). **Errors:** 409 already reviewed, 422 booking not completed.

### GET `/reviews`
- **Description:** List published reviews (optionally by technician).
- **Required role:** Public/Customer, Admin
- **Query params:** `technician_id, min_rating, page, limit`
- **Success (200):** review list.

### GET `/reviews/{reviewId}`
- **Description:** Review detail.
- **Required role:** Customer (owner), Admin
- **Success (200):** review. **Errors:** 404.

### PATCH `/reviews/{reviewId}/publish`
- **Description:** Moderate/publish or hide a review.
- **Required role:** Admin
- **Request body:** `{ "is_published": true }`
- **Success (200):** updated review.

---

# Notification APIs

### GET `/notifications`
- **Description:** List the current user's notifications.
- **Required role:** Any authenticated
- **Query params:** `unread, page, limit`
- **Success (200):** paginated notifications.

### PATCH `/notifications/{notificationId}/read`
- **Description:** Mark a single notification read.
- **Required role:** Any authenticated (owner)
- **Success (200):** updated notification.

### POST `/notifications/read-all`
- **Description:** Mark all as read.
- **Required role:** Any authenticated
- **Success (204).**

### POST `/notifications/devices`
- **Description:** Register a device push token (FCM) for the current user.
- **Required role:** Any authenticated
- **Request body:** `{ "device_token": "...", "platform": "ios" }`
- **Success (201):** registered. **Errors:** 400.

---

# Chat APIs *(future per PRD; contract defined now)*

### GET `/conversations`
- **Description:** List the user's conversations.
- **Required role:** Customer, Technician, Admin
- **Success (200):** conversation list with last message + unread count.

### POST `/conversations`
- **Description:** Start a conversation (optionally tied to a booking).
- **Required role:** Customer, Admin
- **Request body:** `{ "booking_id": "...", "staff_user_id": "..." }`
- **Success (201):** conversation. **Errors:** 409 conversation exists.

### GET `/conversations/{conversationId}/messages`
- **Description:** Fetch messages (paginated, newest last).
- **Required role:** Participants, Admin
- **Query params:** `before, limit`
- **Success (200):** message page. **Errors:** 403 not a participant.

### POST `/conversations/{conversationId}/messages`
- **Description:** Send a message (optional attachment via `uploaded_files`).
- **Required role:** Participants
- **Request body:** `{ "body": "On my way", "attachment_file_id": null }`
- **Success (201):** created message. **Errors:** 403, 422 empty message.

---

# GPS Tracking APIs *(future live tracking; contract defined now)*

### POST `/technicians/me/location`
- **Description:** Technician device pushes its current location during an active job (batched allowed).
- **Required role:** Technician
- **Request body:** `{ "booking_id": "...", "latitude": 13.0827, "longitude": 80.2707, "recorded_at": "2026-06-10T09:35:00Z" }`
- **Success (202):** accepted (write-optimized). **Errors:** 400.

### GET `/bookings/{bookingId}/technician-location`
- **Description:** Latest technician location for an active booking (customer "tech en route" view).
- **Required role:** Customer (owner), Admin
- **Success (200):** `{ "latitude": 13.08, "longitude": 80.27, "recorded_at": "...", "status": "en_route" }`
- **Errors:** 404, 422 tracking only available for en_route/in_progress.

---

# File Upload (supporting — required by reports & chat)

### POST `/files`
- **Description:** Upload a file (photo, signature); returns metadata + id for linking. Binary goes to object storage; large files may use a pre-signed URL flow.
- **Required role:** Technician, Customer, Admin
- **Request:** multipart/form-data (`file`, `related_entity_type`, `related_entity_id`)
- **Success (201):** `{ "id": "...", "file_type": "image", "storage_key": "..." }`. **Errors:** 400 unsupported type, 413 too large.

---

# API Review

The specification covers every requested group — Authentication, Customer, Technician, Admin, Booking, Service, Payment, Invoice, Review, Notification, Chat, and GPS Tracking — plus the supporting Service Report and File Upload endpoints the workflows require. It is RESTful and resource-oriented, consistently versioned, and uses uniform auth, RBAC, pagination, validation, and error envelopes. Every endpoint maps directly to entities and relationships from the Step 3 database design, and the role on each endpoint traces back to the PRD's role definitions. Booking, cancellation, assignment, and payment business rules from Step 3 are enforced server-side rather than left to clients. Future-scoped groups (Chat, GPS) are specified now so the contract is stable, but can be deferred in implementation per the MVP boundary.

# Security Recommendations

1. **No card data in the API.** Payment endpoints exchange only provider tokens/intents; PAN/CVV never reach DNR servers (PCI scope minimized).
2. **Enforce RBAC + ownership on every request** — role alone is insufficient; verify the caller owns/was-assigned the resource (e.g., Technician location pushes, Customer invoices).
3. **Rate limit** auth and payment endpoints aggressively; apply global limits to deter abuse.
4. **Idempotency keys** required on booking and payment creation to prevent duplicates on retry/offline sync.
5. **Webhook signature verification** for payment provider callbacks; reject unsigned/replayed events.
6. **Validate and verify offline-synced report payloads** server-side, including required compliance fields, before persisting to the append-only compliance tables.
7. **Avoid account enumeration** in auth flows (generic responses for forgot-password/login).
8. **Sign/expire file URLs**; never expose raw object-storage keys publicly.
9. **Audit sensitive endpoints** (refunds, status/permission changes, assignment) into `audit_logs`.
10. **TLS everywhere**, short-lived access tokens, rotating refresh tokens.

# Preparation for Backend Development

Before implementation begins, confirm/produce the following:
1. **Resolve the four still-open inputs** carried from earlier steps: exact compliance fields (drives `/bookings/{id}/report`), retention rules, payment provider (drives payment endpoints), and which future groups (Chat/GPS) to build for MVP vs stub.
2. **Generate an OpenAPI (Swagger) document** from this contract as the single source of truth for client and server teams.
3. **Finalize the physical DDL** (Step 3 → SQL) so endpoints have a concrete data layer.
4. **Define the auth provider integration** (token issuance/refresh, password reset flow) per Step 2.
5. **Set up environments** (dev/staging/prod), secrets/KMS, and the payment provider sandbox.
6. **Agree on API conventions doc** (pagination defaults, error codes catalog, idempotency rules) for all engineers.

Once the four open inputs are confirmed and the OpenAPI spec is generated, the backend is ready to enter development.

*Next step on approval: OpenAPI/Swagger generation and backend implementation planning.*
