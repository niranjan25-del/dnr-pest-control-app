## DNR Pest Control — Flutter Authentication Module (Step 36)

**Feature:** `features/auth` — production-ready, clean architecture, feature-first.
**Builds on:** Flutter Foundation (35) · Auth backend (18) · Auth Design (Firebase IdP) · API Spec · UI/UX system.
**Stack:** Flutter · Riverpod · GoRouter · Firebase Auth · Dio.
**Scope:** Authentication ONLY — no Customer/Technician screens.

> **Model (from the approved Auth Design):** Firebase is the **identity provider**. The app signs in with Firebase (email/password, Google, Apple), gets a **Firebase ID token**, and exchanges it with the backend (`/auth/register`, `/auth/login`) for **app access + refresh JWTs**. All subsequent API calls use the app JWT; refresh is via `/auth/refresh` (not Firebase). Password reset is **delegated to Firebase**.

> ⚠️ **One-line foundation fix (token field names).** The backend returns **snake_case** `access_token`/`refresh_token` (API Spec §/auth/refresh). The foundation's `core/network/auth_interceptor.dart` `_tryRefresh()` currently reads camelCase. Change those two reads to:
> ```dart
> final access = data['access_token'] as String?;
> final refresh = data['refresh_token'] as String?;
> ```
> (The auth feature's own models already parse snake_case with a camelCase fallback.)

---

## Folder Structure
```
features/auth/
├── domain/                  # pure: entities + repository contract
│   ├── entities/            # AuthUser, AuthSession
│   └── repositories/        # AuthRepository (interface) + CustomerType
├── data/                    # Firebase + backend + persistence
│   ├── models/              # snake_case JSON parsing → entities
│   ├── datasources/         # FirebaseAuthDatasource (IdP), AuthRemoteDatasource (Dio)
│   └── repositories/        # AuthRepositoryImpl (orchestration, Result<T>)
├── application/             # Riverpod controllers + form state + validators + DI
└── presentation/            # screens + widgets + auth_routes (GoRouter)
```
Dependency rule: presentation → application → domain ← data. Domain imports nothing app-specific.

## Screens
Splash (session-restore gate) · Onboarding (first-run, persists flag) · Login (email + Google + Apple) · Register (step 1: Firebase create + verify email) · Email Verification (resend + poll) · Profile Setup (step 2: backend provision + commit session) · Forgot Password (Firebase reset email) · Reset Password (deep-link `oobCode` → `confirmPasswordReset`).

## Authentication Flows
- **Login:** Firebase sign-in → ID token → `POST /auth/login` → persist tokens → `AuthController.setAuthenticated` → router redirects to role home.
- **Social:** Google/Apple credential → Firebase → `POST /auth/login {provider}` → same commit.
- **Registration:** (1) Firebase `createUser` + `sendEmailVerification`; (2) Profile Setup → `POST /auth/register {firebase_id_token, full_name, phone, customer_type}` → tokens → commit.
- **Session restore:** foundation `AuthController._restore()` reads tokens on launch; the first authed call validates, and a hard 401 logs out. `fetchCurrentUser()` (`GET /auth/me`) is available to validate eagerly.
- **Token refresh:** transparent in the foundation Dio interceptor (rotating refresh).
- **Forgot password:** Firebase `sendPasswordResetEmail` (enumeration-safe success copy).
- **Logout:** `logoutProvider` → best-effort `POST /auth/logout {refresh_token}` + Firebase `signOut` + clear local session.

## Role-Based Routing
On success, the role from the backend (`CUSTOMER` / `TECHNICIAN` / admin sub-roles) is normalized (`toUpperCase()`) and stored; the foundation router redirects to `customerHome` / `technicianHome` / `adminHome` and blocks cross-role branches. Admin has limited mobile access (full admin is web).

## Forms (validation · errors · loading)
`AuthValidators` (email/password/confirm/name/phone). Each screen uses a `Form` + `TextFormField` validators. Controllers expose a `SubmissionState` (idle/submitting/success/failure); buttons show a spinner while submitting; failures surface via `ref.listen` → snackbar (Firebase codes mapped to friendly, enumeration-safe messages).

## Riverpod Providers
`firebaseAuthDatasourceProvider`, `authRemoteDatasourceProvider`, `authRepositoryProvider`, plus per-screen `autoDispose` controllers (`loginControllerProvider`, `registerControllerProvider`, `profileSetupControllerProvider`, `forgot/reset/emailVerificationControllerProvider`) and `logoutProvider`. Success commits via the foundation `authControllerProvider`.

## Repository / API / Models / Storage
`AuthRepositoryImpl` orchestrates Firebase + `AuthRemoteDatasource` (Dio, `skipAuth` on token-exchange calls) and persists tokens through the foundation `SecureStorageService`. Models parse the snake_case envelope into `AuthSession`/`AuthUser`. All methods return `Result<T>` (no throwing into the UI).

## Error & Loading
Two layers: Firebase/Dio exceptions → `FailureMapper` → domain `Failure` → `Result`. UI maps failures to messages; loading is the `submitting` state.

---

## Setup Instructions
1. Files live under `lib/features/auth/`. No new packages beyond the foundation's `pubspec.yaml` (firebase_auth, google_sign_in, sign_in_with_apple already present).
2. **Wire routes** — in `lib/routes/app_router.dart`: `import '../features/auth/presentation/auth_routes.dart';` then set `routes: [ ...authRoutes, /* role home routes */ ]` and remove the placeholder Splash/SignIn routes (these replace them). Keep the existing `redirect`.
3. Apply the **interceptor snake_case fix** above.
4. Firebase console: enable **Email/Password, Google, Apple** providers. iOS: add the Google reversed-client-id URL scheme + Apple "Sign in with Apple" capability. Android: add the SHA-1/256 for Google.
5. (Optional) Deep links for in-app reset: route `/reset-password?oobCode=...` to `ResetPasswordScreen` (already mapped). If you use Firebase-hosted reset pages, the Reset screen is optional.

## Required Packages
From the foundation `pubspec.yaml`: `firebase_auth`, `google_sign_in`, `sign_in_with_apple`, `flutter_riverpod`, `go_router`, `dio`, `flutter_secure_storage`. No additions.

## Testing Instructions
**Unit (mock `AuthRepository`):**
- validators: email/password/confirm/phone/name edge cases.
- controllers: submitting → success commits session; failure sets `SubmissionState.error`.
- repository (mock Firebase + remote): login persists tokens; completeRegistration maps `CustomerType` → `RESIDENTIAL/COMMERCIAL`; logout proceeds even if server revoke fails.
- mapping: Firebase `wrong-password`/`user-not-found` → generic "Incorrect email or password" (no enumeration).

**Widget:** Login validation blocks empty submit; spinner shows while submitting; failure shows a snackbar. Register success navigates to email verification.

**Integration (Firebase emulator + backend):** full sign-up → verify → profile setup → role home; login → role home; forgot-password sends email; refresh rotates tokens; logout clears session and returns to sign-in.

---

**Stopping after the Authentication module, per instruction.** No Customer or Technician screens generated. Next would be the **role shells** (customer/technician home scaffolds with bottom nav) and then feature modules (booking, payments, chat, tracking, …) attaching their routes/providers onto this foundation.
