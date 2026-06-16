# DNR Pest Control — Users & Profile Management Module (Step 19)

**Modules:** `users` + `profiles` (NestJS) — production-ready
**Builds on:** Prisma schema (Step 17) · Auth module (Step 18) · API Spec (Step 4) · Backend Architecture (Step 5)
**Scope:** Users & Profiles ONLY. No other modules generated.

> SOLID separation: `UsersService` owns the **core user record**; `ProfilesService` owns **customer/technician profile records**. Address management is intentionally excluded — it belongs to the Customer module (`/customers/me/addresses` per the API spec).

> Authorization reuses the Auth module's `@Roles`, `@CurrentUser`, and the global `JwtAuthGuard` + `RolesGuard`. "me" routes derive identity from the JWT (ownership-scoped); `:id` routes are admin-only.

---

## Module Structure

```
src/modules/users/
├── users.module.ts                # imports PrismaModule + AuthModule (TokenService)
├── users.controller.ts            # /users/me, /users, /users/:id, /users/:id/status
├── users.service.ts               # fetch/update/list/search/filter/status-change
├── dto/
│   ├── update-user.dto.ts
│   ├── update-user-status.dto.ts
│   └── query-users.dto.ts         # pagination + filter + search
├── entities/
│   └── user.entity.ts             # safe public user shape
└── interfaces/
    └── paginated-result.interface.ts

src/modules/profiles/
├── profiles.module.ts             # imports PrismaModule
├── profiles.controller.ts         # /customers/me, /customers/:id, /technicians/*
├── profiles.service.ts            # customer + technician profile logic
└── dto/
    ├── update-customer-profile.dto.ts
    ├── create-technician-profile.dto.ts
    ├── update-technician-profile.dto.ts
    └── update-availability.dto.ts
```

## File purposes (summary)

| File | Purpose |
|---|---|
| `users.service.ts` | Core user ops; `safeUserSelect` guarantees no secrets returned; suspend/deactivate revokes refresh tokens via `TokenService`; paginated/filtered/searched list via a single `$transaction` (rows + count). |
| `users.controller.ts` | Self routes (any authed user) + admin routes (`@Roles`); UUID params validated by `ParseUUIDPipe`. |
| `users.module.ts` | Imports `AuthModule` to inject the exported `TokenService` (session revocation). Exports `UsersService`. |
| `profiles.service.ts` | Customer/technician profile reads/writes; commercial company-name rule; technician create guarded (must be a TECHNICIAN user, no duplicate); availability toggle. |
| `profiles.controller.ts` | Resource-accurate routes (`/customers/*`, `/technicians/*`) in one controller via method-level paths. |
| DTOs | Validation for updates, status, technician create/update, availability, and list querying. |
| `user.entity.ts` / `paginated-result.interface.ts` | Typed response contracts. |

---

## Features → Endpoints

### User Management
| Feature | Method/Path | Roles |
|---|---|---|
| Get current user | `GET /api/v1/users/me` | any authed |
| Update own info | `PATCH /api/v1/users/me` | any authed |
| Get user by id | `GET /api/v1/users/:id` | Super Admin, Ops, Support |
| Update user | `PATCH /api/v1/users/:id` | Super Admin, Ops |
| Deactivate / Reactivate / Suspend | `PATCH /api/v1/users/:id/status` | Super Admin, Ops |

### Admin User Management (list/search/filter)
| Feature | Method/Path | Roles |
|---|---|---|
| List + search + filter | `GET /api/v1/users?page=&limit=&search=&role=&status=` | Super Admin, Ops, Support |

### Customer Profiles
| Feature | Method/Path | Roles |
|---|---|---|
| View own profile | `GET /api/v1/customers/me` | Customer |
| Update own profile | `PATCH /api/v1/customers/me` | Customer |
| View profile (admin) | `GET /api/v1/customers/:id` | Super Admin, Ops, Support |

> "Manage preferences": notification/communication preferences are owned by the **Notifications module** (not yet built); this module manages the customer record fields. Hook there when that module lands.

### Technician Profiles
| Feature | Method/Path | Roles |
|---|---|---|
| Create profile | `POST /api/v1/technicians` | Super Admin, Ops |
| View own profile | `GET /api/v1/technicians/me` | Technician |
| Availability settings | `PATCH /api/v1/technicians/me/availability` | Technician |
| View profile (admin) | `GET /api/v1/technicians/:id` | Super Admin, Ops, Support |
| Update (certs/areas/skills) | `PATCH /api/v1/technicians/:id` | Super Admin, Ops |

---

## Error Handling
- `NotFoundException` (404) — missing user/profile.
- `ForbiddenException` (403) — insufficient role (RolesGuard) or self status-change attempt.
- `ConflictException` (409) — duplicate technician profile.
- `BadRequestException` (400) — DTO validation, commercial-without-company, wrong role on technician create.
- All errors flow through the foundation's global exception filter → standard error envelope with `request_id`.

## Logging
- `Logger(UsersService.name)` / `Logger(ProfilesService.name)` log key mutations (status changes, technician creation) — ids/roles only, never PII or secrets.
- Sensitive admin actions (status change) are also written to `audit_logs` by the foundation audit layer.

## Pagination / Filtering / Search
- **Pagination:** `page` (≥1, default 1), `limit` (1–100, default 20); response `meta { page, limit, total, totalPages }`.
- **Filtering:** `role`, `status` (validated enums).
- **Search:** case-insensitive `contains` on `email` and `fullName`.
- Rows + count fetched in one `$transaction` for a consistent snapshot.

---

## Setup Instructions
1. Place files under `src/modules/users/` and `src/modules/profiles/`.
2. Register both modules in `app.module.ts` `imports`: `UsersModule`, `ProfilesModule`.
3. Ensure the **Auth module** (Step 18) is present and exports `TokenService`, `RolesGuard`, and the decorators — `UsersModule` imports `AuthModule`.
4. Ensure global guards (`JwtAuthGuard`, `RolesGuard`) are registered as `APP_GUARD` in the root module (from the Auth setup) — these modules rely on them.
5. Global `ValidationPipe` (`transform: true`) must be enabled (foundation `main.ts`) so query param coercion and DTO validation work.
6. No new packages required beyond Auth/foundation (`@prisma/client`, `class-validator`, `class-transformer`).

## Testing Instructions
**Unit (Jest, mock PrismaService/TokenService):**
- `findById` not found → 404; found → safe entity (no `passwordHash`/`firebaseUid`).
- `changeStatus`: self + non-ACTIVE → 403; suspend → calls `tokenService.revokeAllForUser`.
- `findMany`: builds correct `where` for search/role/status; meta math correct.
- `ProfilesService.createTechnician`: non-existent user → 404; non-TECHNICIAN role → 400; existing profile → 409.
- `updateOwnCustomer`: switching to COMMERCIAL without company → 400.

**e2e (Supertest + test DB, seeded roles & users):**
```
GET   /api/v1/users/me                 (customer token)  → 200 own record
GET   /api/v1/users                     (customer token)  → 403
GET   /api/v1/users?search=ann&role=CUSTOMER (admin)      → 200 paginated
PATCH /api/v1/users/:id/status {status:"SUSPENDED"} (admin) → 200; suspended user's refresh → 401
PATCH /api/v1/users/:adminSelfId/status {status:"SUSPENDED"} (self) → 403
GET   /api/v1/customers/me              (customer)        → 200 profile
PATCH /api/v1/customers/me {customerType:"COMMERCIAL"} (no company) → 400
POST  /api/v1/technicians {userId,...}  (admin, user is TECHNICIAN) → 201
PATCH /api/v1/technicians/me/availability {isAvailable:false} (tech) → 200
```

---

## Example API Requests

**List users (admin):**
```
GET /api/v1/users?page=1&limit=20&search=jane&status=ACTIVE
Authorization: Bearer <admin access token>
```
```json
{
  "data": [
    { "id": "…", "email": "jane@example.com", "fullName": "Jane Doe",
      "role": "CUSTOMER", "status": "ACTIVE", "phone": "+1555…",
      "emailVerifiedAt": null, "lastLoginAt": "…", "createdAt": "…" }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

**Suspend a user (admin):**
```
PATCH /api/v1/users/2f1c…/status
Authorization: Bearer <admin access token>
Content-Type: application/json

{ "status": "SUSPENDED", "reason": "Payment fraud investigation" }
```

**Update own customer profile:**
```
PATCH /api/v1/customers/me
Authorization: Bearer <customer access token>

{ "customerType": "COMMERCIAL", "companyName": "Acme Foods Ltd" }
```

**Create technician profile (admin):**
```
POST /api/v1/technicians
Authorization: Bearer <admin access token>

{
  "userId": "9b3e…",
  "employeeCode": "TECH-014",
  "licenseNumber": "LIC-2231",
  "licenseExpiry": "2027-06-30",
  "skills": ["rodents", "termites"],
  "serviceAreas": ["zone-north", "zone-central"]
}
```

**Technician sets availability:**
```
PATCH /api/v1/technicians/me/availability
Authorization: Bearer <technician access token>

{ "isAvailable": false }
```

---

**Stopping after the Users & Profiles module, per instruction.** No other modules generated. Next in the build order would be the **Customer module** (addresses) or **Services/Catalog**, then **Bookings**.
