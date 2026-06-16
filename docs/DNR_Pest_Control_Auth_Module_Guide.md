# DNR Pest Control — Authentication & Authorization Module (Step 18)

**Module:** `auth` (NestJS) — production-ready
**Builds on:** PRD · Architecture · **Prisma schema (Step 17)** · API Spec (Step 4) · Backend Foundation (Step 16) · Auth Design (Step 6)
**Stack:** NestJS · Prisma · PostgreSQL · JWT · Firebase Authentication
**Scope:** Authentication module ONLY. No other modules generated.

> Design choice (because the staff-auth model from Step 6 was never locked): this module is a **hybrid** — it supports **direct email/password** auth *and* **Firebase login** (which covers Google, Apple, and Firebase email sign-in, since all produce a Firebase ID token). You can use either path per role without changing the module.

> Dependencies provided by the **foundation** (Step 16), referenced but NOT regenerated here: `PrismaModule`/`PrismaService` (`src/database/`) and `FirebaseModule`/`FirebaseService` (`src/integrations/firebase/`). The Firebase service must expose `verifyIdToken(idToken): Promise<{ uid: string; email?: string; name?: string; emailVerified?: boolean }>`.

---

## Module Structure

```
src/modules/auth/
├── auth.module.ts                 # Wires module: JwtModule, Passport, imports, providers
├── auth.controller.ts             # HTTP endpoints (/api/v1/auth/*)
├── auth.service.ts                # Core logic: register/login/firebase/forgot/reset/logout
├── token.service.ts               # JWT signing + refresh-token rotation/revocation
├── dto/
│   ├── register.dto.ts            # Customer registration input + validation
│   ├── login.dto.ts               # Email/password login input
│   ├── refresh-token.dto.ts       # Refresh/logout payload
│   ├── forgot-password.dto.ts     # Forgot-password request
│   ├── reset-password.dto.ts      # Reset-password (token + new password)
│   └── firebase-login.dto.ts      # Firebase ID-token exchange (Google/Apple/email)
├── guards/
│   ├── jwt-auth.guard.ts          # Global auth guard (honors @Public)
│   └── roles.guard.ts             # Global RBAC guard (honors @Roles)
├── strategies/
│   └── jwt.strategy.ts            # Passport JWT verify + live user load
├── decorators/
│   ├── public.decorator.ts        # @Public() — skip auth on a route
│   ├── roles.decorator.ts         # @Roles(...) — required roles
│   └── current-user.decorator.ts  # @CurrentUser() — inject authed user
└── interfaces/
    ├── jwt-payload.interface.ts   # Access-token claim shape
    └── auth-tokens.interface.ts   # Token + public-user return types
```

## File-by-file purpose (summary)

| File | Purpose |
|---|---|
| `auth.module.ts` | Composition root; configures JwtModule (async from config), Passport, imports foundation modules, registers providers, exports `AuthService`/`TokenService`/`RolesGuard`. |
| `auth.controller.ts` | Endpoints: `register`, `login`, `firebase`, `refresh`, `logout`, `forgot-password`, `reset-password`, `me`. Public routes marked `@Public()`; `logout`/`me` require auth. |
| `auth.service.ts` | Implements all 10 required flows; generic errors (no enumeration); provisions Customer on first Firebase sign-in; delegates tokens + Firebase verification. |
| `token.service.ts` | Access-token signing; opaque refresh tokens with **only a hash stored**; **rotation on use**; reuse detection; single/all-session revocation. |
| `jwt.strategy.ts` | Verifies access token, loads the live user+role, rejects deleted/inactive/suspended — so revocation/role changes apply immediately. |
| `jwt-auth.guard.ts` | App-wide authentication; bypasses `@Public()` routes. |
| `roles.guard.ts` | App-wide RBAC against `@Roles(...)`; capability-level (ownership handled per-module). |
| DTOs | Strong validation: email format, password complexity, E.164 phone, commercial company name, etc. |
| Decorators | `@Public`, `@Roles`, `@CurrentUser` ergonomics. |
| Interfaces | Typed JWT payload + token/public-user contracts. |

---

## Endpoints (maps to Step 4 API Spec)

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/api/v1/auth/register` | public | RegisterDto | user + tokens |
| POST | `/api/v1/auth/login` | public | LoginDto | user + tokens |
| POST | `/api/v1/auth/firebase` | public | FirebaseLoginDto | user + tokens + isNewUser |
| POST | `/api/v1/auth/refresh` | public | RefreshTokenDto | new tokens |
| POST | `/api/v1/auth/logout` | bearer | RefreshTokenDto | `{ success }` |
| POST | `/api/v1/auth/forgot-password` | public | ForgotPasswordDto | generic message |
| POST | `/api/v1/auth/reset-password` | public | ResetPasswordDto | message |
| GET | `/api/v1/auth/me` | bearer | — | current user |

---

## Setup Instructions

1. **Place files** under `src/modules/auth/` (paths are in each file's header).

2. **Install packages** (if not already from the foundation):
   ```
   npm i @nestjs/jwt @nestjs/passport passport passport-jwt argon2
   npm i -D @types/passport-jwt
   ```

3. **Ensure foundation modules exist and are exported** (Step 16):
   - `src/database/prisma.module.ts` exporting `PrismaService`.
   - `src/integrations/firebase/firebase.module.ts` exporting `FirebaseService` with `verifyIdToken(...)`.

4. **Add config namespace** `jwt` in `src/config/configuration.ts`:
   ```
   jwt: {
     accessSecret: process.env.JWT_ACCESS_SECRET,
     accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
     refreshTtlDays: process.env.JWT_REFRESH_TTL_DAYS ?? '30',
     resetSecret: process.env.JWT_RESET_SECRET,
     resetTtl: process.env.JWT_RESET_TTL ?? '30m',
   }
   ```
   (Validate `JWT_ACCESS_SECRET` and `JWT_RESET_SECRET` as required in `env.validation.ts`.)

5. **Register the module** in `app.module.ts`: add `AuthModule` to `imports`.

6. **Register global guards** in the ROOT module so protection is on-by-default:
   ```
   providers: [
     { provide: APP_GUARD, useClass: JwtAuthGuard },
     { provide: APP_GUARD, useClass: RolesGuard },
   ]
   ```
   (Order matters: authentication guard before the roles guard. `JwtAuthGuard` needs `Reflector`, which Nest injects automatically.)

7. **Seed roles** before use (the canonical `UserRole` values) via `prisma db seed` — `getRoleId` expects them present.

8. **Global ValidationPipe** (from the foundation `main.ts`): `whitelist: true, forbidNonWhitelisted: true, transform: true`.

---

## Environment Variables

| Variable | Required | Example | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | `postgresql://user:pass@localhost:5432/dnr` | Prisma connection |
| `JWT_ACCESS_SECRET` | yes | (32+ random bytes) | Access-token signing key |
| `JWT_ACCESS_TTL` | no | `15m` | Access-token lifetime |
| `JWT_REFRESH_TTL_DAYS` | no | `30` | Refresh-token lifetime (days) |
| `JWT_RESET_SECRET` | yes | (32+ random bytes, distinct) | Password-reset token signing key |
| `JWT_RESET_TTL` | no | `30m` | Reset-token lifetime |
| `FIREBASE_PROJECT_ID` | yes* | `dnr-pest-dev` | *Required for Firebase login |
| `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | yes* | service account | Used by foundation FirebaseService |

Use **distinct** secrets per environment, stored in a secrets manager for staging/prod — never commit them.

---

## Testing Instructions

### Unit tests (Jest)
- **AuthService**: mock `PrismaService`, `TokenService`, `FirebaseService`, `JwtService`.
  - register: duplicate email → `ConflictException`; success → tokens + customer profile created.
  - login: wrong password / missing user → `UnauthorizedException` (identical message); suspended → `ForbiddenException`.
  - firebaseLogin: new uid → creates Customer (`isNewUser=true`); existing email w/o uid → links uid; inactive → forbidden.
  - resetPassword: bad/expired token → `BadRequestException`; success → hash updated + all sessions revoked.
- **TokenService**: rotate revokes old + issues new; expired/revoked → `UnauthorizedException`; bad secret on valid id → revokes + throws (reuse detection).
- **RolesGuard**: no `@Roles` → allow; role mismatch → `ForbiddenException`.
- **JwtStrategy.validate**: deleted/suspended user → `UnauthorizedException`.

### e2e tests (Supertest, test DB)
```
POST /api/v1/auth/register      → 201 + tokens
POST /api/v1/auth/login         → 200 + tokens; wrong pw → 401
GET  /api/v1/auth/me            → 401 without bearer; 200 with valid access token
POST /api/v1/auth/refresh       → 200 new pair; reusing the OLD refresh token → 401
POST /api/v1/auth/logout        → 200; subsequent refresh with that token → 401
POST /api/v1/auth/forgot-password → 200 generic message for both existing & unknown emails
POST /api/v1/auth/reset-password  → 200 with valid token; tampered token → 400
```
- Run against an ephemeral Postgres (docker-compose) with `prisma migrate deploy` + seed.

### Security checks to assert
- No `passwordHash`/`firebaseUid` in any response body.
- Refresh tokens are not stored in clear text (DB column holds an argon2 hash).
- Forgot-password gives an identical response regardless of account existence.
- Rate limiting applies to `/auth/*` (global `ThrottlerGuard` from the foundation).

---

## Notes & Follow-ups
- **Password reset email dispatch** is intentionally a hook point (`// await this.mailer...`) — it belongs to the **Notifications module** (SendGrid), not Auth. Wire it when that module exists.
- **Firebase password reset** is handled client-side by the Firebase SDK; the backend reset flow here serves **direct (staff/password) accounts**.
- If you later **lock Option A (Firebase for everyone)**, you can disable the direct `register`/`login`/reset endpoints by policy without removing the code.

**Stopping after the Authentication module, per instruction.** No other modules generated. Next in the build order (Step 16) would be the **Users module**.
