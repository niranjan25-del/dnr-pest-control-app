## DNR Pest Control — Flutter Foundation (Step 35)

**Deliverable:** production-ready Flutter **project foundation** — clean architecture, feature-first structure, theming, networking, state, routing, storage, Firebase, error handling, bootstrap, DI. **No feature screens** (placeholders only so it compiles and runs end-to-end).
**Stack:** Flutter · Riverpod · GoRouter · Dio · Firebase Auth/Messaging · Google Maps · Stripe.
**Aligned to backend:** API base `…/api/v1`, error envelope `{error:{code,message,details,request_id}}`, JWT **access + rotating refresh**, Firebase-as-IdP → backend exchanges for app JWTs, brand green `#1E8E5A`.

---

## Project Structure (every folder explained)
```
lib/
├── main.dart            # entry: guarded zone → bootstrap() → ProviderScope(DnrApp)
├── bootstrap.dart       # async init (Firebase, Stripe, prefs); returns provider overrides
├── app.dart            # root MaterialApp.router (themes + GoRouter)
├── config/             # AppEnvironment (flavors via --dart-define) — no secrets in code
├── core/               # cross-cutting, framework-agnostic building blocks
│   ├── constants/      # AppConstants, storage/pref keys, AppRole mapping
│   ├── error/          # Failure (domain) + AppException (transport) + FailureMapper
│   ├── network/        # Result<T>, DioClient factory, AuthInterceptor
│   └── extensions/     # BuildContext sugar (theme/colors/snackbar)
├── theme/              # AppColors (design tokens), AppTypography, AppTheme (light/dark)
├── services/           # device/platform singletons (secure storage, prefs, FCM)
├── providers/          # Riverpod DI graph: core, auth state, theme mode
├── routes/             # GoRouter, route constants, role-aware redirects
├── shared/             # reusable widgets + shared models used by ≥2 features
├── features/           # feature-first modules (data/domain/presentation) — added later
└── utils/              # logger and small pure helpers
```
**Why this split:** `core`/`services`/`theme`/`providers`/`routes` are the stable platform; `features/` is where product work happens, each feature self-contained (presentation → domain ← data; domain depends on nothing). That keeps blast radius small and lets features ship independently.

## Dependency List (the "why")
See `pubspec.yaml` — each line is annotated. Highlights: **Riverpod** (state + DI in one), **GoRouter** (declarative + redirect-based auth gating), **Dio** (interceptors for token/refresh/retry), **firebase_auth/messaging** (IdP + push), **flutter_secure_storage** (tokens) vs **shared_preferences** (non-sensitive), **flutter_stripe** (PaymentSheet), **freezed/json_serializable** (immutable models), **geolocator/google_maps_flutter** (tracking).

## Environment Configuration (dev / staging / prod)
`config/app_environment.dart` resolves the active flavor from `--dart-define=FLAVOR=` with per-flavor defaults (dev points at `10.0.2.2:3000` for the Android emulator). Secrets (`API_BASE_URL`, `GOOGLE_MAPS_API_KEY`, `STRIPE_PUBLISHABLE_KEY`, …) are injected at build time — **never committed**. Native flavors (Android `productFlavors`, iOS schemes) pair with these for app id / Firebase config separation.

## Theme System (light + dark)
`theme/app_colors.dart` transcribes the approved palette (primary `#1E8E5A`; dark mode lightens brand to `#3FB47C` per spec). `AppTheme.light/dark` build Material 3 themes (buttons 52px, 12px radii, bordered cards, themed inputs/nav). Theme mode is persisted (`providers/theme_provider.dart`).

## API Layer
`core/network/dio_client.dart` configures base URL, timeouts, headers, `validateStatus<400`, a GET-only retry for transient errors, and pretty logging (non-prod). **`AuthInterceptor`** (`QueuedInterceptor`) attaches the bearer token, and on `401` performs a single coalesced refresh against `/auth/refresh` using a **separate Dio** (no recursion), persists the **rotated** tokens, and retries the original request once; on refresh failure it clears the session and signals logout. Errors are normalized by **`FailureMapper`** reading the backend envelope.

## State Management (Riverpod)
Riverpod is both state and DI. `environmentProvider` + `preferencesServiceProvider` are **overridden in `main()`** with bootstrap-resolved values (ready synchronously). `dioProvider` composes env + storage + the logout signal. `authControllerProvider` (`StateNotifier<AuthState>`) is the session source of truth.

## Navigation (GoRouter)
`routes/app_router.dart` uses `refreshListenable` bound to auth changes and a `redirect` that: holds on splash while the session restores, sends unauthenticated users to sign-in, routes authenticated users to their **role home** (customer/technician/admin), and blocks cross-role branch access. Feature routes attach under the matching role branch.

## Local Storage Strategy
- **Secure** (`SecureStorageService`): access/refresh tokens, userId, role — Keychain / EncryptedSharedPreferences. Only place tokens are touched.
- **Prefs** (`PreferencesService`): theme, onboarding, locale.
- **Cache:** images via `cached_network_image`; HTTP cache can be added as a Dio interceptor per-feature; sensitive data is never cached to disk.

## Firebase Setup
`bootstrap.dart` calls `Firebase.initializeApp()` and registers the FCM background handler before `runApp`. `PushNotificationService` requests permission, exposes the FCM token (a feature registers it via `POST /notifications/devices`) and shows foreground notifications. **Firebase Auth** is the IdP — the auth feature exchanges the Firebase credential for app JWTs via the backend.

## Error Handling Framework
Two layers: **exceptions** at transport (services), **failures** at domain (UI). Repositories `try/catch` and return `Result<T>` via `FailureMapper`. The UI only ever pattern-matches `Result.when(success, failure)`. Global `FlutterError.onError` + a guarded zone in `main` capture uncaught errors (wire Crashlytics/Sentry here).

## App Bootstrap Flow
`main()` → guarded zone → `bootstrap()` (Firebase, FCM bg handler, Stripe key, prefs, error hooks) → `ProviderScope(overrides)` → `DnrApp` → router shows **Splash** while `AuthController` restores the session → redirect to role home or sign-in.

## Dependency Injection Strategy
Provider composition (no service locator). Leaf singletons (`secureStorage`, `prefs`, `push`) → `dioProvider` depends on them → repositories (per feature) depend on `dio` → controllers depend on repositories. Overrides inject bootstrap values and enable test fakes.

## Folder Naming Conventions
`snake_case` files/folders; `PascalCase` types; `camelCase` members. Suffixes: `_service`, `_controller`, `_provider`, `_repository`, `_screen`, `_dto`. Feature folders are singular domain nouns (`auth`, `payments`).

## Code Standards
`flutter_lints` + `riverpod_lint` (see `analysis_options.yaml`): const-correctness, trailing commas, single quotes, no `print` (use `AppLogger`), ordered imports, no manual providers depending on generated ones. Generated files excluded from analysis.

---

## Setup Instructions
1. `flutter create .` inside `flutter_app/` to generate the native `android/`, `ios/`, etc. shells (keep the provided `lib/`, `pubspec.yaml`, `analysis_options.yaml`).
2. `flutter pub get`.
3. Add Firebase: run `flutterfire configure` (creates `lib/firebase_options.dart`, gitignored) and place `google-services.json` / `GoogleService-Info.plist`.
4. iOS: set min iOS 13 (Stripe/Firebase), add location + notification usage strings to `Info.plist`, add the Google Maps key to `AppDelegate`. Android: min SDK 23, add the Maps key to the manifest.
5. Run: `flutter run --dart-define=FLAVOR=dev --dart-define=GOOGLE_MAPS_API_KEY=… --dart-define=STRIPE_PUBLISHABLE_KEY=…`

## Required Packages
All in `pubspec.yaml` (annotated). Codegen: `dart run build_runner build --delete-conflicting-outputs` (for freezed/json/riverpod once feature models land).

## Firebase Setup Guide
- Create the Firebase project; add iOS + Android apps (one per flavor recommended).
- Enable **Authentication** providers: Email/Password, Google, Apple.
- **Cloud Messaging**: APNs key (iOS) uploaded to Firebase; Android works out of the box.
- `flutterfire configure` per flavor (or a single project with multiple apps); never commit the generated options or service files.

## Build Instructions
- Dev: `flutter run --dart-define=FLAVOR=dev …`
- Staging APK: `flutter build apk --flavor staging --dart-define=FLAVOR=staging --dart-define=API_BASE_URL=… …`
- Prod (Play): `flutter build appbundle --flavor prod --dart-define=FLAVOR=prod …`
- Prod (iOS): `flutter build ipa --flavor prod --dart-define=FLAVOR=prod …`

---

**Stopping after the Flutter foundation, per instruction.** No feature modules or screens generated. Next would be the **auth feature** (Firebase sign-in → backend JWT exchange → `AuthController.setAuthenticated`), then role shells and feature modules that attach routes/providers onto this foundation.
