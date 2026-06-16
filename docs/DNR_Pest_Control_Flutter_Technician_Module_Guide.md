## DNR Pest Control — Technician Mobile Module (Step 38)

**Feature:** `features/technician` — production-ready, clean architecture, feature-first, **offline-ready**.
**Builds on:** Foundation (35) · Auth (36) · backend Bookings/Assignment/GPS/Service-Reports/Notifications · API Spec · UI/UX system.
**Stack:** Flutter · Riverpod · GoRouter · Dio · Google Maps · Firebase Messaging · geolocator.
**Scope:** Technician ONLY — no Customer/Admin modules.

> **Reconciliations (flagged honestly):**
> - **Report submission endpoint:** the client uses the API Spec's consolidated **`POST /bookings/{id}/report`** (chemicals + `signature_file_id` + `photo_file_ids` inline), which the spec explicitly marks as accepting **offline-synced payloads** — ideal here. This differs from the backend Service Reports module's granular endpoints (`/service-reports`, `/:id/chemicals`, `/:id/signature`, `/:id/submit`). **Confirm the backend honors `/bookings/{id}/report` as the offline entry point**, or swap `ReportRepository` to the granular calls.
> - **Accept/Decline:** the API Spec has no explicit technician accept endpoint (assignment actions live in the Dispatch module). The client calls `POST /bookings/{id}/accept` / `/decline` — **map these to the assignment-accept/decline route** (one-line change in `TechnicianEndpoints`).
> - **Open-in-Maps** copies the destination coordinates and prompts the user (no `url_launcher` dependency added to stay in scope); swap to `url_launcher` with a `geo:`/Apple-Maps URL for one-tap handoff.

---

## Folder Structure
```
features/technician/
├── shared/
│   ├── models/technician_models.dart     # TechnicianProfile, Job, JobStatus, ChemicalEntry
│   ├── data/                             # technician_repository (profile/jobs/status/accept) · report_repository (files+report+location) · endpoints
│   ├── offline/offline_outbox.dart       # durable persisted action queue (status + report)
│   └── application/                      # providers (DI + reads + connectivity flush) · location_tracking_service (geolocator pings)
├── dashboard/                            # availability, today/upcoming, performance, sync chip
├── jobs/
│   ├── job_screens.dart                  # list (+filters) · details
│   └── job_workflow/                     # workflow controller · report-builder controller · signature pad · workflow screen (11 steps)
├── schedule/                             # day + week views
├── navigation/                           # Google Map + open-in-maps
├── reports/                              # report history
├── notifications/                        # notifications center (shared repo)
├── profile/                              # profile + license + availability + logout
├── technician_shell.dart                 # bottom nav (Today/Jobs/Schedule/Profile)
└── technician_routes.dart                # StatefulShellRoute + pushed full-screen routes
```
Also added to foundation `lib/shared/data/notifications_repository.dart` (role-agnostic notifications, reused here).

## Job Workflow (11 steps)
A guided checklist on one screen (offline-tolerant): **Details → Accept → En route → Arrived → Start service → Before photos → Notes & chemicals → After photos → Signature → Submit report → Complete**. Status transitions go through `JobWorkflowController` (which starts GPS tracking on *En route* and stops it on *Complete*); the report steps build a local draft and submit via `ReportBuilderController`. Steps gate on the current status so the technician can't skip ahead.

## Maps & Navigation
Google Map centered on the job site with the technician's live position (`myLocationEnabled`), plus open-in-maps. During an active job, `LocationTrackingService` streams GPS (high accuracy, 25m distance filter, ≥15s send gap for battery) and pings `POST /technicians/me/location` (write-optimized 202).

## Offline Sync Strategy (explicit requirement)
- **Durable outbox** (`OfflineOutbox`, persisted in SharedPreferences) for the two actions that must survive connectivity loss mid-job: **status transitions** and **report submission**. Controllers try online first; on a network/timeout failure they **enqueue and report optimistic success** so the technician keeps moving.
- A **connectivity listener** (`outboxSyncProvider`, kept alive by the shell) **flushes the queue in FIFO order** when the device is back online, then refreshes job lists. Idempotency-safe replays.
- **Location pings are best-effort** (transient data) — dropped if offline rather than queued, to avoid a stale backlog.
- A dashboard **"N changes waiting to sync"** chip makes pending state visible.

## Customer Signature Capture
A dependency-free `SignaturePad` (CustomPaint + `PictureRecorder`) exports a PNG; the report builder uploads it to `POST /files` (`service_report_signature`) and passes the returned `signature_file_id` into the report.

## State / API / Validation / States
- **Reads:** `FutureProvider` → `AsyncValue` (`technicianProfile`, `jobs`, `todayJobs`, `jobById`). **Actions:** `StateNotifier` controllers with `SubmissionState`.
- **API:** profile/availability/jobs, `POST /bookings/{id}/status`, accept/decline, `POST /files`, `POST /bookings/{id}/report`, `POST /technicians/me/location`, notifications.
- **Validation:** chemical entries require product + numeric quantity; signature requires signer name; status steps gated by current status.
- **Loading/Error/Empty:** shared `AsyncValueView` + `SubmissionState` spinners + snackbars.

## Navigation Flow
4-tab `StatefulShellRoute`; job details → workflow / navigate pushed full-screen. Notifications + report history are top-level pushes.

---

## Setup Instructions
1. Files under `lib/features/technician/` + `lib/shared/data/notifications_repository.dart`. No new packages (geolocator, google_maps_flutter, image_picker, connectivity_plus, intl already in the foundation `pubspec.yaml`).
2. **Wire routes:** in `lib/routes/app_router.dart`, `import '../features/technician/technician_routes.dart';` and replace the placeholder `technicianHome` route with `...technicianRoutes`.
3. **Permissions:** Android `ACCESS_FINE_LOCATION` (+ `ACCESS_BACKGROUND_LOCATION` if tracking should continue backgrounded), camera/photos for `image_picker`; iOS `NSLocationWhenInUseUsageDescription` (+ Always if backgrounded), `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`. Add the Google Maps API key to the native manifests/AppDelegate.
4. Map the accept/decline + report endpoints per the reconciliations above; confirm the `/bookings/{id}/report` offline payload contract.

## Required Packages
From the foundation `pubspec.yaml`: `flutter_riverpod`, `go_router`, `dio`, `google_maps_flutter`, `geolocator`, `image_picker`, `connectivity_plus`, `intl`, `firebase_messaging`. Optional add: `url_launcher` (one-tap open-in-maps).

## Testing Instructions
**Unit (mock repos/outbox):**
- JobWorkflowController: transition success invalidates jobs; **network failure enqueues** to outbox + optimistic success; `enRoute` starts tracking, `completed` stops it.
- ReportBuilderController: uploads photos+signature → submit; **upload/submit network failure enqueues** the report; non-network failure surfaces.
- OfflineOutbox: enqueue persists; flush sends FIFO and **stops on first failure** preserving order; success removes.
- Models: `Job.fromJson` parses address/customer/assignment; `needsAcceptance`/`isActive`/`isToday`.

**Widget:** workflow step gating by status; signature pad export non-null after drawing; chemical add validation; availability toggle optimistic + rollback on failure.

**Integration (backend + airplane-mode):** run a job en route → arrived → start; **toggle airplane mode**, submit report → shows "queued"; re-enable network → outbox flushes and the report/status post; live pings appear on the customer's tracking view.

---

**Stopping after the Technician module, per instruction.** No Customer or Admin modules generated. With Customer + Technician apps complete, natural next steps: swap to `url_launcher` for maps handoff, add background-location for en-route tracking, and (if desired) the lean in-app **Admin** surface — though the plan keeps full Admin on the React web app.
