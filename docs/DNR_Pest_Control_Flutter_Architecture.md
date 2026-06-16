# DNR Pest Control — Flutter Application Architecture (Step 7)

**Product:** DNR Pest Control mobile app (iOS + Android, single codebase)
**Builds on:** PRD (1) · System Architecture (2) · Database (3) · API Spec (4) · Backend (5) · Auth Design (6)
**Stack:** Flutter · **Riverpod** · GoRouter · Dio · Firebase Auth · Firebase Messaging (FCM) · Google Maps · Stripe · AWS S3
**Roles in one app:** Customer · Technician · Admin
**Document type:** Mobile Application Architecture
**Version:** Draft 1.0
**Scope note:** Architecture and design only. **No code.**

---

# Mobile Architecture Overview

A **single Flutter codebase**, **role-aware at runtime**: the signed-in user's role (from the app JWT issued in Step 6) determines navigation, feature access, and home shell. The app follows a **feature-first, layered (Clean-ish) architecture**:

```
   UI (Widgets/Screens)
        │  watches/reads
   State (Riverpod providers / notifiers)
        │  calls
   Repository (per feature, abstracts data sources)
        │  uses
   Services (Dio API client, Firebase, FCM, Maps, Stripe, S3, storage)
        │
   Models (immutable DTOs / domain entities)
```

**Principles**
- **Thin widgets, logic in notifiers.** UI watches state; business/coordination lives in Riverpod notifiers and repositories.
- **Feature isolation.** Each feature owns its screens, state, models, and repository; shared/core code is separate.
- **Offline-first where it matters** (Technician), per Step 2 — local cache + queued sync.
- **Server is authoritative.** Role only gates UI; the backend enforces real authorization (Step 6).

---

# Flutter Project Structure

```
lib/
├── main.dart                      # Entry: bootstrap, ProviderScope, run flavor-selected app
├── app.dart                       # Root MaterialApp.router (theme, router, localization)
│
├── config/                        # App configuration & flavors
│   ├── env/                       #   Env definitions (dev/staging/prod) & flavor config
│   ├── app_config.dart            #   Resolved config object (base URL, keys-by-flavor)
│   └── theme/                     #   ThemeData, colors, typography, spacing tokens
│
├── core/                          # Framework-level building blocks (no feature logic)
│   ├── constants/                 #   Enums, role keys, route names, asset paths
│   ├── error/                     #   Failure types, exception → Failure mapping
│   ├── network/                   #   Dio setup, interceptors, API result/Either types
│   ├── utils/                     #   Formatters (money/date), validators, helpers
│   └── extensions/                #   Dart/Flutter extensions
│
├── shared/                        # Reusable UI + cross-feature widgets
│   ├── widgets/                   #   Buttons, inputs, cards, loaders, empty/error states
│   ├── layouts/                   #   Role shells / scaffolds with bottom nav
│   └── components/                #   Composite reusable components
│
├── services/                      # Singleton integration services (injected via providers)
│   ├── auth/                      #   FirebaseAuthService (sign-in, social, token)
│   ├── api/                       #   ApiClient wrapper over Dio
│   ├── storage/                   #   SecureStorageService, PrefsService, CacheService
│   ├── notifications/             #   FcmService (token, handlers, channels)
│   ├── location/                  #   Location + Google Maps helpers (technician)
│   ├── payments/                  #   StripeService (payment sheet/intents)
│   └── files/                     #   UploadService (S3 presigned-URL flow)
│
├── models/                        # Shared/global models (User, Role, ApiResponse, Paginated)
│
├── features/                      # Feature-first modules
│   ├── auth/                      #   Login, register, social, forgot password, splash/gate
│   │   ├── data/                  #     repository + remote/local sources
│   │   ├── domain/                #     models, (optional) use cases
│   │   ├── application/           #     Riverpod notifiers/providers (auth state)
│   │   └── presentation/          #     screens + widgets
│   ├── customer/                  #   Customer home, profile, addresses
│   ├── technician/                #   Tech home, job list, job execution, availability
│   ├── admin/                     #   Dashboard, user/service mgmt, reports
│   ├── bookings/                  #   Booking create/list/detail, reschedule, status
│   ├── services_catalog/          #   Services, packages, subscriptions, coupons
│   ├── payments/                  #   Payment & invoice screens
│   ├── reviews/                   #   Submit/view reviews
│   ├── notifications/             #   In-app notification feed
│   ├── chat/                      #   Conversations + messages (future)
│   └── reports/                   #   Service report capture incl. compliance (technician)
│
├── routes/                        # Navigation
│   ├── app_router.dart            #   GoRouter config + auth redirect logic
│   ├── routes.dart                #   Route name/path constants
│   └── guards.dart                #   Redirect/refresh logic by auth + role
│
└── providers/                     # Global Riverpod providers (DI roots)
    ├── service_providers.dart     #   Expose services (api, storage, fcm, stripe...)
    ├── auth_providers.dart        #   authState, currentUser, role
    └── app_providers.dart         #   theme, connectivity, app-wide state
```

**Folder explanations**
- **`main.dart` / `app.dart`** — bootstrap with the selected flavor, wrap in `ProviderScope`, and mount `MaterialApp.router` wired to GoRouter.
- **`config/`** — flavor-aware configuration (base URLs, keys), theme tokens. One place to switch dev/staging/prod.
- **`core/`** — non-feature primitives: Dio/network setup, error/failure types, constants, utils, extensions. No business logic.
- **`shared/`** — design-system widgets and the **role shell layouts** (bottom-nav scaffolds) reused across features.
- **`services/`** — singleton wrappers around external SDKs (Firebase, Dio, FCM, Maps, Stripe, S3, storage), exposed through providers so they're injectable and mockable.
- **`models/`** — app-wide models; feature-specific models live under each feature's `domain/`.
- **`features/`** — each feature is self-contained in **data / domain / application / presentation** layers, keeping UI, state, and data access cleanly separated and independently testable.
- **`routes/`** — GoRouter config and the **auth/role redirect** logic that routes users to the correct shell.
- **`providers/`** — global provider roots acting as the DI layer (services, auth state, app state).

---

# State Management Strategy

### Why Riverpod (recommended)
Riverpod is the right fit over alternatives (Bloc, Provider, GetX) for this app because:
- **Compile-safe DI** — providers replace manual injection; services and repositories are wired and overridable for tests.
- **Granular reactivity** — widgets watch only what they need; good for dashboards and job lists.
- **No `BuildContext` dependency** for reads — simpler async/coordination logic in notifiers.
- **Scales cleanly** across three role modules and many features without boilerplate explosion.
- **`AsyncValue`** elegantly models loading/data/error — ideal for the API-heavy screens here.

(Bloc is a fine alternative if the team strongly prefers explicit event/state; the structure below maps to either. Riverpod is recommended for velocity.)

### Scalability
- One feature = its own set of providers/notifiers under `application/`; no global god-store.
- **`StateNotifier`/`AsyncNotifier`** per use case; `family` providers for parameterized data (e.g., booking by id).
- Cross-feature data shared via small, well-named providers rather than passing objects around.

### Folder organization (within a feature)
```
feature/
├── data/         repository impl + remote (Dio) & local (cache) sources
├── domain/       models + (optional) use cases/interfaces
├── application/  providers + notifiers (the feature's state)
└── presentation/ screens + widgets (watch providers)
```

---

# Navigation Architecture

**GoRouter** with a centralized **auth + role redirect**. The router listens to `authState`; unauthenticated users are sent to the auth flow, authenticated users land in their **role shell**.

### Authentication flow
```
Splash/Gate → read secure storage tokens
  ├─ valid session  → redirect to role home
  ├─ refresh needed → silent /auth/refresh → role home
  └─ none/invalid   → /auth/login
Auth routes: /login, /register, /forgot-password, /social-callback
On is_new_user → /profile-setup before home
```

### Customer navigation (bottom-nav shell)
```
/customer
  ├── /home          (book service, upcoming)
  ├── /bookings      (list → detail → reschedule/cancel, track tech)
  ├── /services      (catalog, packages, subscribe)
  ├── /invoices      (pay, history)
  └── /account       (profile, addresses, notifications)
```

### Technician navigation (bottom-nav shell)
```
/technician
  ├── /jobs          (today's assigned jobs → job detail)
  │     └── /jobs/:id/execute  (status, report, chemicals, photos, signature)
  ├── /schedule      (availability)
  ├── /notifications
  └── /account
```

### Admin navigation (rail/drawer shell — denser)
```
/admin
  ├── /dashboard     (today, exceptions, revenue)
  ├── /bookings      (all, assign/dispatch)
  ├── /customers
  ├── /technicians
  ├── /catalog       (services, packages, coupons)
  ├── /reports       (revenue, utilization, compliance export)
  └── /account
```
> Note (from Step 2): a dedicated **web admin** is recommended long-term; the in-app Admin shell exists for parity/MVP and uses a denser layout.

Route guards: redirect based on `authState` + `role`; deep links validated against role before resolving.

---

# API Layer Architecture

### Dio setup
- A single configured **Dio instance** per flavor (base URL, timeouts, JSON defaults), wrapped by an **`ApiClient`** exposing typed methods returning a **result type** (`Either<Failure, T>` or `AsyncValue`).
- Repositories depend on `ApiClient`, never on raw Dio.

### Interceptors (order matters)
1. **AuthInterceptor** — attaches `Authorization: Bearer <app access token>`.
2. **LoggingInterceptor** — request/response logging in non-prod only (never logs tokens/PII).
3. **ErrorInterceptor** — maps the Step 4 error envelope to typed `Failure`s.
4. **RetryInterceptor** — limited retry for transient network errors (with backoff) for idempotent calls.

### Error handling
- Backend error envelope (`code`, `message`, `details[]`, `request_id`) is parsed into typed failures (`ValidationFailure`, `AuthFailure`, `ConflictFailure`, `ServerFailure`, `NetworkFailure`).
- UI consumes `AsyncValue.error` to render consistent error states; `request_id` surfaced in diagnostics.

### Token refresh handling (matches Step 6)
```
Request → 401?
  ├─ no  → return response
  └─ yes → AuthInterceptor pauses queue
          → call /auth/refresh (rotating token) ONCE
             ├─ success → retry original request with new token
             └─ fail    → clear session → force logout → /login
```
- Single in-flight refresh with a **mutex/lock** so concurrent 401s don't trigger multiple refreshes; queued requests resume after refresh.

---

# Model Structure

- **Immutable models** with `copyWith`, `fromJson`/`toJson`, and value equality (recommend **Freezed + json_serializable**).
- Layering: **DTOs** (wire shape) can map to **domain models** where they diverge; for MVP, well-typed models doubling as both is acceptable.
- Shared models in `lib/models/` (`User`, `Role`, `Paginated<T>`, `ApiError`); feature models under each feature's `domain/`.
- Enums for statuses (`BookingStatus`, `InvoiceStatus`, etc.) mirror backend enums exactly.
- Money handled as integer minor units or `Decimal`, never `double`.

---

# Repository Pattern Structure

- **One repository per feature**, defined as an interface in `domain/` and implemented in `data/`.
- The repository **coordinates sources**: remote (`ApiClient`) and local (cache/secure storage) — the single place that decides "network vs cache, then sync."
- Returns typed results (`Either<Failure, T>` / `AsyncValue`), never raw Dio responses.
- Notifiers depend on **repository interfaces**, enabling fakes in tests and a clean offline strategy (esp. Technician).
- Example responsibilities: `BookingRepository` (create/list/detail/reschedule/cancel/status), `ReportRepository` (submit report + chemicals, queue offline), `AuthRepository` (login/register/refresh/logout).

---

# Service Layer Structure

Singleton services (exposed via providers), wrapping SDKs so features depend on **our interfaces**, not vendors:
- **FirebaseAuthService** — email/Google/Apple sign-in, ID-token retrieval (feeds the backend exchange from Step 6).
- **ApiClient** — Dio wrapper (above).
- **SecureStorageService / PrefsService / CacheService** — local storage (below).
- **FcmService** — push token lifecycle, foreground/background handlers, channels.
- **LocationService** — GPS + Google Maps (technician en-route, customer tracking view).
- **StripeService** — payment sheet / intent confirmation (no card data handled by us).
- **UploadService** — S3 presigned-URL upload flow for photos/signatures, with offline queue.

---

# Local Storage Strategy

### Secure storage (`flutter_secure_storage`)
- Stores **app access & refresh tokens** and any sensitive small values (Keychain/Keystore-backed).
- Never store tokens in `SharedPreferences` or plain files.

### Shared preferences
- Non-sensitive flags/prefs: onboarding seen, theme, last-selected filters, notification opt-ins.

### Cache strategy
- **Read-through cache** for catalog/services and the customer's recent bookings (fast cold-start, light offline read).
- **Technician offline store** (recommend **Drift/SQLite**, matching the backend's relational model): assigned jobs, in-progress reports, chemical entries, queued photos — captured offline and **synced on reconnect** with idempotency keys (Steps 2 & 4).
- Cache invalidation on relevant mutations and on pull-to-refresh; TTLs for catalog data.
- Media files staged locally until uploaded via presigned URLs.

---

# Push Notification Architecture

- **FCM** for cross-platform push; `FcmService` registers the device token and posts it to `POST /notifications/devices` after login.
- Handle **foreground** (in-app banner/state update), **background**, and **terminated** message states; define Android channels and iOS permissions.
- **Notification types** map to deep links (booking confirmed/reminder/en-route/completion, payment, chat) → GoRouter resolves to the right screen (role-checked).
- Token refresh listener updates the backend; token cleared/revoked on logout.
- In-app feed backed by `GET /notifications`; unread badge from state.

---

# Error Handling Strategy

- **Typed failures** end-to-end; UI never sees raw exceptions.
- Standard UI states via a reusable pattern: **loading / data / empty / error-with-retry** (driven by `AsyncValue`).
- **Global handlers:** Flutter `FlutterError.onError` and zone guards route uncaught errors to **Sentry** (or Crashlytics) with `request_id` where available.
- **Connectivity-aware**: offline banner; queue mutations for the technician flow rather than failing hard.
- 401 → silent refresh → forced logout fallback (above). 403 → "not permitted" UX. 409/422 → actionable, field-level messaging.

---

# App Configuration Management

- A single resolved **`AppConfig`** per flavor (base API URL, Firebase options, Stripe publishable key, Maps key, S3/CDN base, feature flags).
- **Feature flags** toggle MVP boundary features (Chat, live GPS) without code branches.
- No secrets baked into the binary beyond necessary **publishable** keys; private keys/server secrets live server-side only.
- Config injected at startup via providers so the rest of the app reads from one source.

---

# Environment Setup

Use **Flutter flavors** (Android product flavors + iOS schemes/configs) + Dart entrypoints (`main_dev`, `main_staging`, `main_prod`):

| Concern | Development | Staging | Production |
|---|---|---|---|
| API base URL | dev backend | staging backend | prod backend |
| Firebase project | dev | staging | prod |
| Stripe | test keys | test keys | live keys |
| Maps key | dev-restricted | staging | prod-restricted |
| Logging | verbose | info | errors only |
| Crash reporting | optional | on | on |
| App id/bundle | `.dev` suffix | `.staging` | clean |

Separate Firebase config files per flavor; CI builds the correct flavor per track.

---

# Dependency Recommendations

| Package | Purpose | Why |
|---|---|---|
| `flutter_riverpod` / `riverpod` | State management + DI | Compile-safe, scalable, testable (chosen above) |
| `go_router` | Declarative routing | Deep links, redirect-based auth/role guards |
| `dio` | HTTP client | Interceptors, timeouts, robust error model |
| `freezed` + `json_serializable` | Models | Immutable models, unions, JSON codegen |
| `firebase_auth` | Authentication | Email/Google/Apple per Step 6 |
| `google_sign_in` / `sign_in_with_apple` | Social auth | Native Google/Apple flows feeding Firebase |
| `firebase_messaging` | Push | FCM per architecture |
| `flutter_local_notifications` | Local/foreground display | Render foreground & scheduled notifications |
| `flutter_secure_storage` | Secure storage | Token storage in Keychain/Keystore |
| `shared_preferences` | Prefs | Non-sensitive flags |
| `drift` (SQLite) | Offline DB | Technician offline-first store (matches relational backend) |
| `google_maps_flutter` | Maps | Tracking & navigation hand-off |
| `geolocator` | Location | Technician GPS capture |
| `flutter_stripe` | Payments | Native payment sheet; no card data handled by us |
| `connectivity_plus` | Connectivity | Offline detection for sync |
| `cached_network_image` | Image caching | Efficient media/photo display |
| `image_picker` | Camera/gallery | Service photo capture |
| `intl` | i18n/formatting | Dates, currency, future localization |
| `sentry_flutter` (or `firebase_crashlytics`) | Crash/error reporting | Production diagnostics |

(Use the latest stable versions at setup time; pin and verify compatibility then.)

---

# Security Best Practices

1. **Tokens in secure storage only** (Keychain/Keystore); never logs/prefs.
2. **Single-flight token refresh** with forced logout on failure (Step 6).
3. **No secrets in the binary** beyond publishable keys; server holds private keys.
4. **No card data in-app** — Stripe payment sheet/tokenization only.
5. **TLS + certificate pinning** (recommended) on the Dio client.
6. **Role gates UI only**; trust the backend for authorization.
7. **Encrypt/limit sensitive cached data** (gate codes/access notes shown only when needed to the assigned tech).
8. **Obfuscation + minification** for release builds; disable verbose logging in prod.
9. **Validate deep links** against role before navigating.
10. **Respect platform permissions** (location, notifications, camera) with clear rationale prompts.

---

# Scalability Recommendations

- **Feature-first modularity** keeps the codebase navigable as features grow; features can later be extracted into packages.
- **Provider-per-use-case** avoids monolithic state; `family`/autoDispose manage memory.
- **Repository abstraction** lets data sources evolve (add caching, swap endpoints) without touching UI.
- **Codegen (Freezed/json_serializable)** keeps model maintenance cheap at scale.
- **Flavors + feature flags** allow staged rollouts and gating future modules (Chat/GPS).
- **Design system in `shared/`** ensures UI consistency and speeds new screens.
- **Offline store isolated** so its complexity stays contained to the technician feature.

---

# Flutter Architecture Review

The design delivers one role-aware Flutter app cleanly layered into UI → state (Riverpod) → repository → services → models, organized feature-first so Customer, Technician, and Admin scale independently within a single codebase. It maps directly onto prior steps: GoRouter's auth/role redirects implement the Step 6 session model; the Dio interceptor stack implements the single-flight token-refresh and error-envelope contract from Steps 4 and 6; the service layer wraps exactly the SDKs in the approved stack (Firebase, FCM, Maps, Stripe, S3); and the offline store honors the Step 2 offline-first requirement for technicians. Local storage correctly separates secure tokens, plain prefs, and cache. The result is testable (mockable repositories/services), production-ready in structure, and gated for MVP scope via feature flags.

# Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Offline sync complexity** (technician reports, photos, conflicts) | High | Isolate in technician feature + Drift; idempotency keys; reconcile rules from Step 2; dedicated test plan |
| **Token-refresh race conditions** under concurrent 401s | Medium | Single-flight mutex + request queue (designed above) |
| **Three roles in one binary** can bloat build/app size | Medium | Lazy-load feature routes; consider role-targeted assets; monitor size |
| **Admin UX in Flutter** (dense data) weaker than web | Medium | In-app Admin for MVP/parity; favor web admin long-term (Step 2) |
| **Stripe/Maps/Apple-Sign-In platform setup** lead time | Medium | Provision keys, capabilities, and entitlements before UI build |
| Compliance fields still unconfirmed (carried) | High (Reports feature) | Confirm before building the report-capture UI |

# Recommendations Before UI/UX Design

1. **Confirm the staff-auth model from Step 6 (Option A vs B)** — it determines the auth screens to design.
2. **Lock the design system tokens** (colors, typography, spacing, components) so `shared/` and screens are built once, consistently — this is the most valuable pre-UI step.
3. **Decide Admin-in-app scope for MVP** (full vs minimal, with web admin as the primary) so you don't design dense admin screens twice.
4. **Confirm offline scope for the Technician flow** (exactly what must work offline) — it shapes both data layer and UI states.
5. **Confirm the four long-standing inputs** (compliance fields especially) before the report-capture screens are designed.
6. **Provision platform prerequisites** (Firebase per flavor, Apple Sign-In capability, Stripe keys, Maps keys, S3/CDN) so UI build isn't blocked by integration setup.
7. **Define key UX states** (loading/empty/error/offline) as shared patterns up front for consistency across all three roles.

Once the auth model, design tokens, and offline/admin scope are confirmed, UI/UX design can proceed against a stable architecture.

*Next step on approval: UI/UX Design.*
