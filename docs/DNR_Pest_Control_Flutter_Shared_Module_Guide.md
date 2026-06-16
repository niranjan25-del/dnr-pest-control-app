## DNR Pest Control — Shared Mobile Features Module (Step 39)

**Feature:** `features/shared` — cross-cutting capabilities used by both the Customer and Technician apps. Clean architecture, feature-first, production-ready.
**Builds on:** Foundation (35) · Auth (36) · Customer (37) · Technician (38) · backend Chat/Notifications/GPS/Payments/Media · UI/UX system.
**Stack:** Flutter · Riverpod · GoRouter · Dio · Firebase Messaging · Google Maps · Stripe · **Socket.IO**.
**Scope:** Shared features ONLY — no Admin dashboard.

> **New dependency:** `socket_io_client` (chat + live-location namespaces) and `url_launcher` added to `pubspec.yaml`. Run `flutter pub get`.

> **Reconciliations (flagged honestly):**
> - **Chat socket event names** must match the backend `/chat` gateway's `@SubscribeMessage` handlers — constants live in `ChatSocketEvents`; adjust if the gateway differs.
> - **Notification preferences** rely on `GET/PATCH /notifications/preferences`, which was a *flagged* backend addition (Step 28). The controller **degrades gracefully** (defaults on, persists locally) until that endpoint ships.
> - **Saved payment methods** need backend endpoints (`/payments/methods`, `/payments/setup-intent`) not yet in the API Spec; the repo **degrades to an empty list** and surfaces a friendly "not available yet" message rather than crashing.

---

## Folder Structure
```
features/shared/
├── chat/            data(models·repo·socket) · application(controller+providers) · presentation(list+thread)
├── maps/            application(tracking_controller: socket + REST poll) · presentation(tracking map + ETA)
├── payments/        application(history·saved cards·setup-intent) · presentation(history + methods)
├── uploads/         application(upload_controller: camera/gallery + progress + retry) · presentation(source sheet + progress)
├── notifications/   application(preferences: server + local fallback)
├── settings/        presentation(settings: theme + notif + privacy + payments + logout)
├── theme/           (dark mode lives in foundation themeModeProvider; surfaced in settings)
└── shared_routes.dart
```
Also added to foundation `lib/shared/`: `network/connectivity_provider.dart`, `cache/simple_cache.dart` (TTL JSON cache), `widgets/app_widgets.dart` (AppButton/AppTextField/OfflineBanner).

## Real-Time Chat
`ChatSocketService` (Socket.IO `/chat`, JWT handshake) + `ChatRepository` (REST history/list/send fallback). `ChatController` loads history, joins the room, **merges socket messages, sends optimistically** (temp bubble → reconciled on echo), shows the counterpart's **typing** indicator, and emits/receives **read receipts**. Image attachments go through the shared upload flow → `attachment_file_id`. Conversation list is offline-cached (`SimpleCache`).

## Maps & Live Tracking
`TrackingController` connects Socket.IO `/location`, emits `track:join`, and streams `location:technician` / `location:eta` / `location:arrived`; if the socket can't connect it **falls back to polling** `GET /bookings/{id}/technician-location`. `TrackingMapScreen` renders the technician + destination markers and a live ETA/arrival banner. (The Customer booking-details screen can deep-link here: `/track/:bookingId`.)

## Payments
Reusable Stripe checkout (PaymentSheet), **payment history** (paid/issued invoices), and **saved methods** (add card via SetupIntent — gated on backend endpoints). Card data never touches our API.

## File Uploads
`UploadController` + `UploadRepository`: pick from **camera or gallery**, upload to `POST /files` (multipart) with **progress** (`onSendProgress`) and **retry** on failure. Reused by chat attachments (and generalizes the per-feature photo uploads).

## Notifications
Push + in-app handled by the foundation `PushNotificationService`; this module adds **preferences** (push/email/sms) with server sync + local fallback. (The per-app notification centers already exist; the shared `NotificationsRepository` from Step 38 backs them.)

## Settings · Dark Mode · Privacy
One `SettingsScreen`: appearance (system/light/dark, **persisted**), notification toggles, **privacy** (share location during jobs — persisted), payment shortcuts, and logout.

## Offline Handling
- **Connectivity** stream (`connectivityProvider`) + `OfflineBanner`.
- **Local cache** (`SimpleCache`, TTL) for offline-friendly reads (conversations cached; pattern reusable for any list).
- **Retry queues:** chat sends fall back to REST and mark failed for retry; uploads retry; the Technician module's durable outbox (Step 38) covers status/report sync. Together these form the app's sync story.

## Shared Widgets
`AppButton`/`AppOutlineButton` (loading-aware), `AppTextField`, `OfflineBanner`, plus the existing `LoadingView`/`ErrorView`/`EmptyView`/`AsyncValueView`.

## State / API / Validation / Errors / Navigation
Riverpod throughout (`FutureProvider` reads, `StateNotifier` actions, `.family` per conversation/booking). All repos return `Result<T>`; UI renders `AsyncValue`/`SubmissionState`. Routes in `shared_routes.dart`: `/chat`, `/chat/:id`, `/track/:bookingId`, `/payments/history`, `/payments/methods`, `/settings`.

---

## Setup Instructions
1. `flutter pub get` (picks up `socket_io_client`, `url_launcher`).
2. **Wire routes:** in `lib/routes/app_router.dart`, `import '../features/shared/shared_routes.dart';` and add `...sharedRoutes` to the top-level routes. Link from existing screens (e.g. customer booking details → `/track/:bookingId`; app bars → `/chat`; profiles → `/settings`).
3. Ensure `wsBaseUrl` is set per flavor (foundation `AppEnvironment`) and the backend Socket.IO namespaces (`/chat`, `/location`) accept the JWT on the handshake `auth.token`.
4. Confirm the flagged endpoints (notification preferences, saved-method/SetupIntent) or leave the graceful fallbacks until they ship.

## Required Packages
Adds `socket_io_client`, `url_launcher`. Already present: `flutter_riverpod`, `go_router`, `dio`, `flutter_stripe`, `google_maps_flutter`, `image_picker`, `connectivity_plus`, `intl`, `firebase_messaging`.

## Testing Instructions
**Unit (mock socket/repos):**
- ChatController: optimistic temp message reconciled on echo; REST fallback when socket down; read receipt updates delivery; typing debounce.
- TrackingController: socket updates state; connect-error triggers REST polling.
- UploadController: progress updates 0→1; failure → retry path.
- NotificationPrefs: server load, local fallback, optimistic update persists.
- PaymentsRepository: history parse; savedCards degrades to [] on error.

**Widget:** chat composer disabled on empty; bubbles align by `mine`; offline banner shows when `isOnlineProvider` false; settings theme switch persists.

**Integration (backend + sockets):** two devices exchange messages in real time with typing + read receipts; image attachment uploads and renders; customer tracking shows the technician moving with live ETA, arrival banner on geofence; payment history lists invoices.

---

**Stopping after the Shared Mobile Features module, per instruction.** No Admin dashboard. With Foundation + Auth + Customer + Technician + Shared complete, the **Flutter mobile app is feature-complete**. Remaining project work is backend-side: the **consolidation pass** (final Prisma migration with all flagged additions + `app.module.ts` wiring) and the optional **React web Admin**.
