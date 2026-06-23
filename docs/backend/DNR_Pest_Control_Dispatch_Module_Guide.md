# DNR Pest Control — Technician Assignment & Dispatch Module (Step 22)

**Module:** `technician-assignment` (NestJS) — production-ready
**Builds on:** Prisma schema (17) · Auth (18) · Users & Profiles (19) · Services (20) · Bookings (21) · API Spec (4)
**Scope:** Dispatch ONLY. No other modules generated.

> **Relationship to the Bookings module.** Step 21's `AssignmentService` had a basic assign/reassign. **This module is the canonical, fuller dispatch system** (auto-engine, accept/reject, dashboard, workloads). Recommendation: have Bookings' `POST /bookings/:id/assign` delegate to this module's `TechnicianAssignmentService.manualAssign` (exported), or deprecate the basic one. The two implement the same core assign transaction, so behavior is consistent.

> **Status reconciliation.** Requested "Pending"/"Rejected" are not schema enum values. Using the approved `AssignmentStatus`: **ASSIGNED = offered/awaiting acceptance ("pending")**, **DECLINED = "rejected"**; ACCEPTED/REASSIGNED/COMPLETED/CANCELLED map directly. See `enums/assignment-status.ts`.

---

## Module Structure
```
src/modules/technician-assignment/
├── technician-assignment.module.ts
├── technician-assignment.controller.ts     # /dispatch/* (admin) + /assignments/* (tech)
├── technician-assignment.service.ts        # orchestration (assign/reassign/accept/reject/workloads/dashboard)
├── auto-assignment.service.ts              # the scoring ENGINE (batched queries)
├── enums/
│   └── assignment-status.ts                # transitions, active sets, dispatch roles
├── interfaces/
│   └── assignment.interfaces.ts            # candidate score, workload, dashboard types
└── dto/
    ├── manual-assign.dto.ts
    ├── auto-assign.dto.ts                  # dryRun preview
    ├── reassign.dto.ts                     # manual (technicianId) or auto (omit)
    ├── reject-assignment.dto.ts
    ├── update-assignment-status.dto.ts
    └── query-assignments.dto.ts
```

## Why two services (SOLID)
- **AutoAssignmentService** — pure selection engine (rank/select), no orchestration/writes.
- **TechnicianAssignmentService** — orchestration + persistence + transactions.

---

## Assignment Algorithms

### Selection criteria (weighted; configurable via `dispatch.weight*`)
| Criterion | Default weight | How scored |
|---|---|---|
| Skill match | 40 | proportion of (service category + target pests) covered by `technician.skills`; neutral 1 if none required |
| Service area | 30 | `technician.serviceAreas` covers the address city; empty areas ⇒ assumed covers all (=1) |
| Workload balance | 20 | `weight × 1/(1+activeAssignments)` — fewer active → higher |
| Proximity | 10 | `weight × 1/(1+km/10)` from last-known location; **0 when unknown** |

### Priority logic
Hard-eligible first (available + no time conflict) → total score desc → lower workload → earlier hire date (tie-break).

### Fallback strategy
Hard filters (availability + no overlapping active assignment) always apply. Soft scores only **rank** eligible technicians — so even with zero skill/area match, an available, non-conflicting technician is still selectable (lowest workload wins). Only if **no** technician is available/non-conflicting does the engine throw `409`, signaling manual intervention.

### Scalability
Candidate evaluation uses **batched queries (no N+1)**: one query for available techs, one for time-conflicts, one `groupBy` for workloads, one for latest locations — then scoring in memory. For very large fleets, precompute workloads/last-location in a materialized view.

---

## Features → Endpoints

### Dispatch (admin: Super Admin / Ops / Dispatcher)
| Feature | Method/Path |
|---|---|
| Dashboard (unassigned, by-status, workloads) | `GET /api/v1/dispatch/dashboard` |
| Technician workloads | `GET /api/v1/dispatch/workloads` |
| Preview ranked candidates | `GET /api/v1/dispatch/bookings/:bookingId/candidates` |
| Manual assign | `POST /api/v1/dispatch/bookings/:bookingId/assign` |
| Auto assign (optional `dryRun`) | `POST /api/v1/dispatch/bookings/:bookingId/auto-assign` |
| Reassign (manual or auto) | `POST /api/v1/dispatch/bookings/:bookingId/reassign` |
| Assignment history for a booking | `GET /api/v1/dispatch/bookings/:bookingId/assignments` |
| List assignments | `GET /api/v1/assignments` |
| Admin status change | `PATCH /api/v1/assignments/:id/status` |

### Technician
| Feature | Method/Path |
|---|---|
| My assignments | `GET /api/v1/assignments/me` |
| Accept | `POST /api/v1/assignments/:id/accept` |
| Reject | `POST /api/v1/assignments/:id/reject` |
| Assignment detail (own) | `GET /api/v1/assignments/:id` |

## Assignment Status Workflow
`ASSIGNED → ACCEPTED | DECLINED | REASSIGNED | CANCELLED`; `ACCEPTED → COMPLETED | REASSIGNED | CANCELLED`; others terminal. Enforced by `canTransitionAssignment`.

## Assignment History / Audit Trail
- **History:** all `TechnicianAssignment` rows for a booking (`/dispatch/bookings/:id/assignments`), ordered by creation — every offer/reassign is retained (old ones become `REASSIGNED`/`DECLINED`).
- **Audit:** sensitive dispatch actions are additionally captured by the foundation `audit_logs` layer; booking status transitions (PENDING→CONFIRMED on first assign) write `booking_status_history`.

## Notification Triggers (hooks; Notifications module not built)
- On assign → notify technician (offered) + customer (technician assigned).
- On reject → notify dispatch (needs reassignment).
- On reassign → notify old + new technician (+ customer if timing changes).
Marked as `// Hook:` comments at the trigger points.

## Error Handling
- 400 — illegal transition, unavailable technician, terminal booking.
- 403 — non-dispatch role, or technician acting on a non-own assignment.
- 404 — booking/technician/assignment not found.
- 409 — technician time conflict, or no available technician (auto-assign).

## Logging / Transactions
- `Logger` records assign/reassign/accept/reject/status (ids only).
- Assign/reassign wrapped in `prisma.$transaction` (retire old + create new + PENDING→CONFIRMED + status history).

---

## Setup Instructions
1. Place files under `src/modules/technician-assignment/`.
2. Register `TechnicianAssignmentModule` in `app.module.ts`.
3. (Optional) point Bookings' assign endpoint at this module's `TechnicianAssignmentService.manualAssign` and remove the basic `AssignmentService`.
4. Add engine weights to `src/config/configuration.ts` (optional; defaults used otherwise):
   ```
   dispatch: {
     weightSkill: Number(process.env.DISPATCH_WEIGHT_SKILL ?? 40),
     weightArea: Number(process.env.DISPATCH_WEIGHT_AREA ?? 30),
     weightWorkload: Number(process.env.DISPATCH_WEIGHT_WORKLOAD ?? 20),
     weightProximity: Number(process.env.DISPATCH_WEIGHT_PROXIMITY ?? 10),
   }
   ```
5. Requires Auth (guards/decorators), Profiles, Services, Bookings, and the global `ValidationPipe`.
6. No new packages.

> ⚠️ Engine matching depends on conventions still open: how `skills`/`serviceAreas` JSON map to service categories/pests and to address "areas" (currently matched against the city), and whether live locations exist for proximity. Confirm these conventions; the weights and matchers are the tuning points.

## Testing Instructions
**Unit (mock Prisma/ConfigService):**
- `AutoAssignmentService.rankCandidates`: busy techs `hardEligible=false`; skill/area/workload/proximity contributions; sort order (eligible→score→workload).
- `selectBest`: no eligible → 409.
- `manualAssign`: terminal booking → 400; unavailable tech → 400; conflict → 409; success → ASSIGNED + PENDING→CONFIRMED.
- `accept`/`reject`: not own → 403; wrong state → 400.
- `reassign` without technicianId → uses engine; with → manual.
- `dashboard`/`workloads`: correct counts via groupBy.

**e2e (Supertest + seeded techs/bookings):**
```
GET  /api/v1/dispatch/bookings/:id/candidates           (dispatcher) → ranked list
POST /api/v1/dispatch/bookings/:id/auto-assign {dryRun:true}        → selected, no write
POST /api/v1/dispatch/bookings/:id/auto-assign                      → assignment + CONFIRMED
POST /api/v1/assignments/:aid/accept                    (assigned tech) → ACCEPTED
POST /api/v1/assignments/:aid/accept                    (other tech)    → 403
POST /api/v1/dispatch/bookings/:id/reassign {}          (dispatcher)    → old REASSIGNED + new ASSIGNED
GET  /api/v1/dispatch/dashboard                         (dispatcher)    → counts
```

---

## Example API Requests

**Preview candidates (dispatcher)**
```
GET /api/v1/dispatch/bookings/<uuid>/candidates
Authorization: Bearer <dispatcher token>
```
```json
[
  { "technicianId":"…","name":"Sam Tech","hardEligible":true,"activeWorkload":1,
    "distanceKm":4.2,"score":78.5,
    "breakdown":{"skill":40,"area":30,"workload":10,"proximity":7.4} },
  { "technicianId":"…","name":"Ava Field","hardEligible":true,"activeWorkload":3,
    "distanceKm":null,"score":35,"breakdown":{"skill":20,"area":30,"workload":5,"proximity":0} }
]
```

**Auto-assign (dispatcher)**
```
POST /api/v1/dispatch/bookings/<uuid>/auto-assign
Authorization: Bearer <dispatcher token>

{ "dryRun": false }
```

**Technician accepts**
```
POST /api/v1/assignments/<uuid>/accept
Authorization: Bearer <technician token>
```

**Reassign (auto pick a replacement)**
```
POST /api/v1/dispatch/bookings/<uuid>/reassign
Authorization: Bearer <dispatcher token>

{ "reason": "Original technician called in sick" }
```

---

**Stopping after the Technician Assignment module, per instruction.** No other modules generated. Remaining in the build order: **Payments** (financial/tax inputs) and **Reports** (compliance field set) — the two modules that still need real inputs rather than placeholders.
