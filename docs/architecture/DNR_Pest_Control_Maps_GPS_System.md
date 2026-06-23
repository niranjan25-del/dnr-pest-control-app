# DNR Pest Control — Maps, GPS Tracking & Route Management Design (Step 14)

**Product:** DNR Pest Control platform
**Builds on:** All prior approved steps (esp. DB (3) `technician_locations`/`addresses`, API (4) GPS endpoints, Technician/Admin/Customer modules)
**Tech:** Google Maps Platform · Google Directions API · Google Geocoding API · Flutter · NestJS · PostgreSQL
**Document type:** Geolocation & Route Management Design
**Version:** Draft 1.0
**Scope note:** Design only — flows, lifecycle, privacy, edge cases. **No code.**

> Scope reminder (PRD): **address geocoding + service-area validation + navigation hand-off are MVP-relevant**; **live technician tracking and route optimization are post-MVP**. This document designs the full system and labels live-tracking/optimization as *future*. A **status-based ETA fallback** (no continuous GPS) is specified for MVP.

> Privacy principle (overarching): location is captured **only during active jobs**, with explicit consent and clear purpose — never background-tracked off-shift.

---

# Maps & GPS System Overview

### Business objectives
- Efficient field operations (less travel time, more jobs/day) and accurate arrival/completion records.
- Reliable service-area enforcement at booking (no jobs DNR can't serve).
- Trust through transparency (customers see the technician coming).

### Customer benefits
- Know when the technician will arrive; track progress (future); arrival notifications.
- Accurate address capture reduces failed visits.

### Technician benefits
- Fast navigation hand-off; clear destinations with access info; ordered day (future optimized routes).
- Simple, advisory check-in/out — not punitive.

### Operational benefits
- Admin visibility into field activity (future live view), travel-time analytics, capacity/route planning.
- Defensible arrival/completion timestamps for disputes and payroll/utilization.

---

# Address Management

- **Address validation:** validate on entry (format + geocode resolves to a real location); flag unresolved/ambiguous.
- **Address autocomplete:** Google Places Autocomplete in the address form (customer + admin) → reduces typos, returns structured components + place_id.
- **Geocoding process:** convert address → lat/lng (Google Geocoding) on save; store `latitude`/`longitude` on `addresses` (Step 3). Used for service-area, distance fees, navigation, geofencing.
- **Reverse geocoding:** lat/lng → human address (e.g., from a map pin or technician location) when needed.
- **Invalid address handling:** if geocoding fails/low-confidence → prompt correction, allow manual pin placement, or flag "needs verification"; never silently accept an unlocatable service address.

> Cost/perf: cache geocoding results (addresses change rarely); use session tokens for Autocomplete to control billing.

---

# Service Area Management

- **Supported service zones:** defined as **polygons** (preferred) or zip/postal list or radius from base(s) — confirm method. Stored server-side; used to validate bookings.
- **Restricted areas:** explicitly excluded zones within a serviceable region.
- **Distance limits:** max distance/zone from base; beyond → distance fee (Step 12) or out-of-area.
- **Out-of-service-area workflow (from Customer Module):** at address selection/booking, validate against zones → if outside, **block booking** with a clear message, capture as a potential-expansion lead, and suggest contacting the office. Address can be saved but flagged "Not serviceable."

Validation runs server-side (authoritative); the app may pre-check for instant feedback.

---

# Technician Live Tracking *(future)*

- **Location update frequency:** adaptive — e.g., ~every 15–30s while `en_route`, lower while `in_progress`, **off** otherwise; reduce frequency on low battery/stationary. Batch uploads (`POST /technicians/me/location`).
- **Tracking lifecycle:** starts when tech sets `en_route`, continues through `arrived`/`in_progress`, **stops at completion**. No tracking outside active jobs.
- **Privacy controls:** explicit consent; visible "tracking active" indicator; only the **assigned customer** (during their active job) and **Admin** can see location.
- **Battery optimization:** adaptive sampling, batched/queued uploads, stop-when-stationary, OS background-location best practices; degrade gracefully if the OS throttles.

---

# Customer Tracking Experience

When the booking is `en_route`/`in_progress`:
- **View technician location:** map with technician marker + destination — `GET /bookings/{id}/technician-location` (latest point; future continuous).
- **View ETA:** computed via Directions API from technician location → address (future) or status-based estimate (MVP).
- **Track arrival progress:** simple progress ("On the way" → "Nearby" → "Arrived").
- **Arrival notifications:** push/SMS on en route and on arrival (geofence-driven, future; status-driven, MVP).
- **MVP fallback:** without live GPS, show status + window + (optional) last-known/ETA text — no continuous map.

---

# Route Optimization *(future)*

- **Daily route planning:** order a technician's jobs to minimize travel, honoring time windows.
- **Multiple job routing:** Directions API (waypoint optimization) across the day's stops.
- **Traffic considerations:** departure-time/traffic-aware ETAs.
- **Re-optimization logic:** recompute on changes (new urgent job, cancellation, running late); suggest reorder to tech/dispatch.
- **MVP:** manual order by time window; optimization deferred.

---

# ETA Calculation System

- **ETA updates:** (future) recompute from live location + traffic periodically and on status change; (MVP) coarse estimate from window + status.
- **Delay handling:** if ETA exceeds the window or a threshold → flag late; notify customer + Admin; offer reschedule if severe.
- **Customer notifications:** ETA on en route; "arriving soon" near destination (geofence, future); delay notice if running late.

---

# GPS Check-In Workflow

- **Arrival verification:** tech taps "Arrived" → sets `arrived`; optionally capture location stamp.
- **Distance validation:** compare arrival location to service address within a **tolerance** (e.g., ~100–150m) → **advisory** confidence flag; mismatch is noted, **not blocking** (signal/geocode imperfections).
- **Timestamp recording:** authoritative server arrival timestamp → `booking_status_history` + (optional) `technician_locations`.

---

# GPS Check-Out Workflow

- **Completion verification:** on report submit/complete, optionally capture location → confirm on/near site.
- **Location capture:** completion lat/lng stamped (advisory).
- **Audit trail:** arrival + completion timestamps/locations recorded immutably (status history + audit), strengthening dispute/chargeback evidence (ties to Step 12).

---

# Geofencing *(future, complements live tracking)*

- **Service location boundaries:** a geofence (radius) around the service address derived from geocoded coordinates.
- **Arrival detection:** entering the geofence can auto-prompt "Mark arrived" and fire customer "arriving/arrived" notification.
- **Departure detection:** exiting after completion can confirm check-out and stop tracking.
- All geofence events are **assistive prompts**, not hard gates; manual override always available.

---

# Admin Location Monitoring *(future for live; history available earlier)*

- **View active technicians:** live map of on-shift technicians and current jobs (future).
- **Monitor routes:** planned vs actual route per tech.
- **Review location history:** replay a technician's day from `technician_locations`.
- **Analyze travel time:** between jobs, vs estimates → efficiency insights.

---

# Location History

- **Storage strategy:** `technician_locations` time-series (Step 3) — high volume; **time-partitioned** (e.g., monthly); indexed by `(technician_id, recorded_at)`.
- **Retention policy:** **short** (e.g., 30–90 days) then purge or aggregate to summaries (travel time/distance), per Step 3 retention — confirm duration with privacy/policy.
- **Reporting capabilities:** travel time, distance traveled, on-time arrival, route efficiency (aggregated; raw points expire).

---

# Offline GPS Handling

- **Local storage:** location points and check-in/out captured offline stored on-device (Drift, Step 7) with client timestamps.
- **Sync process:** on reconnect, batch-upload points and status/location stamps; idempotent; server assigns authoritative server-time where needed.
- **Missing location recovery:** if GPS was unavailable, proceed without it (advisory only); record "location unavailable"; never block job flow. Gaps in the track are acceptable and labeled.

Consistent with the Technician offline-first principle (Steps 2/10): location is a nice-to-have signal, never a blocker.

---

# Security & Privacy

- **Location permissions:** request OS permission with clear rationale; prefer **while-in-use**; background only if live tracking is enabled and consented; handle denial gracefully (manual check-in still works).
- **User consent:** explicit technician consent to on-shift tracking; customers informed when viewing a technician's live location; "tracking active" indicator.
- **Data protection:** location data restricted (assigned customer during active job + Admin); encrypted at rest; private; no location in logs/analytics beyond aggregates; signed access.
- **Retention rules:** short-lived raw points + purge/aggregate (above); honor deletion requests; document in privacy policy.
- **Minimization:** capture only during active jobs; lowest frequency that meets the need.

---

# Analytics & KPIs

| KPI | Source/derivation |
|---|---|
| Travel time | between consecutive job arrival/departure stamps |
| Arrival accuracy | arrival within window / total |
| Distance traveled | from location track / Directions |
| Route efficiency | actual vs optimized travel time/distance |
| Missed appointments | no_show / total |
| On-time % | arrival ≤ window end |

(Aggregated; raw points retained short-term; no PII beyond ids.)

---

# Edge Cases

| Case | Behavior |
|---|---|
| **GPS disabled** | Allow manual check-in/out; advisory flags omitted; prompt to enable but never block |
| **Poor signal** | Use last-known; queue points; tolerant distance check; label uncertainty |
| **Wrong location** (drift/spoof) | Advisory mismatch flag; manual override; spoof-detection (future); never sole basis for completion |
| **Technician off-route** | (Future) flag deviation to dispatch; not punitive; could indicate detour/traffic |
| **Device offline** | Full offline capture + later sync (idempotent); gaps acceptable |
| **Geocoding failure** | Prompt correction / manual pin; flag "needs verification"; block booking only if address truly unlocatable |
| **Customer address inaccurate** | Tech can adjust pin / add note; reverse-geocode to confirm; feed correction back |
| **Battery drain complaints** | Adaptive frequency, stop-when-stationary, batching; user-visible tracking state |

---

# Maps & GPS System Review

### 1. Risks
| Risk | Severity | Note |
|---|---|---|
| **Live tracking battery/OS background limits** | Medium–High | Adaptive sampling + batching + while-in-use bias; test across devices/OS versions |
| **Google Maps Platform cost** | Medium | Autocomplete session tokens, geocoding caching, frequency tuning, quotas/budget alerts |
| **Service-area definition method undefined** | Medium–High | Polygons vs zip vs radius must be decided (also a Customer-Module open item) |
| **GPS reliability / spoofing** | Medium | Keep advisory; never block completion; spoof detection future |
| **Location privacy/consent compliance** | Medium | Clear consent, minimization, retention; regional rules |
| **Scope creep (live tracking/optimization in MVP)** | Medium | Keep post-MVP; ship status-based fallback first |

### 2. Recommendations
1. **MVP: geocoding + service-area validation + navigation hand-off + status-based ETA.** Defer live tracking, geofencing, and route optimization.
2. **Define the service-area model** (recommend **polygons** for accuracy) — unblocks booking validation (shared open item with Customer Module).
3. **Keep all GPS checks advisory**; never gate completion or payment on location.
4. **Control Maps costs** early: caching, session tokens, frequency limits, quota/budget alerts.
5. **Design live tracking for battery** from day one (adaptive, batched, while-in-use) when it ships.
6. **Lock consent + retention** for location and reflect in the privacy policy.
7. **Use arrival/completion stamps as dispute evidence** (with report + signature, Step 12).

### 3. Missing requirements (to be supplied)
- **Service-area definition** (polygon/zip/radius + the actual zones) — top item, shared with Customer Module.
- **Distance-fee thresholds/zones** (ties to Step 12 pricing).
- **Live-tracking MVP decision** (confirm post-MVP) + update frequency targets.
- **Location retention duration** + privacy-policy language + regional consent rules.
- **Arrival tolerance** distance and whether check-in/out location capture is desired for MVP.
- Google Maps Platform **API keys + billing/quota** setup per environment.

### 4. Readiness score before UI Design System Finalization
**8.5 / 10 — Ready to proceed to UI Design System Finalization.**
The geolocation/route system is comprehensively specified, integrates cleanly with the data model, APIs, and role modules, and is correctly scoped (MVP essentials vs future live-tracking/optimization). UI finalization can proceed now. The **service-area model** and **location consent/retention** should be confirmed before geolocation **implementation**; resolving them lifts this to ~9.5/10.

*Next step on approval: UI Design System Finalization.*
