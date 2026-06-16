## DNR Pest Control — Customer Address & Service Area Module (Step 23)

**Modules:** `addresses` + `service-areas` (NestJS) — production-ready
**Builds on:** Prisma schema (17) · Auth (18) · Users & Profiles (19) · Services (20) · Bookings (21) · Dispatch (22) · API Spec (4)
**Tech:** NestJS · Prisma · PostgreSQL · **Google Maps Geocoding API**
**Scope:** Addresses & Service Areas ONLY. No other modules generated.

> ⚠️ **REQUIRED SCHEMA ADDITION — please approve.** The approved schema (Step 17) has **no `ServiceArea` model** (the only `serviceAreas` is a JSON tag field on `TechnicianProfile`). This module's coverage-zone entity does not exist yet, so it introduces a **new `ServiceArea` table** — a deliberate schema change + migration, surfaced here rather than assumed. Add this model and migrate before using the module:
> ```prisma
> model ServiceArea {
>   id              String    @id @default(uuid()) @db.Uuid
>   name            String
>   centerLatitude  Decimal   @db.Decimal(9, 6) @map("center_latitude")
>   centerLongitude Decimal   @db.Decimal(9, 6) @map("center_longitude")
>   radiusKm        Decimal   @db.Decimal(6, 2) @map("radius_km")
>   isActive        Boolean   @default(true) @map("is_active")
>   createdAt       DateTime  @default(now()) @map("created_at")
>   updatedAt       DateTime  @updatedAt @map("updated_at")
>   deletedAt       DateTime? @map("deleted_at")
>   @@index([isActive])
>   @@map("service_areas")
> }
> ```
> Then `npx prisma migrate dev --name add_service_area`.

> **This closes the Bookings service-area seam.** Bookings (Step 21) validated bookings against `address.isServiceable`. That flag is now *computed* here from coverage zones at address create/update time (and via `recompute-coverage` when zones change). No change to Bookings needed.

> **Default address = `CustomerProfile.defaultAddressId`** (relation, `onDelete: SetNull`) — there is no `isDefault` column on `Address`. "Set default" updates the profile; `isDefault` in responses is derived. First address auto-becomes default; deleting the default promotes the most recent remaining address.

---

## Module Structure
```
src/modules/addresses/
├── addresses.module.ts
├── addresses.controller.ts          # /addresses
├── addresses.service.ts             # CRUD + default logic + geocode + coverage
├── geocoding.service.ts             # Google Maps Geocoding wrapper
├── dto/ create-address / update-address
└── interfaces/ geocode-result.interface

src/modules/service-areas/
├── service-areas.module.ts
├── service-areas.controller.ts      # /service-areas (admin)
├── service-areas.service.ts         # zone CRUD + checkCoverage + recompute
├── dto/ create-service-area / update-service-area / coverage-check
└── interfaces/ coverage-result.interface
```

## Geolocation Integration
- **GeocodingService** wraps `@googlemaps/google-maps-services-js`. Structured address → coordinates + `locationType`/`partialMatch`. 5s timeout; `ZERO_RESULTS` → `null` (rejected as unverifiable); transport/API error → `503`.
- **Coverage** is radius-based: each zone is a center + `radiusKm` (the distance limit). `checkCoverage(lat,lng)` returns `{ serviceable, nearestAreaId, nearestAreaName, distanceKm, radiusKm }` using haversine great-circle distance. Serviceable if the point is within any active zone's radius.
- Coordinates are stored on `Address.latitude/longitude` (`Decimal(9,6)`), never accepted from the client.

---

## Features → Endpoints

### Address Management (Customer)
| Feature | Method/Path |
|---|---|
| Create (geocoded + coverage-checked) | `POST /api/v1/addresses` |
| List own | `GET /api/v1/addresses` |
| Detail | `GET /api/v1/addresses/:id` |
| Coverage info (live) | `GET /api/v1/addresses/:id/coverage` |
| Update (re-geocode if location changed) | `PATCH /api/v1/addresses/:id` |
| Set default | `PATCH /api/v1/addresses/:id/default` |
| Delete (soft; promotes new default) | `DELETE /api/v1/addresses/:id` |

Admins (Super/Ops/Support) may `GET /api/v1/addresses?customerId=<id>` for support.

### Service Area Management (Super Admin / Ops)
| Feature | Method/Path |
|---|---|
| List | `GET /api/v1/service-areas` |
| Detail | `GET /api/v1/service-areas/:id` |
| Create | `POST /api/v1/service-areas` |
| Update | `PATCH /api/v1/service-areas/:id` |
| Enable / Disable | `PATCH /api/v1/service-areas/:id/activate` · `/deactivate` |
| Delete (soft) | `DELETE /api/v1/service-areas/:id` |
| Coverage check (coordinate) | `POST /api/v1/service-areas/coverage-check` |
| Recompute address coverage | `POST /api/v1/service-areas/recompute-coverage` |

## Authorization
- Addresses: `@Roles(CUSTOMER)` for own CRUD; admins read-only via `customerId`. Ownership enforced in the service (`loadOwned`).
- Service areas: `@Roles(SUPER_ADMIN, OPERATIONS_MANAGER)` (controller-level).

## Error Handling
- 400 — DTO validation; address unverifiable (geocode `ZERO_RESULTS`).
- 403 — wrong role / not owner.
- 404 — address/zone not found.
- 503 — geocoding service unavailable.

## Logging / Transaction Handling
- `Logger` records create/update/default/delete and zone changes (ids only; no access codes).
- Transactions guard: create-with-default, delete-with-promotion (and set-default is a single update). Geocoding happens before the transaction so external latency doesn't hold a DB transaction open.

---

## Setup Instructions
1. **Add the `ServiceArea` model** (above) and run the migration.
2. Place files under `src/modules/addresses/` and `src/modules/service-areas/`.
3. Install the Google Maps client: `npm i @googlemaps/google-maps-services-js`.
4. Register modules in `app.module.ts`: `ServiceAreasModule`, `AddressesModule` (AddressesModule imports ServiceAreasModule).
5. Add a `maps` + `serviceArea` config namespace:
   ```ts
   maps: { geocodingApiKey: process.env.GOOGLE_MAPS_GEOCODING_API_KEY },
   serviceArea: { openWhenUnset: process.env.SERVICE_AREA_OPEN_WHEN_UNSET === 'true' },
   ```
6. Requires Auth (guards/decorators), Users & Profiles (CustomerProfile), and the global `ValidationPipe`.
7. `accessNotes`/`gateCode` are sensitive — ensure the foundation's field-encryption layer covers these columns (schema marks them app-encrypted).

## Environment Variables
| Variable | Required | Example | Notes |
|---|---|---|---|
| `GOOGLE_MAPS_GEOCODING_API_KEY` | yes | `AIza…` | Geocoding API enabled; restrict by IP/referrer |
| `SERVICE_AREA_OPEN_WHEN_UNSET` | no | `false` | If `true`, everywhere is serviceable when no zones exist |
| `DATABASE_URL` | yes | — | Prisma |

## Testing Instructions
**Unit (mock Prisma/Geocoding/ServiceAreas):**
- create: geocode `null` → 400; first address → becomes default; `setDefault` → updates profile; serviceable derived from coverage.
- update: location field changed → re-geocodes; unchanged → no geocode call.
- remove: deleting default → promotes most recent; else default untouched.
- ServiceAreasService.checkCoverage: inside radius → serviceable; outside → not; no zones + `openWhenUnset` true/false.
- recomputeAllCoverage: flips `isServiceable` only where it changed.

**e2e (Supertest; mock geocoder or use a test key):**
```
POST /api/v1/service-areas {name,centerLatitude,centerLongitude,radiusKm}  (ops) → 201
POST /api/v1/addresses {line1,city,...}                                     (customer) → 201 (isServiceable computed)
PATCH /api/v1/addresses/:id/default                                          (customer) → default updated
GET  /api/v1/addresses/:id/coverage                                          (customer) → distance + serviceable
POST /api/v1/service-areas/coverage-check {latitude,longitude}               (ops) → result
POST /api/v1/service-areas/recompute-coverage                                (ops) → {updated:n}
```

---

## Example API Requests

**Create a coverage zone (ops)**
```
POST /api/v1/service-areas
Authorization: Bearer <ops token>

{ "name": "Metro North", "centerLatitude": 37.7749, "centerLongitude": -122.4194, "radiusKm": 25 }
```

**Add an address (customer)**
```
POST /api/v1/addresses
Authorization: Bearer <customer token>

{ "label": "Home", "line1": "1 Market St", "city": "San Francisco",
  "state": "CA", "postalCode": "94105", "country": "US", "setDefault": true }
```
```json
{ "id":"…","label":"Home","line1":"1 Market St","city":"San Francisco","state":"CA",
  "postalCode":"94105","country":"US","latitude":37.7937,"longitude":-122.3965,
  "isServiceable":true,"isDefault":true,"createdAt":"…" }
```

**Coverage check (ops tool)**
```
POST /api/v1/service-areas/coverage-check
Authorization: Bearer <ops token>

{ "latitude": 38.5, "longitude": -121.5 }
```
```json
{ "serviceable": false, "nearestAreaId":"…", "nearestAreaName":"Metro North",
  "distanceKm": 84.3, "radiusKm": 25, "reason":"Outside all coverage zones" }
```

---

**Stopping after the Address & Service Area module, per instruction.** No other modules generated. This resolves the long-open service-area input; remaining in the build order: **Payments** (financial/tax inputs) and **Reports** (compliance field set).
