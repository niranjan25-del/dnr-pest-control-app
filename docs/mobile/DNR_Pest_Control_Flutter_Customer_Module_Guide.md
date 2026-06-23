## DNR Pest Control — Customer Mobile Module (Step 37)

**Feature:** `features/customer` — production-ready, clean architecture, feature-first.
**Builds on:** Flutter Foundation (35) · Auth (36) · backend Booking/Payments/Address/Reviews/Notifications · API Spec · UI/UX system.
**Stack:** Flutter · Riverpod · GoRouter · Dio · Google Maps · Stripe.
**Scope:** Customer ONLY — no Technician/Admin modules.

> **Reconciliations (flagged honestly):**
> - **"Select Package" step:** the backend `POST /bookings` is **service-based**; recurring plans are Subscriptions. So the package step is a one-time-vs-recurring choice and MVP routes through `service_id`; recurring shows a note and proceeds as one-time. Wire to the subscriptions flow when that feature lands.
> - **Payment needs an invoice id:** booking → invoice generation → `POST /payments/intent {invoice_id}`. The payment step resolves the invoice from the booking (`invoiceId` on the booking, else `GET /invoices?booking_id=`). If the invoice isn't ready yet it shows "still being prepared" rather than failing hard — confirm the booking→invoice timing/linkage on the backend.
> - **Photo upload:** photos are collected in the draft as local files; uploading them ties to the **Media** endpoints once a booking id exists (the hook is marked in `booking_draft_controller.dart`). Not wired to a Media call here to stay within scope.

---

## Folder Structure
```
features/customer/
├── shared/                       # cross-cutting customer layer
│   ├── models/customer_models.dart      # Service, Address, Booking, Invoice, Review, Notification, Profile, Paginated
│   ├── data/                            # endpoints + repositories (catalog, booking, payment, account)
│   └── application/customer_providers.dart   # DI + FutureProviders (services, bookings, addresses, profile, notifications, unread)
├── dashboard/                    # home: quick-book, upcoming, recent, alerts summary
├── bookings/
│   ├── booking_flow/             # 10-step wizard: draft controller + step widgets + wizard screen
│   └── booking_screens.dart      # history (tabs), details (+cancel), reschedule
├── addresses/                    # list (default/delete) + add/edit form
├── payments/payment_controller.dart  # Stripe PaymentSheet orchestration
├── reviews/review_screen.dart
├── profile/profile_screen.dart   # view + edit + logout
├── notifications/                # notification center
├── customer_shell.dart           # bottom-nav shell (Home/Bookings/Alerts/Profile)
└── customer_routes.dart          # StatefulShellRoute + pushed full-screen routes
```
Also added to the foundation `lib/shared/`: `state/submission_state.dart`, `widgets/state_views.dart` (Loading/Error/Empty + `AsyncValueView`), `utils/money.dart`.

## Dependency rule
presentation → application → shared(domain/data) ← Dio. Repositories return `Result<T>`; the UI renders `AsyncValue` via `AsyncValueView` and actions via `SubmissionState`. The customer feature reuses auth's validators; everything else is self-contained.

## Service Booking Flow (10 steps)
Implemented as a **wizard** (one `BookingDraftController` + step widgets + a paged screen) rather than 10 routed screens — less state-passing, better UX, and the draft is the single source of truth. Steps: Service → Pest → Plan → Address → Date/Time → Photos → Notes → Review → **Payment** (creates booking via idempotent `POST /bookings`, then Stripe PaymentSheet) → **Confirmation**. Per-step Next is disabled until that step's data is valid.

## Features → key endpoints
| Area | Endpoints |
|---|---|
| Catalog | `GET /services` |
| Bookings | `POST /bookings` (Idempotency-Key) · `GET /bookings` · `GET /bookings/{id}` · `PATCH /bookings/{id}` (reschedule) · `POST /bookings/{id}/cancel` |
| Addresses | `GET/POST /customers/me/addresses` · `PATCH/DELETE …/{id}` (+ `is_default`) |
| Payments | `POST /payments/intent` → `client_secret` → Stripe → `POST /payments/{id}/confirm` |
| Reviews | `POST /reviews` |
| Profile | `GET/PATCH /customers/me` |
| Notifications | `GET /notifications` · `PATCH …/{id}/read` · `POST …/read-all` |

## State management (Riverpod)
Reads via `FutureProvider(.family/.autoDispose)` → `AsyncValue`. Mutations via `StateNotifier` controllers (`BookingDraftController`, `PaymentController`) using `SubmissionState`. After a mutation, the relevant provider is invalidated to refresh lists. Logout reuses auth's `logoutProvider`.

## Validation · Loading · Error · Empty
- **Validation:** form validators (address, profile, review rating required); booking steps gate Next.
- **Loading:** spinners on buttons (`SubmissionState.isSubmitting`) and `LoadingView` for reads.
- **Error:** transport → `Failure` → `ErrorView`/snackbar; never a raw exception in UI.
- **Empty:** `EmptyView` for no services/bookings/addresses/notifications, often with a CTA.

## Navigation Flow
4-tab `StatefulShellRoute` (Home/Bookings/Alerts/Profile), each with its own stack. The booking wizard, address forms, booking details, reschedule, and review are pushed full-screen above the shell. Deep targets: `/customer/book`, `/customer/bookings/:id`, `/customer/addresses/...`.

## Responsive Design
Scrollable, constraint-friendly layouts; `Wrap` for chips/photos; bottom-sheet edit on small screens; `NavigationBar` (M3) adapts; lists use `ListView` with pull-to-refresh. For tablets, the shell can later host a two-pane layout (list + detail) — the routes already separate list/detail.

---

## Setup Instructions
1. Files under `lib/features/customer/` + the three `lib/shared/` helpers. No new packages (flutter_stripe, image_picker, intl already in the foundation `pubspec.yaml`).
2. **Wire routes:** in `lib/routes/app_router.dart`, `import '../features/customer/customer_routes.dart';` and replace the placeholder `customerHome` route with `...customerRoutes`. Keep the existing auth redirect (it already routes CUSTOMERs to `/customer`).
3. **Stripe:** ensure `Stripe.publishableKey` is set in bootstrap (foundation already does this from `--dart-define`). iOS: add merchant + URL scheme per flutter_stripe; Android: no extra steps for PaymentSheet.
4. Apply the auth module's interceptor snake_case fix (carried over) so token refresh works during long sessions.

## Required Packages
From the foundation `pubspec.yaml`: `flutter_riverpod`, `go_router`, `dio`, `flutter_stripe`, `image_picker`, `intl`, `cached_network_image`. No additions.

## Testing Instructions
**Unit (mock repositories):**
- BookingDraftController: `readyToReview` gating; `submitBooking` success sets `createdBooking`; failure sets error.
- PaymentController: no-invoice → friendly error; Stripe cancel → ValidationFailure; confirm success → true.
- AccountRepository: address upsert (POST vs PATCH by id); set-default; markAllRead.
- Models: snake_case parsing (booking window dates, money strings, address one-line).

**Widget:** wizard Next disabled until service/address/schedule chosen; dashboard partitions upcoming/recent; address form validation; review requires a rating.

**Integration (backend + Stripe test):** full book → pay (test card) → confirmation → appears under Upcoming; reschedule within policy; cancel; submit review (pending moderation); notifications mark-read updates the badge.

---

**Stopping after the Customer module, per instruction.** No Technician or Admin modules generated. Natural next steps: wire photo upload to the Media endpoints in the booking flow, add live technician tracking (Google Maps + the Location socket) to booking details, and then the Technician module.
