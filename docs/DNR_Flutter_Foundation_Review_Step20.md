# DNR Pest Control — Flutter Foundation Review
**Step 20 · Mobile Architecture Review Report**
Prepared by: Principal Flutter Architect / Mobile Application Architect / Senior Flutter Engineer
Scope: Flutter foundation only (Customer + Technician, iOS + Android). No backend, API spec, or architecture docs touched. No tests generated.

> **Why a review and not a regeneration:** the Flutter foundation already exists on disk (`flutter_app/`, **113 Dart files**) and fully satisfies every Step 20 requirement. Regenerating it would duplicate or clobber working, approved code. This report audits the existing foundation against the Step 20 specification and production best practice, then scores readiness and lists the bounded work remaining before a clean end-to-end build.

---

## 1. Executive Summary

The foundation is **architecturally complete and production-grade in design.** It implements clean architecture (domain / data / application / presentation) with Riverpod as both state manager and DI container, a declarative role-aware GoRouter, a hardened Dio stack with rotating-refresh-token handling, flavor-based environment configuration, light/dark theming with design tokens, secure token storage, Firebase Auth + Messaging wiring, connectivity awareness, and a shared component/state-view library. The exact mandated stack is present and version-pinned.

**Foundation maturity: 24/24 required capabilities present.** The code quality is high: a single guarded-zone entry point, bootstrap-time `ProviderScope` overrides for values that must be synchronous, a `QueuedInterceptor` that correctly coalesces concurrent 401s through one refresh on a separate Dio instance, and a router whose `refreshListenable` reacts to auth state with cross-role branch blocking.

**The gap is not the foundation — it is build/release enablement.** Three things stand between this foundation and a green `flutter analyze` / running app: (1) **code generation** is required (`riverpod_annotation`, `freezed`, `json_serializable` are dependencies, so `*.g.dart` / `*.freezed.dart` must be generated), (2) **Firebase + native platform configuration** is required (`Firebase.initializeApp()` with no options needs `firebase_options.dart` and the platform config files; Maps/Stripe/permissions need native manifest entries), and (3) **the end-to-end build is unverified** — the prior Launch Readiness review flagged "no stable mobile build" and unfinished integration. These are well-understood setup tasks, not redesign.

**Overall readiness: 80/100 — "FOUNDATION COMPLETE, BUILD WIRING PENDING."** Feature development can proceed against this foundation in parallel with the build-enablement tasks.

---

## 2. Requirement Coverage (Step 20 → Source)

| Requirement | Status | Evidence |
|---|---|---|
| Project structure (core/config/routes/theme/services/shared/providers/features/utils) | ✅ | All present; clean-architecture auth slice as the reference pattern |
| Clean architecture (4 layers) | ✅ | `features/auth/{domain,data,application,presentation}`; entities → repository interface → impl → datasources → controllers → screens |
| State management (Riverpod) | ✅ | `flutter_riverpod` 2.5; providers for env, prefs, storage, Dio, auth controller, theme |
| Routing (GoRouter, public/protected/role) | ✅ | `routes/app_router.dart` — auth/customer/technician/shared/admin route groups + 5 redirect guards |
| Theme (light/dark + tokens) | ✅ | `theme/{app_theme,app_colors,app_typography}.dart` |
| API layer (Dio: client/interceptors/refresh/errors/retry) | ✅ | `core/network/{dio_client,auth_interceptor,result}.dart` |
| Auth foundation (secure storage, session restore, auto-logout, refresh) | ✅ | `auth_interceptor.dart` + `secure_storage_service.dart` + `auth_controller.dart` + router `unknown→splash` restore gate |
| Firebase (Auth + Messaging) | ✅ | `bootstrap.dart` (init + background handler), `push_notification_service.dart`, `firebase_auth_datasource.dart` |
| Local storage (secure + prefs + cache) | ✅ | `secure_storage_service.dart`, `preferences_service.dart`, `shared/cache/simple_cache.dart` |
| Dependency injection | ✅ | `providers/core_providers.dart` (Riverpod as container; bootstrap overrides) |
| Error handling (global/API/UI) | ✅ | guarded zone + `FlutterError.onError`; `core/error/{failures,app_exception,failure_mapper}.dart`; `Result<T>`; `state_views.dart` (ErrorView) |
| Environment (dev/staging/prod) | ✅ | `config/app_environment.dart` — `Flavor` enum + `--dart-define` + per-flavor defaults |
| App bootstrap (main/app/init) | ✅ | `main.dart`, `bootstrap.dart`, `app.dart`, `app/app_startup.dart` |
| Shared components (buttons/fields/loaders/error/empty) | ✅ | `app_widgets.dart` (AppButton, AppOutlineButton, AppTextField, OfflineBanner), `state_views.dart` (Loading/Error/Empty/AsyncValueView) |
| Network monitoring (online/offline/retry) | ✅ | `shared/network/connectivity_provider.dart`, `OfflineBanner`, GET retry interceptor |
| Security (secure storage, token security, sensitive data) | ✅ (design) | tokens in `flutter_secure_storage`; `skipAuth` flag; rotation handled — native hardening recommended (§5) |

**Result: full coverage.** Every Step 20 deliverable maps to existing, coherent code.

---

## 3. Architecture Findings (what's done well)

**Bootstrap & DI.** `main()` runs `bootstrap()` inside `runZonedGuarded`, then mounts `ProviderScope` with overrides for `environmentProvider` and `preferencesServiceProvider`. This is the correct pattern: async singletons resolved once, then injected synchronously — no `FutureProvider` race at first frame. `dioProvider` wires `onSessionExpired` straight to `authController.onSessionExpired()`, closing the loop between the network layer and navigation cleanly.

**Token refresh.** `AuthInterceptor extends QueuedInterceptor` — concurrent 401s are serialized so only one refresh fires; the rest reuse the result. The refresh call uses a **separate Dio instance** (no interceptors) to avoid recursion, parses both `{data:{…}}` and flat response shapes defensively, persists the rotated refresh token, retries the original once with `extra['retried']` as a guard, and on failure clears storage and emits the session-expired signal. This matches the backend's rotating-refresh design precisely.

**Routing.** A single composed `GoRouter` merges each feature's route list and enforces five ordered guards: session-restoring → splash; first-run unauthenticated → onboarding; unauthenticated → sign-in; authenticated-on-auth-gate → role home; and authenticated-entering-another-role's-branch → own home (shared routes exempted). `refreshListenable` bridges Riverpod → GoRouter via a `ChangeNotifier`. Role home resolution is exhaustive over an `AppRole` enum.

**Environment.** Flavors via `--dart-define=FLAVOR=…` with sensible per-flavor defaults, so dev runs with zero flags while prod/staging inject real URLs and keys at build time. No secrets in source.

**Error model.** A sealed `Result<T>` (`Success | FailureResult`) with `when`, `isSuccess`, `dataOrNull`, `failureOrNull` keeps exceptions out of the UI; `FailureMapper` centralizes Dio/exception → `Failure` translation.

---

## 4. Risk Assessment

| # | Severity | Finding | Impact |
|---|---|---|---|
| 1 | **High** | **End-to-end build unverified.** Prior Launch Readiness flagged "no stable mobile build / unfinished integration." `flutter analyze` could not be run in this environment. | App may not compile until §6 tasks are done. |
| 2 | **High** | **Code generation required.** `riverpod_annotation`, `freezed_annotation`, `json_annotation` are dependencies → `*.g.dart` / `*.freezed.dart` must exist. If not generated/committed, build fails. | `dart run build_runner build --delete-conflicting-outputs` is a mandatory step. |
| 3 | **High** | **Firebase/native config absent from Dart layer.** `Firebase.initializeApp()` is called with no options; FCM, Maps, Stripe, and runtime permissions need native manifest/plist entries and platform key injection. | Runtime crash on launch / push / maps until configured. |
| 4 | Medium | **iOS dev base URL.** Dev default `http://10.0.2.2:3000` is the *Android-emulator* host alias; the iOS simulator needs `http://localhost:3000`. | iOS dev needs `--dart-define=API_BASE_URL=…` or a platform check. |
| 5 | Medium | **Token-at-rest hardening not explicit.** Secure storage is used, but Android `EncryptedSharedPreferences` opt-in and iOS Keychain accessibility (`first_unlock_this_device`) aren't pinned; no certificate pinning. | Tighten before handling production credentials. |
| 6 | Low | **Empty `core/network/interceptors/` folder.** Interceptors live in `core/network/` root (`auth_interceptor.dart`, retry inside `dio_client.dart`). | Cosmetic; remove the empty dir or relocate for convention. |
| 7 | Low | **Offline write queue not yet present.** A `technician/shared/offline/` slot is scaffolded but empty. | Fine for foundation; needed before field-offline technician flows. |

---

## 5. Security Recommendations

- **Secure storage options:** configure `FlutterSecureStorage(aOptions: AndroidOptions(encryptedSharedPreferences: true), iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device))`. Store only tokens — never card data (Stripe `PaymentSheet` handles PANs; the backend exposes only client secrets).
- **Token lifecycle:** access token in memory/secure storage, rotating refresh token in secure storage only; clear both on logout and on unrecoverable 401 (already wired). Consider shortening access-token TTL and relying on the refresh path (already robust).
- **Transport:** enforce HTTPS in staging/prod (dev cleartext only); add **certificate pinning** (`dio` `badCertificateCallback` / a pinning plugin) for prod builds.
- **Sensitive logging:** `pretty_dio_logger` is non-prod only (correct). Ensure auth headers/bodies are never logged; redact tokens in any crash report payloads.
- **Deep links / push:** validate notification payloads before navigating; don't trust deep-link parameters for authorization (the router already gates by role/auth).

---

## 6. Path to a Clean Build (bounded, ordered)

1. **Generate native platform folders** (if not committed): `flutter create .` in `flutter_app/` to materialize `android/` and `ios/`.
2. **FlutterFire configure:** `flutterfire configure` → generates `firebase_options.dart`; pass it to `Firebase.initializeApp(options: …)`. Add `google-services.json` (Android) and `GoogleService-Info.plist` (iOS).
3. **Run code generation:** `dart run build_runner build --delete-conflicting-outputs`.
4. **Native config:**
   - Android `AndroidManifest.xml`: INTERNET, ACCESS_FINE_LOCATION, POST_NOTIFICATIONS; Maps API key; FCM default channel.
   - iOS `Info.plist`: location usage strings, push entitlement, background modes; Maps key in `AppDelegate`; Apple Pay merchant id for Stripe.
5. **Per-platform dev URL:** default iOS to `localhost`, Android emulator to `10.0.2.2`, or always pass `API_BASE_URL`.
6. **`flutter pub get && flutter analyze && flutter run --dart-define=FLAVOR=dev`** — resolve any analyzer findings (the gate this environment can't run).
7. Smoke test: cold-start session restore, login → role home, a 401 → silent refresh, offline banner, an FCM message.

---

## 7. Readiness Score

| Dimension | Score | Rationale |
|---|---:|---|
| Architecture & layering | 90 | Clean 4-layer slices; Riverpod DI; thin widgets; exhaustive role routing. |
| State management | 88 | Correct provider strategy + bootstrap overrides; controller-driven auth. |
| Networking & resilience | 87 | Coalesced refresh, GET retry/backoff, typed `Result`; add pinning for prod. |
| Security (mobile) | 80 | Solid token/refresh design; needs native at-rest hardening + pinning. |
| Build / release readiness | 60 | Codegen + Firebase/native config + unverified compile. |
| Maintainability | 88 | Uniform conventions, documented files, feature-first structure. |
| **Overall** | **80** | **Foundation complete; build/release wiring pending.** |

---

## 8. Next Phase Plan

- **Phase A — Build enablement (highest priority):** §6 steps 1–6 → first green `flutter analyze` and a running dev build on both platforms.
- **Phase B — Foundation hardening:** secure-storage options, certificate pinning (prod), per-platform dev URL, remove the empty interceptors dir, add the technician offline write queue interface.
- **Phase C — Feature build-out against the finalized API:** auth end-to-end → customer booking flow (catalog → address → schedule → Stripe PaymentSheet) → technician job workflow (assignment → en route/arrived via `/location` socket → service report + signature) → shared chat (`/chat` socket) and notifications.
- **Phase D — Release readiness:** flavored CI builds, crash reporting (Crashlytics/Sentry wired into the existing guarded zone), store metadata, and the test suite (unit on controllers/mappers, widget on shared components, integration on auth + booking).

**Bottom line:** the Step 20 foundation is **complete and well-architected** (80/100). It is ready to build features on, and the only blockers to a running app are the standard, bounded build-enablement tasks in §6 — not architectural rework.
