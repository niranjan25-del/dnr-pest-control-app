## DNR Pest Control — GPS Tracking & Location Module (Step 32)

**Module:** `location` (NestJS) — production-ready
**Builds on:** Prisma schema (17) · Auth (18) · Users & Profiles (19) · Bookings (21) · Dispatch (22) · Addresses & Service Areas (23) · Maps/GPS design (15)
**Tech:** NestJS · Prisma · PostgreSQL · **Google Maps (Distance Matrix)** · **Socket.IO**
**Scope:** Location ONLY. No other modules generated.

> **In-schema already:** `TechnicianLocation` (append-only pings: technicianId, optional bookingId, lat/lng, recordedAt; time-series indexed) and `Address.latitude/longitude` (geofence target). History, route tracking, and ETA work against these with **no migration**.

> ⚠️ **RECOMMENDED SCHEMA ADDITION (for live status + admin dashboard) — please approve.** There's no durable current-state. In-memory status won't survive restarts or work across nodes, and the admin "monitor active technicians" view needs queryable state:
> ```prisma
> // add to model TechnicianProfile:
>   locationStatus String?   @map("location_status")  // OFFLINE|AVAILABLE|TRAVELING|ARRIVED|WORKING|COMPLETED
>   lastLat        Decimal?  @db.Decimal(9, 6) @map("last_lat")
>   lastLng        Decimal?  @db.Decimal(9, 6) @map("last_lng")
>   lastSeenAt     DateTime? @map("last_seen_at")
>   @@index([locationStatus])
> ```
> `prisma migrate dev --name technician_location_snapshot`. Pings/history/ETA/geofencing all work without this; the live-status + dashboard features need it.

> **Reconciliation:** the 6 statuses aren't a DB enum — stored as a string snapshot and derived from assignment state + geofence + connectivity (OFFLINE on disconnect, AVAILABLE when online with no job, TRAVELING with an active job, ARRIVED inside the geofence, WORKING after check-in, COMPLETED after check-out).

---

## Module Structure
```
src/modules/location/
├── location.module.ts
├── location.controller.ts   # ping fallback, check-in/out, customer track + ETA, admin monitor/audit
├── location.gateway.ts      # Socket.IO live pings + booking tracking rooms
├── location.service.ts      # ingest (throttle+persist+geofence+status), check-in/out, history, retention
├── geofence.service.ts      # haversine distance + within-radius (pure, cheap per ping)
├── eta.service.ts           # Google Distance Matrix ETA + short cache
├── enums/ location-status.ts
└── dto/ update-location · check-in · check-out · query-history
```

## Live Location Updates
Technician streams pings over WS (`location:update`) or REST (`POST /location/ping`). The server **throttles** (min interval), persists a `TechnicianLocation`, runs the geofence check, updates the status snapshot, and broadcasts position (+ARRIVED) to the booking's tracking room.

## GPS Check-In / Check-Out
- **Check-in** (`POST /location/check-in`): must be the assigned technician AND within the job-site geofence → status WORKING, emits `technician.checked_in`.
- **Check-out** (`POST /location/check-out`): status COMPLETED, emits `technician.checked_out`. Live broadcasting stops once completed.

## Geofencing
`GeofenceService` uses haversine distance against `Address.lat/lng` with a configurable radius (default 150 m). Entering the radius auto-transitions TRAVELING → ARRIVED and emits `location.arrived` once (the Notifications module can turn this into a customer alert).

## ETA Logic
`EtaService` calls Google **Distance Matrix** with `departure_time=now` (live traffic), returning duration + distance + an ISO arrival estimate. Results are cached per rounded origin/destination for a short TTL — Maps is called **on demand**, never per ping (cost + battery).

## Statuses
OFFLINE · AVAILABLE · TRAVELING · ARRIVED · WORKING · COMPLETED (snapshot string; see migration).

## WebSocket Events
| Event | Direction | Payload |
|---|---|---|
| `connection` | — | JWT in `handshake.auth.token` |
| `track:join` / `:leave` | C→S | `{ bookingId }` (join is ownership-checked) |
| `location:update` | Tech→S | `UpdateLocationDto` → throttled/persisted/broadcast |
| `location:technician` | S→C | `{ bookingId, latitude, longitude, status, recordedAt }` |
| `location:arrived` | S→C | `{ bookingId }` |
| `location:error` | S→C | auth/validation errors |

Namespace `/location`; room `booking-track:<id>`.

## Features → Endpoints
| Feature | Method/Path | Roles |
|---|---|---|
| Ping (REST fallback) | `POST /api/v1/location/ping` | Technician |
| Check-in / Check-out | `POST /api/v1/location/check-in` · `/check-out` | Technician |
| Track technician + ETA | `GET /api/v1/location/bookings/:id/technician` | Customer (own) / admin |
| ETA | `GET /api/v1/location/bookings/:id/eta` | Customer (own) / admin |
| Route history | `GET /api/v1/location/bookings/:id/history` | Customer (own) / admin |
| Active technicians | `GET /api/v1/location/active` | Super/Ops/Dispatcher |
| Technician audit history | `GET /api/v1/location/technicians/:id/history` | Super/Ops/Dispatcher |

## Security / Privacy / Retention
- **Permissions:** only the assigned technician may publish a booking's location; only that booking's **customer** (or an admin) may track it; admins-only for the dashboard + audit.
- **Privacy by job state:** live location is exposed to the customer **only while the job is active** (EN_ROUTE/ARRIVED/IN_PROGRESS/CONFIRMED); never before assignment or after completion.
- **Data retention:** a daily cron purges `TechnicianLocation` pings older than `LOCATION_RETENTION_DAYS` (default 30) — privacy + cost. Pairs with the schema's time-partitioning suggestion.
- **Audit:** admin access to raw technician history is logged.

## Error Handling / Logging
- 400 — check-in outside the geofence; bad coordinates (DTO).
- 403 — not assigned / not your booking / non-admin dashboard access.
- 404 — booking not found.
- WS → `location:error`; bad auth disconnects.
- `Logger` records check-in/out, arrivals, retention purges, and audit reads.

## Scaling Strategy
- **Server-side throttle** caps write/broadcast rate per technician; clients use an **adaptive cadence** (faster while moving/near site, slower when idle) — set the throttle (Redis-backed for multi-node).
- **WS horizontal scaling** via the same Redis Socket.IO adapter as Chat.
- **High-volume pings:** `technician_locations` is a candidate for **monthly time-partitioning + short retention** (schema notes this). At very high scale, ingest pings through a stream/queue (Kinesis/Redis) and batch-write.
- **Snapshot columns** keep the dashboard a cheap indexed query rather than scanning the ping history.

---

## Setup Instructions
1. `npm i @nestjs/websockets @nestjs/platform-socket.io socket.io @googlemaps/google-maps-services-js` (most present from Chat/Addresses).
2. Apply the snapshot-column migration (above) for live status + dashboard.
3. Ensure `EventEmitterModule.forRoot()` + `ScheduleModule.forRoot()` are registered (foundation).
4. Register `LocationModule` in `app.module.ts`. (For multi-node WS, enable the Redis adapter from the Chat module.)
5. Add config:
   ```ts
   location: {
     geofenceRadiusMeters: Number(process.env.GEOFENCE_RADIUS_M ?? 150),
     minPingIntervalMs: Number(process.env.LOCATION_MIN_PING_MS ?? 5000),
     etaCacheMs: Number(process.env.LOCATION_ETA_CACHE_MS ?? 30000),
     retentionDays: Number(process.env.LOCATION_RETENTION_DAYS ?? 30),
   }
   // reuses maps.apiKey + jwt.accessSecret
   ```

## Google Maps Configuration
- Enable the **Distance Matrix API** (and Directions if you later draw routes) on the same key used by Addresses (Step 23).
- Restrict the key (API + server IP) and set quotas/billing alerts; ETA caching keeps call volume down.

## Environment Variables
| Variable | Required | Notes |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` (`maps.apiKey`) | yes | Distance Matrix |
| `JWT_ACCESS_SECRET` | yes | socket auth |
| `GEOFENCE_RADIUS_M` | no | default 150 |
| `LOCATION_MIN_PING_MS` | no | server throttle (default 5000) |
| `LOCATION_ETA_CACHE_MS` | no | default 30000 |
| `LOCATION_RETENTION_DAYS` | no | ping retention (default 30) |

## Testing Instructions
**Unit (mock Prisma/Maps):**
- geofence: distance correctness; within/outside radius.
- recordPing: throttled within interval → null; persists ping; inside geofence → ARRIVED + arrival event once.
- checkIn: not assigned → 403; outside geofence → 400; success → WORKING.
- trackForCustomer: non-owner → 403; non-active booking → `{trackable:false}`; active → location + ETA.
- purgeOldLocations: deletes only pings older than retention.

**Integration:** socket client as a technician emits `location:update`; a customer socket joined to `track:join` receives `location:technician`; crossing into the geofence emits `location:arrived`. ETA against Maps test key.

---

## Example API Requests

**Technician ping (REST fallback)**
```
POST /api/v1/location/ping
Authorization: Bearer <technician token>

{ "bookingId": "<uuid>", "latitude": 13.0827, "longitude": 80.2707 }
```

**Customer tracks technician + ETA**
```
GET /api/v1/location/bookings/<uuid>/technician
Authorization: Bearer <customer token>
→ { "trackable": true, "location": { "latitude":13.08,"longitude":80.27,"recordedAt":"..." },
    "eta": { "durationSeconds": 540, "distanceMeters": 3200, "etaAt": "2026-06-03T10:09:00Z" } }
```

**Check in at the job site**
```
POST /api/v1/location/check-in
Authorization: Bearer <technician token>

{ "bookingId": "<uuid>", "latitude": 13.0827, "longitude": 80.2707 }
```

**Admin: active technicians**
```
GET /api/v1/location/active
Authorization: Bearer <dispatcher token>
→ [ { "technicianId":"...","name":"...","status":"TRAVELING","location":{...},"lastSeenAt":"..." } ]
```

---

**Stopping after the GPS Tracking & Location module, per instruction.** No other modules generated. The remaining backend piece is **Service Reports** (incl. the append-only `ChemicalApplication` compliance table — still pending the jurisdiction-specific pesticide field set), plus an optional **Admin/Audit** module.
