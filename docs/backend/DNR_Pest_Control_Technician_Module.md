# DNR Pest Control — Technician Module Design (Step 10)

**Product:** DNR Pest Control app
**Builds on:** All prior approved steps (PRD · Architecture · DB · API · Backend · Auth · Flutter Arch · UI/UX · Customer Module)
**Module:** Technician (field staff)
**Document type:** Functional Module Design
**Version:** Draft 1.0
**Scope note:** Functional design only — flows, components, rules, API mapping, offline behavior, edge cases. **No code.** This module contains the two highest-risk areas of the project: **offline-first capture** (Step 2) and **chemical/compliance documentation** (Steps 1–3).

> Status-model note (important reconciliation): the eight technician statuses requested here are **finer-grained than the booking status enum** in Step 3 (`pending, confirmed, en_route, in_progress, completed, cancelled, no_show, follow_up`). Two of them — **Accepted** and **Waiting** — do not yet exist. This module **recommends extending the model**: keep the customer-facing booking status as-is, and add technician/assignment-level statuses (`accepted`, `arrived`, `waiting`) mapped onto it. Confirmation needed (flagged in Review).

> MVP scope note: per the PRD, **manual dispatch** is MVP and **auto-assignment + route optimization + live GPS** are post-MVP. This document designs the full picture and labels what is **future**.

---

# Technician Module Overview

### Business objectives
- More completed jobs per technician per day via efficient scheduling and low field friction.
- **Defensible compliance records** for every chemical application (regulatory core).
- Reliable proof of service (photos, signature) reducing disputes.
- Real-time operational visibility for Admin.

### Technician objectives
- See the day's jobs clearly, with everything needed to perform them.
- Navigate quickly; spend time on work, not paperwork.
- Capture treatment, chemicals, photos, and sign-off fast — **even with no signal**.
- Know about new/changed jobs immediately.

### Operational benefits
- Less paper, fewer errors, faster billing (completion → invoice).
- Cleaner data for compliance, payroll/utilization, and customer transparency.
- Higher field adoption because the tool is fast and offline-safe.

---

# Technician Dashboard

Top bar (date, availability toggle, sync/offline status) → body → bottom nav (Jobs · Calendar · Notifications · Account).

| Widget | Purpose | Data source | User actions |
|---|---|---|---|
| **Daily schedule** | Today's jobs at a glance, in route order | `GET /technicians/me/jobs?date=today` | Open job, refresh |
| **Current job** | The active/next job with quick start | derived from today's jobs + status | Navigate, update status, start report |
| **Upcoming jobs** | Rest of today / next days | `GET /technicians/me/jobs` | Open, preview |
| **Completed jobs summary** | Today's completed count + remaining | computed from job statuses | View completed |
| **Performance metrics** | Motivational snapshot (jobs done, on-time %, rating) | `GET /admin/reports`-style technician metrics (read-only) | View detail |
| **Notifications** | New assignments / changes / urgent | `GET /notifications?unread=true` | Open feed, deep-link |
| **Sync/offline banner** | Connectivity + pending-sync state | local sync engine | Tap → sync detail / manual sync |

**Loading/empty:** skeletons; "No jobs scheduled today" empty state. The dashboard must render from **local cache** when offline.

---

# Technician Profile

- **Personal details:** name, photo, contact, employee code — `GET /technicians/me`. Mostly read-only (Admin-managed).
- **Certifications:** license number (🔒), license expiry, certifications/skills; expiry warning badge when approaching. (Edited by Admin.)
- **Assigned service areas:** territories the tech covers (read-only; drives assignment).
- **Availability settings:** `is_available` toggle + working hours/preferences — `PATCH /technicians/me/availability`.
- **Profile editing:** limited self-edit (contact, availability); licensing/skills/areas are Admin-controlled and audited.

---

# Job Assignment Workflow

### Automatic assignment *(future)*
- System suggests/assigns by availability + service area + skill/license match + (future) route proximity. Post-MVP.

### Manual assignment *(MVP)*
- Admin assigns via `POST /bookings/{id}/assign` (availability + license checks; `409`/`422` guards). Technician receives the job in their list.

### Assignment notification
- Push (FCM) on new/changed assignment → deep-link to Job Details. SMS for urgent same-day if configured.

### Acceptance workflow *(recommended; confirm for MVP)*
- Optional **accept/decline** step: technician acknowledges the job (`accepted` status). Decline routes back to Admin for reassignment with reason.
- If acceptance is **not** used in MVP, jobs are simply assigned and worked; the `accepted` status is skipped.

### Reassignment workflow
- Admin reassigns (`POST /bookings/{id}/assign` again) → old assignment marked `reassigned`, both technicians notified, customer notified if timing changes. Technician-initiated handback (decline/unable) triggers the same Admin flow.

---

# Daily Schedule Management

- **Calendar view:** week/day grid with job blocks (time window, customer, status). Tap → Job Details.
- **List view:** ordered job cards (default day view), each with window, address, status badge.
- **Route order:** MVP = manual/sequential order by window; **future** = optimized order with travel estimates.
- **Time slots:** jobs shown by **window** (e.g., 9–12), consistent with the customer booking model.
- **Availability management:** toggle availability and set working hours; affects assignability (Admin sees it).

All schedule data is **cached locally** for offline viewing.

---

# Job Details Screen

Everything needed to perform the job (from `GET /bookings/{id}`, technician scope):
- **Customer details:** name, customer type; **contact information** (call/message actions).
- **Service address:** full address + map; **access notes & gate code** (🔒, shown to assigned tech only).
- **Service package:** service/plan, target pests, estimated duration, price (as relevant).
- **Special instructions:** customer notes (pets, severity, access) + any customer-uploaded problem photos.
- **Service history:** prior visits/reports at this property (context for the tech).
- **Actions:** Navigate · Update status · Start service report.

Must be **fully available offline** once the day's jobs are cached.

---

# Navigation & GPS Workflow

- **Open in Google Maps / Apple Maps:** hand off the destination to the device's map app (platform-appropriate default + choice).
- **In-app map:** show address pin + route preview (Google Maps SDK).
- **Route optimization:** *future*; MVP uses window order.
- **Arrival tracking:** "Mark Arrived" sets `arrived`; optionally captures a location stamp.
- **GPS verification:** *optional/future* — compare arrival location to the service address within a tolerance to validate on-site presence; **advisory, not blocking** (signal/geocoding can be imperfect). During active jobs, location pings via `POST /technicians/me/location` (future live tracking; batched, offline-queued).

> Privacy: location captured only during active jobs; respect OS permissions with clear rationale.

---

# Job Status Workflow

Recommended status set (extends Step 3 — see top note). Each transition writes `booking_status_history` and triggers notifications asynchronously.

| Status | Trigger | Business rules | Customer notification | Admin notification |
|---|---|---|---|---|
| **Assigned** | Admin assigns technician | Tech must be available + license/area match | (optional "technician assigned") | Assignment logged |
| **Accepted** *(optional MVP)* | Tech accepts | Acknowledges responsibility; decline → reassign | — | Acceptance/decline logged |
| **En Route** | Tech starts travel | Only from accepted/assigned; one active job en route | "Your technician is on the way" | Status visible on board |
| **Arrived** | Tech taps Arrived | Optional GPS check (advisory) | "Technician has arrived" | Arrival time logged |
| **In Progress** | Tech starts service | From arrived; opens report capture | (optional) | Live status |
| **Waiting** *(new)* | Blocked on site (no access, customer not ready) | Reason required; pauses timer; escalation if prolonged | (optional, e.g., "technician waiting for access") | Alert to Admin/dispatch |
| **Completed** | Report submitted + signed | Requires valid report (+ signature per policy) | "Service completed" + report available | Triggers invoice |
| **Cancelled** | Tech/Admin cancels on site | Reason required; may convert to no_show | "Visit cancelled" + reason | Logged; reschedule flow |

Illegal transitions rejected (`422`). Status updates queue offline and sync (idempotent).

---

# Before Service Inspection

- **Photo capture:** before photos (camera), grid view, optional captions.
- **Photo validation:** type/size limits; min/recommended count (policy); blurry/empty guard (basic). Photos stored locally first.
- **Notes:** observations field.
- **Pest assessment:** select pests found (multi-select chips), severity, affected areas — feeds the report.

All offline-capable; media queued for upload.

---

# Treatment Execution

The **compliance core** — captured even offline.
- **Products used / Chemical tracking:** repeatable rows per product → product name, **EPA registration #**, target pest, **quantity + unit**, concentration, application method, application area, applied-at timestamp. Maps to `chemical_applications` (append-only, audited).
- **Treatment notes:** free text.
- **Safety checklist:** confirmable checklist (PPE used, area secured, pets/children precautions, re-entry interval communicated) — *fields to be confirmed with compliance*.

> **The exact chemical/safety fields remain unconfirmed (now ten steps running).** The form is designed as flexible repeatable rows to absorb the final regulated field set; this is the single most important open input.

---

# After Service Documentation

- **After photos:** post-treatment evidence (same capture/validation as before photos).
- **Results summary:** what was done / outcome.
- **Recommendations:** advice for the customer (e.g., seal entry points).
- **Follow-up suggestions:** flag `follow_up` need + suggested timing → informs Admin/booking.

---

# Customer Signature Capture

- **Workflow:** present summary → customer signs on canvas → enter signer name → confirm. Tech may countersign/attest.
- **Validation rules:** non-empty signature; name required; tie to the specific service report; timestamp (`signed_at`). Policy: whether signature is **mandatory** to complete (recommend yes for residential, configurable for commercial/contract).
- **Storage requirements:** stored as a file (`uploaded_files`) via S3 presigned upload; linked to `service_report.customer_signature_file_id`; captured/queued offline, uploaded on sync; immutable once submitted.

---

# Service Report Workflow

Assembles into one submission (`POST /bookings/{id}/report`):
- **Service summary** (pests found, areas, notes)
- **Chemicals used** (the `chemical_applications` rows)
- **Before photos** + **After photos** (file ids)
- **Technician notes** + recommendations + follow-up flag
- **Customer signature** (file id + signed_at)

Submission rules: required compliance fields validated server-side; report is append-only; on success → booking `completed` → invoice generated + customer notified. **Offline:** the entire report (data + media + signature) is captured locally and **queued**, then synced with an `Idempotency-Key` so re-sync never duplicates.

---

# Communication Features

- **Customer chat** *(future)*: in-app messaging tied to the job (`/conversations`).
- **Admin/office chat** *(future)*: dispatch coordination thread.
- **Call customer:** tap-to-call the customer's number (privacy: consider masking/proxy in future).
- **Call office:** quick dial to dispatch for issues (access, escalation).

MVP may ship calling + push only, with chat deferred per PRD.

---

# Notifications

- **New assignments:** push + in-app, deep-link to Job Details.
- **Schedule changes:** reschedule/reassignment/cancellation alerts.
- **Customer messages:** *(future)* chat push.
- **Urgent alerts:** same-day changes, access issues, dispatch pings (high-priority channel; SMS fallback if configured).

---

# Offline Mode Requirements

**The defining requirement of this module** (Step 2). The technician app must be fully usable with no connectivity.

- **Offline job access:** today's (and near-term) jobs, with full detail and access info, cached locally (Drift/SQLite per Step 7).
- **Offline report creation:** complete the entire report — status changes, pests, chemicals, notes, recommendations, safety checklist — stored locally.
- **Offline photo & signature storage:** media and signature captured and persisted on-device; thumbnails shown; marked "pending upload".
- **Sync workflow:**
  1. All field changes written to a local queue with client timestamps + idempotency keys.
  2. On reconnect, the sync engine uploads in order: status changes → report data → media (presigned S3) → signature.
  3. **Conflict rules (Step 2):** server-owned data (assignment, schedule) → server wins, client refreshes; tech-owned data (report, chemicals, photos, signature) → append-only, low conflict; true conflicts flagged for Admin.
  4. Per-item sync status surfaced (pending / syncing / synced / failed-retry); auto-retry with backoff; manual "Sync now".
  5. Idempotency ensures re-sync never duplicates bookings/reports/charges.
- **Guardrails:** actions that strictly need connectivity (e.g., live tracking) are clearly disabled offline; everything essential to performing and documenting a job is not.

---

# Technician Performance Tracking

Read-only metrics (motivational for tech; managerial for Admin):
| Metric | Source/derivation |
|---|---|
| Jobs completed | count of `completed` bookings |
| On-time arrival % | arrival time vs window |
| Customer ratings | avg `reviews.rating` for the tech |
| Revenue generated | sum of invoices for completed jobs |
| Average completion time | arrived→completed duration |

Surfaced via technician-scoped reporting; full analytics in Admin. No punitive framing in the tech UI.

---

# Security Requirements

- **GPS validation:** advisory on-site check; never the sole basis for completion; location only during active jobs; OS-permission respectful.
- **Device security:** tokens in secure storage (Keychain/Keystore); biometric/PIN app-lock recommended for shared/field devices; remote session revocation by Admin.
- **Session handling:** short-lived access + rotating refresh (Step 6); forced logout on refresh failure; role/permission revocation revokes sessions.
- **Data protection:** **access notes/gate codes 🔒** visible only for the tech's assigned jobs and purged from cache after job completion/retention window; offline data encrypted at rest on device; no sensitive data in logs; private signed URLs for media.

---

# Edge Cases

| Case | Behavior |
|---|---|
| **Customer unavailable** | Set `waiting` (reason); attempt contact (call/message); after policy wait → `no_show`/reschedule; notify Admin |
| **Job cancellation** (on site) | Reason required; capture any partial notes/photos; status `cancelled`; Admin + customer notified |
| **GPS failure** | Proceed without GPS; arrival/location optional; never block job completion on GPS |
| **No internet connection** | Full offline operation; queue everything; sync later (idempotent); clear offline UX |
| **Photo upload failure** | Keep local copy; mark failed; auto-retry/backoff; manual retry; never lose the photo |
| **Signature failure** | Re-capture; if device issue, allow note + retry; report can't complete without required signature (policy) — save as draft locally |
| **Duplicate submit / re-sync** | Idempotency-Key prevents duplicate reports/bookings/charges |
| **Session expiry mid-job** | Continue offline capture; silent refresh on reconnect; preserve draft; re-login without data loss |
| **Wrong/locked access** | `waiting` + escalate to dispatch; reschedule path |

---

# Analytics Events

| Event | When | Key properties |
|---|---|---|
| `job_accepted` | Tech accepts (if used) | booking_id, technician_id |
| `arrived_on_site` | Status → arrived | booking_id, on_time (bool), delay_min |
| `service_started` | Status → in_progress | booking_id |
| `service_completed` | Status → completed | booking_id, duration_min |
| `report_submitted` | Report synced to server | booking_id, chemical_count, photo_count, offline_captured (bool) |
| `job_status_changed` | Any transition | booking_id, from, to |
| `sync_completed` | Offline queue flushed | items_synced, failures |

(No PII; ids only; respect consent.)

---

# Technician Module Review

### 1. Risks
| Risk | Severity | Note |
|---|---|---|
| **Offline sync correctness** (reports, photos, signatures, conflicts) | **High** | The defining technical risk; needs dedicated build + test plan and poor-connectivity field testing |
| **Compliance/chemical + safety fields unconfirmed** (10 steps running) | **High** | Shapes Treatment Execution + report submission/validation; flexible rows mitigate but can't finalize |
| **Status model extension** (`accepted`, `arrived`, `waiting`) | Medium–High | Requires DB enum + API + state-machine update; confirm before build |
| **Report-capture UX vs field speed** | High | Determines adoption; must be fast, large-target, minimal typing; usability-test with real techs |
| **GPS reliability/expectations** | Medium | Keep advisory; never block completion |
| **Acceptance workflow scope** for MVP | Medium | Confirm whether `accepted`/decline is in MVP |
| **Device security on shared field devices** | Medium | App-lock + cache purge + remote revocation |

### 2. Recommendations
1. **Treat offline sync as its own workstream** with explicit conflict rules, idempotency, and a connectivity test matrix — do not fold it into general feature work.
2. **Confirm and lock the compliance + safety field set** before building Treatment Execution; until then build flexible repeatable rows (as specified).
3. **Confirm the status-model extension** (`accepted`, `arrived`, `waiting`) and update DB/API/state machine first.
4. **Design the report flow for speed:** defaults, repeatable rows, large inputs, draft-save, offline-safe.
5. **Keep GPS advisory**; never gate completion on it.
6. **Decide MVP scope** for acceptance workflow, chat, and live tracking; ship calling + push for MVP.
7. **Field-test with actual technicians** early (paper-to-app change management, Step 1 risk).

### 3. Missing requirements (to be supplied)
- **Compliance/chemical + safety-checklist fields** (jurisdiction-specific) — top priority.
- Signature mandatory policy (residential vs commercial) and re-entry-interval communication requirements.
- `waiting`/escalation policy and timeout thresholds; `no_show` policy.
- Acceptance workflow inclusion for MVP (yes/no).
- Min photo requirements per job type.
- On-device cache encryption + retention/purge specifics for 🔒 data.
- Whether GPS on-site verification is desired at all for MVP.

### 4. Readiness score before Admin Module Design
**7.5 / 10 — Ready to proceed to Admin design.**
The Technician Module is fully specified and operationally sound, and Admin design can proceed in parallel. However, two items must be resolved **before technician-module implementation** (not before Admin design): the **compliance/safety field set** and the **status-model extension** — both are structural, not cosmetic. Resolving them, plus committing to the offline-sync workstream, lifts implementation readiness to ~9/10.

*Next step on approval: Admin Module Design.*
