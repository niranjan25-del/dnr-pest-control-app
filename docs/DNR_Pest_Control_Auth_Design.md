# DNR Pest Control — Authentication & Authorization Design (Step 6)

**Product:** DNR Pest Control Platform
**Builds on:** Backend Architecture (Step 5) and prior approved steps
**Stack relevant here:** NestJS · PostgreSQL · Prisma · **Firebase Authentication** (IdP) · **App-issued JWTs** · FCM
**Document type:** Authentication & Authorization System Design
**Version:** Draft 1.0
**Scope note:** Design only — flows, sequences, strategies, rules. **No code.**

### Auth model used throughout (refinement to confirm)
Per Step 5, **Firebase is the identity provider** and the **NestJS backend issues its own application JWTs** after verifying Firebase tokens.

This design adopts a clear, single recommended model:

> **Firebase Authentication handles all interactive customer sign-in** — email/password, Google, Apple (and phone OTP if enabled). The backend **verifies the Firebase ID token once**, provisions/links a local `User`, then mints **app access + refresh JWTs**. All subsequent API calls use the **app JWT only**.

**Refinement flag:** This means **Firebase stores customer credentials**, so the `password_hash` field from Step 3 is *not used for Firebase-managed users*. It remains available only if you choose a **direct backend-credential path for staff** (Technicians/Admins). Two options for staff are presented in §10; please confirm which before build. The rest of the document assumes Firebase-managed auth for customers and **Admin-provisioned** accounts for staff.

**Sequence diagram legend:** `User → App → Firebase → Backend → DB`. Arrows show request/response order.

---

# 1. User Registration Flow

Only **Customers** self-register. Technicians/Admins are created by Admin (§10).

### Sequence (email/password registration)
```
User → App:        Enter name, email, phone, password, customer_type
App  → App:        Client-side validation (format, password strength)
App  → Firebase:   createUserWithEmailAndPassword(email, password)
Firebase → App:    Firebase user + ID token  (Firebase stores credentials)
App  → Firebase:   sendEmailVerification()
App  → Backend:    POST /auth/register  { firebase_id_token, full_name, phone, customer_type }
Backend → Firebase:verifyIdToken(firebase_id_token)
Firebase → Backend:decoded token (uid, email, email_verified)
Backend → DB:      Create User(role=Customer) + Customer profile, link firebase_uid
Backend → Backend: Issue app access + refresh JWT (refresh stored hashed)
Backend → App:     201 { user, access_token, refresh_token }
App  → User:       Proceed to profile setup / verify-email prompt
```

### Notes
- Backend treats Firebase as the source of the verified identity; it never receives or stores the raw password.
- Duplicate email is caught at Firebase (and defensively at the backend `409`).
- Email verification status is read from the Firebase token; unverified users may be limited until verified (policy to confirm).

---

# 2. Login Flow

### Sequence (email/password login)
```
User → App:        Enter email + password
App  → Firebase:   signInWithEmailAndPassword(email, password)
Firebase → App:    Firebase ID token (+ refresh handled by Firebase SDK)
App  → Backend:    POST /auth/login { firebase_id_token }
Backend → Firebase:verifyIdToken(firebase_id_token)
Firebase → Backend:decoded token (uid, email)
Backend → DB:      Find User by firebase_uid → load role + status
Backend → Backend: If active → issue app access + refresh JWT
Backend → App:     200 { user, access_token, refresh_token }
App  → App:        Store tokens in secure storage (Keychain/Keystore)
App  → User:       Route to role-based home (Customer/Technician/Admin)
```

### Notes
- Suspended/inactive users are rejected with `403` even if Firebase auth succeeds.
- The app's API calls thereafter use **the app access token**, refreshed via `/auth/refresh` (not Firebase) — see §7.

---

# 3. Forgot Password Flow

Because Firebase manages credentials, password reset is delegated to Firebase.

### Sequence
```
User → App:        Tap "Forgot password", enter email
App  → Firebase:   sendPasswordResetEmail(email)
Firebase → User:   Reset email with secure link
User → Firebase:   Opens link, sets new password (Firebase-hosted or app deep link)
Firebase → Firebase: Updates credential
User → App:        Returns to login → logs in with new password (§2)
```

### Notes
- The backend `POST /auth/forgot-password` exists as a thin wrapper (and for staff on a direct path) but, for Firebase-managed users, **Firebase performs the reset** — no password data flows through the backend.
- No account enumeration: generic success regardless of whether the email exists.
- On reset, the backend **revokes existing refresh tokens** for that user (security measure) once it observes the next login.

---

# 4. Google Login Flow

### Sequence
```
User → App:        Tap "Continue with Google"
App  → Google:     Google Sign-In (native) → Google credential
App  → Firebase:   signInWithCredential(googleCredential)
Firebase → App:    Firebase ID token (uid, email, name)
App  → Backend:    POST /auth/login { firebase_id_token, provider: "google" }
Backend → Firebase:verifyIdToken(...)
Firebase → Backend:decoded token
Backend → DB:      Find by firebase_uid → if none, create User(Customer)+Customer profile
Backend → Backend: Issue app access + refresh JWT
Backend → App:     200 { user, access_token, refresh_token, is_new_user }
App  → User:       New user → profile setup; existing → home
```

### Notes
- First Google login auto-provisions a Customer; `is_new_user` lets the app route to profile setup.
- Account linking (same email via Google + email/password) handled by Firebase's linking rules; backend keys on `firebase_uid`.

---

# 5. Apple Login Flow

Required for iOS App Store compliance when other social logins are offered.

### Sequence
```
User → App:        Tap "Sign in with Apple"
App  → Apple:      Apple authorization → Apple identity token + nonce
App  → Firebase:   signInWithCredential(appleCredential)
Firebase → App:    Firebase ID token (uid, email may be private relay)
App  → Backend:    POST /auth/login { firebase_id_token, provider: "apple" }
Backend → Firebase:verifyIdToken(...)
Firebase → Backend:decoded token
Backend → DB:      Find by firebase_uid → create if new (handle Apple private-relay email)
Backend → Backend: Issue app access + refresh JWT
Backend → App:     200 { user, access_token, refresh_token, is_new_user }
```

### Notes
- Apple may return a **private relay email** and only provides the name on **first** authorization — the app must capture name on first sign-in and pass it to the backend.
- Same `firebase_uid` keying and auto-provisioning as Google.

---

# 6. JWT Token Strategy

| Aspect | Decision |
|---|---|
| Token type | App-issued **access token** (JWT) + **refresh token** |
| Access token TTL | Short — recommend **~15 minutes** |
| Access claims | `sub` (user id), `role`, `firebase_uid`, `iat`, `exp`, minimal — **no PII/secrets** |
| Permissions | Resolved **server-side** from `role_permissions`, not embedded |
| Signing | Strong secret/asymmetric key from KMS; rotateable |
| Transport | `Authorization: Bearer <access_token>` over TLS |
| Verification | Global `JwtAuthGuard` verifies signature + expiry, loads user context |

Rationale: short-lived access tokens limit blast radius; resolving permissions server-side avoids stale-claim problems when roles change.

---

# 7. Refresh Token Strategy

| Aspect | Decision |
|---|---|
| Storage (server) | **Hashed** refresh token row per session (device, issued_at, expires_at, revoked) |
| Storage (client) | Secure storage (Keychain/Keystore), never plain prefs |
| Refresh TTL | Longer — recommend **~30 days** (confirm) |
| Rotation | **Rotate on every use** — issue new pair, invalidate old (detect reuse) |
| Reuse detection | A replayed/old refresh token → revoke the whole session family + alert/audit |
| Revocation | On logout, password reset, susp: revoke refresh tokens |

### Refresh sequence
```
App  → Backend:    POST /auth/refresh { refresh_token }
Backend → DB:      Look up hashed token → validate not expired/revoked
Backend → Backend: Rotate: issue new access+refresh, mark old revoked
Backend → DB:      Persist new hashed refresh
Backend → App:     200 { access_token, refresh_token }
```

---

# 8. Session Management

- A **session = a refresh-token family** tied to a device.
- Track device metadata (platform, last_used_at) for visibility and targeted revocation.
- **Logout** (`/auth/logout`) revokes the current session's refresh token.
- Optional: "log out all devices" revokes all sessions for the user.
- **Concurrent sessions** allowed (customer on phone + tech on tablet); cap configurable.
- Suspension/role change triggers session revocation so access can't outlive authorization.
- Access tokens are stateless (not stored); they simply expire — revocation acts at the refresh layer.

---

# 9. User Profile Setup

Runs immediately after first registration / first social login (`is_new_user`).

### Customer
```
App  → Backend:    PATCH /customers/me { full_name?, phone?, company_name? }
App  → Backend:    POST /customers/me/addresses { line1, city, state, postal, gate_code?, access_notes? }
Backend → DB:      Update Customer; create Address (🔒 fields encrypted)
Backend → App:     200 / 201
```
- Minimal required fields to start booking: name, one address. Phone verification optional/configurable.

### Technician / Admin
- Profile is pre-filled by Admin at provisioning (§10); first login prompts password set (if staff direct path) and availability setup for technicians.

---

# 10. Role Assignment

- **Roles:** `Customer`, `Technician`, `Admin` (with room for sub-roles Dispatcher/Owner).
- **Customer:** assigned automatically on self-registration / first social login.
- **Technician & Admin:** **provisioned by an Admin** — never self-assigned. Admin creates the user with the target role via `POST /technicians` or admin user creation; an invite/credential flow onboards them.
- Role is stored on `users.role_id`; permissions via `role_permissions`.
- Role changes are **Admin-only**, audited, and **revoke active sessions** so new authorization takes effect immediately.

### Staff credential options (confirm one)
- **Option A — Firebase for everyone:** staff also authenticate via Firebase (Admin creates the Firebase user + local record). Single auth path; simplest. **Recommended.**
- **Option B — Direct backend credentials for staff:** staff use backend email/password (uses `password_hash`, bcrypt). Keeps staff independent of Firebase but adds a second auth path.

---

# 11. Role-Based Access Control (RBAC)

- Enforced by layered guards (from Step 5):
  - `JwtAuthGuard` — authenticates the request (unless `@Public`).
  - `RolesGuard` — checks route `@Roles(...)`.
  - `PermissionsGuard` — checks fine-grained `@Permissions(...)` from `role_permissions`.
  - `OwnershipGuard` — ensures the specific resource belongs to / is assigned to the caller.
- **Authorization decision flow**
```
Request → JwtAuthGuard:    valid token? → attach user(role)            else 401
        → RolesGuard:      role in @Roles? )                           else 403
        → PermissionsGuard:has required permission?                    else 403
        → OwnershipGuard:  owns/assigned resource? (if applicable)     else 403
        → Controller:      proceed
```
- Client role drives **UI only**; the server is the sole authority.
- Permission matrix is the one defined in Step 5 (Customer/Technician/Admin capabilities).

---

# 12. Security Measures

1. **TLS everywhere**; secure CORS allow-list; Helmet headers.
2. **Short-lived access tokens** + **rotating, hashed refresh tokens** with reuse detection.
3. **Firebase token verified server-side** every login/registration; never trusted blindly from the client.
4. **Rate limiting** on `/auth/*` (login, refresh, register, forgot-password) to deter brute force/credential stuffing.
5. **No account enumeration** in login/forgot-password responses.
6. **Server-side authorization** (RBAC + ownership) on every route.
7. **Secrets in KMS** (JWT signing key, Firebase service account, etc.); none in source.
8. **Session revocation** on logout, password reset, role change, suspension.
9. **Audit** auth events (login, refresh, failed login, password reset, role change) to `audit_logs`.
10. **MFA for Admin** recommended (future); **email verification** for customers.
11. **Secure client storage** of tokens (Keychain/Keystore via `flutter_secure_storage`).
12. **Apple/Google token nonce & signature** validation handled by Firebase; backend keys on verified `uid`.

---

# 13. Validation Rules

| Field | Rule |
|---|---|
| Email | RFC-valid, normalized lowercase, unique |
| Password (if direct path) | Min length (e.g., 8+), complexity, breached-password check (recommended); Firebase enforces its own policy |
| Phone | E.164 format; optional verification |
| full_name | Non-empty, length bounded |
| customer_type | Enum: `residential` \| `commercial` (company_name required if commercial) |
| firebase_id_token | Present, verifiable, not expired |
| refresh_token | Present, matches stored hash, not revoked/expired |
| Address fields | Required: line1, city, state, postal, country (ISO) |

- Global `ValidationPipe` (whitelist + transform) rejects unknown fields with `400` and field-level `details[]`.
- Server-side validation is authoritative; client validation is UX only.

---

# 14. Error Handling

All auth errors use the standard envelope (`code`, `message`, `details[]`, `request_id`).

| Scenario | Code | HTTP |
|---|---|---|
| Invalid input | `VALIDATION_ERROR` | 400 |
| Bad credentials / invalid Firebase token | `INVALID_CREDENTIALS` | 401 |
| Expired/invalid refresh token | `INVALID_REFRESH_TOKEN` | 401 |
| Refresh token reuse detected | `SESSION_REVOKED` | 401 |
| Account suspended/inactive | `ACCOUNT_DISABLED` | 403 |
| Email already registered | `EMAIL_IN_USE` | 409 |
| Rate limited | `TOO_MANY_REQUESTS` | 429 |
| Unverified email (if enforced) | `EMAIL_NOT_VERIFIED` | 403 |

- Vendor (Firebase) errors are mapped to these safe codes; raw Firebase errors are never returned to clients.
- Failed logins are logged (with care, no secrets) for monitoring.

---

# API Interaction Flow (consolidated)

```
Registration:  App→Firebase(create) → App→Backend /auth/register(verify+provision) → app JWTs
Login (all):   App→Firebase(sign-in) → App→Backend /auth/login(verify) → app JWTs
Authed calls:  App→Backend (Bearer app access token) → guards → controller
Token refresh: App→Backend /auth/refresh (rotate) → new app JWTs
Logout:        App→Backend /auth/logout (revoke refresh)
Password reset:App→Firebase(sendPasswordResetEmail) → user resets in Firebase
```

# Mobile App Flow (Flutter)

```
Launch → check secure storage for app tokens
  ├─ valid access token        → route to role home
  ├─ expired access, valid refresh → /auth/refresh → role home
  └─ none/invalid              → Auth screen
Auth screen → choose method (email / Google / Apple)
  → Firebase sign-in → get Firebase ID token
  → POST /auth/login or /auth/register → store app tokens
  → is_new_user? → Profile setup → Home
API layer: interceptor attaches Bearer token; on 401 → try refresh once → else logout
Logout: call /auth/logout → clear secure storage → Auth screen
```

# Backend Flow (NestJS)

```
/auth/register: validate DTO → FirebaseService.verifyIdToken → provision User+Customer
               → TokenService.issue(access, refresh) → persist hashed refresh → return
/auth/login:    validate → verifyIdToken → load User (status/role) → issue tokens
/auth/refresh:  validate → lookup hashed refresh → check expiry/revoke/reuse
               → rotate (new pair, revoke old) → return
/auth/logout:   revoke current refresh token
Guards (global): JwtAuthGuard → RolesGuard → PermissionsGuard → OwnershipGuard
Audit interceptor: record auth events to audit_logs
```

---

# Recommendations Before Flutter Project Setup

1. **Confirm the staff credential model (§10): Option A (Firebase for everyone) vs Option B (direct backend for staff).** This is the most important open decision and shapes the Flutter auth screens and the backend auth paths. **Recommendation: Option A** for a single, simpler auth path.
2. **Confirm token lifetimes & refresh policy** (access ~15 min, refresh ~30 days, rotate-on-use, max concurrent sessions) — needed before building the app's token/interceptor layer.
3. **Decide email-verification enforcement** (block booking until verified, or soft prompt) and phone-verification policy.
4. **Provision Firebase project + service account**, enable Google & Apple providers, and configure Apple Sign-In (Service ID, key) — these have lead time and gate iOS testing.
5. **Define the permission catalog / `role_permissions` seed** so guards and the app's role-gated UI have concrete keys.
6. **Confirm the long-standing inputs** still open from earlier steps (compliance fields above all) — not blocking auth, but blocking the Reports work that follows.
7. **Agree on session-revocation triggers** (logout, reset, role change, suspension) so the app handles forced logout gracefully.

Once the staff credential model and token policy are confirmed, the Flutter project setup and auth UI can proceed against a stable contract.

*Next step on approval: Flutter Project Setup.*
