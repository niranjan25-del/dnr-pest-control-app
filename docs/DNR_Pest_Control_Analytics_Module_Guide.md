## DNR Pest Control — Analytics & Reporting Module (Step 34)

**Module:** `analytics` (NestJS) — production-ready
**Builds on:** Prisma schema (17) · Auth (18) · Bookings (21) · Payments (24) · Invoices (25) · Subscriptions (26) · Reviews (31) · Service Reports (33)
**Tech:** NestJS · Prisma · PostgreSQL · PDFKit (export)
**Scope:** Analytics ONLY. No other modules generated. **No schema changes** — this module is read-only over existing data.

> **Honest metric caveats (surfaced, not faked):**
> - **Rescheduled bookings** — `BookingStatus` has no `RESCHEDULED` and there's no reschedule counter → returned `null`. To track it, add a status/flag or mine `AuditLog` for booking time changes.
> - **On-time arrival %** — no persisted arrival-vs-scheduled timestamp → `null`. The GPS module emits an arrival event; persist an `arrivedAt` (on Booking or an arrivals table) to compute this.
> - **Churn / renewal rate** — computed as `updatedAt`-based proxies (no status-transition history). Labeled in the response; for exact cohorts, record subscription state transitions (e.g. via AuditLog or a status-history table).

---

## Module Structure
```
src/modules/analytics/
├── analytics.module.ts
├── analytics.controller.ts   # admin-only: per-domain endpoints + KPIs + export
├── analytics.service.ts      # metrics (aggregate/groupBy + raw date_trunc series)
├── reports.service.ts        # compose metrics into tabular/dashboard shapes
├── export.service.ts         # CSV + PDF rendering
├── enums/ analytics.enums.ts # Granularity, ReportType, ExportFormat, roles, trunc map
└── dto/ date-range · export-report
```

## Metrics → Endpoints (all `@Roles(SUPER_ADMIN, OPERATIONS_MANAGER)`)
| Domain | Path | Includes |
|---|---|---|
| Dashboard KPIs | `GET /api/v1/analytics/kpis` | revenue MTD, bookings today, active subs, avg rating, active customers MTD, completed jobs MTD (cached 60s) |
| Revenue | `GET /api/v1/analytics/revenue` | total, time series (day/week/month/year), revenue by service |
| Bookings | `GET /api/v1/analytics/bookings` | total, completed, cancelled, no-show, by-status (rescheduled = null) |
| Customers | `GET /api/v1/analytics/customers` | new, active, retention % |
| Technicians | `GET /api/v1/analytics/technicians` | jobs completed, avg rating, revenue generated (on-time % = null) |
| Services | `GET /api/v1/analytics/services` | most popular, revenue by service, booking trend |
| Subscriptions | `GET /api/v1/analytics/subscriptions` | active, churn rate, renewal rate (proxies) |
| Reviews | `GET /api/v1/analytics/reviews` | average rating, monthly trend |
| Export | `GET /api/v1/analytics/export?reportType=&format=&from=&to=&granularity=` | CSV or PDF |

All accept `from`/`to` (ISO) + `granularity` (DAY/WEEK/MONTH/YEAR); default range = last 12 months.

## Query Optimization Strategy
- **Single round trips:** Prisma `aggregate`/`groupBy` for totals + status/rating rollups.
- **Time series via parameterized raw SQL** using `date_trunc(unit, created_at)` — the one thing Prisma can't express — with the unit both whitelisted and bound (no injection). Sums cast to text to preserve `numeric` precision; counts cast to `int`.
- **KPIs run in parallel** (`Promise.all`) and are cached 60s.
- **Lean money path:** revenue from SUCCEEDED `payments` (authoritative cash); revenue-by-service from PAID `invoices` joined to `booking.service_id` (subscription invoices bucket as "Subscription").

## Reporting Strategy
`AnalyticsService` computes metrics; `ReportsService` flattens them to `{title, headers, rows}` (CSV) or a multi-section `dashboard` object (PDF); `ExportService` renders. This separation keeps SQL out of presentation and makes new report types a small addition.

## Caching Recommendations
- KPIs cached in-memory 60s here — **move to Redis** for multi-node so all instances share it.
- For heavy dashboards at scale, back the time-series + leaderboards with **materialized views** refreshed on a schedule (e.g. `mv_daily_revenue`, `mv_technician_perf`) and query those; or run analytics against a **read replica** to isolate load from transactional traffic.
- Recommended indexes (most already present): `payments(status, created_at)`, `bookings(status, created_at)`, `bookings(service_id)`, `invoices(status, created_at)`, `reviews(is_published, technician_id)`, `subscriptions(status)`.

## Security Considerations
- **Admin-only** (class-level `@Roles`); no row-level PII returned — only aggregates (technician leaderboard uses ids + names already visible to admins).
- **Exports are audit-logged** (`AuditLog` action `analytics.exported`: who pulled what).
- All raw SQL is **parameterized** (tagged templates) — values are never string-concatenated; the `date_trunc` unit is whitelisted.

## Error Handling / Logging
- 400 — invalid range (`from > to`) / bad enum (DTO).
- 403 — non-admin.
- `Logger` for diagnostics; `AuditLog` for export trail.

---

## Setup Instructions
1. `npm i pdfkit` (present from Invoices/Service Reports) — no other deps.
2. Register `AnalyticsModule` in `app.module.ts`.
3. Optional: create the materialized views + indexes above for scale; swap the KPI cache for Redis.
4. Config reused: `company.name` (PDF header).

## Testing Instructions
**Unit (mock Prisma):**
- bounds: default 12-month range; `from > to` → error.
- revenue: total from SUCCEEDED only; series buckets by granularity; byService labels subscription invoices.
- bookings: byStatus rollup; rescheduled null.
- customers: retention = returning/base; zero-base → 0.
- technicians: merges perf + ratings + names; on-time null.
- subscriptions: churn/renewal proxy math; zero-denominator guards.
- kpis: parallel; cached within TTL (second call doesn't re-query).

**Integration:** seed payments/bookings/reviews across months → assert series totals and KPI values; `export?format=CSV` returns valid CSV; `format=PDF` returns a non-empty PDF; export writes an AuditLog row.

---

## Example API Requests

**Dashboard KPIs**
```
GET /api/v1/analytics/kpis
Authorization: Bearer <ops token>
→ { revenueThisMonth, bookingsToday, activeSubscriptions, averageRating, activeCustomersThisMonth, completedJobsThisMonth }
```

**Monthly revenue + by service**
```
GET /api/v1/analytics/revenue?from=2026-01-01&to=2026-06-01&granularity=MONTH
→ { total, paymentCount, series:[{bucket,total}], byService:[{service,total}] }
```

**Technician performance**
```
GET /api/v1/analytics/technicians?from=2026-01-01&to=2026-06-01
→ [ { technicianId, name, jobsCompleted, averageRating, reviewCount, revenueGenerated, onTimeArrivalPct:null } ]
```

**Export (CSV / PDF)**
```
GET /api/v1/analytics/export?reportType=REVENUE&format=CSV&granularity=MONTH
GET /api/v1/analytics/export?reportType=DASHBOARD&format=PDF
Authorization: Bearer <ops token>
```

---

**Stopping after the Analytics & Reporting module, per instruction.** This is the reporting layer over the full platform; it changes no schema and reads existing data. Note the three flagged metric caveats (rescheduled, on-time %, churn/renewal exactness), each with a clear path to precision if you want it.
