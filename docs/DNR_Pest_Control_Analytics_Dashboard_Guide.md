# DNR Pest Control — Reports & Analytics Dashboard (Step 43)

Business-intelligence layer for the admin dashboard. Builds on the React Foundation (41) + Management Modules (42) + the Analytics backend (Step 34). Executive KPIs, seven domain analytics views, a report catalog with CSV/PDF export, shared filters, and a reusable Recharts chart kit. Production-ready, TypeScript throughout.

> **Chart library:** **Recharts** — requested and a strong fit (declarative, responsive `ResponsiveContainer`, covers line/bar/pie cleanly). Alternatives if more bespoke viz is needed later: **nivo** (richer defaults) or **visx** (low-level/D3 control). Added to `package.json`.

> **Large datasets:** handled by **server-side aggregation** — the `/analytics/*` endpoints return pre-aggregated totals + time series + breakdowns keyed by the filter range, so the client renders bounded series, never raw rows. The technician leaderboard (already bounded) sorts/paginates client-side; everything else is server-shaped. The backend guide also notes materialized views + read-replica options for scale.

> **Reconciliations (flagged honestly):**
> - **Field-name tolerance:** the analytics mappers parse defensively (e.g. `new`/`new_customers`, `series`/`time_series`, `churn_rate`/`churn_rate_pct`) because a few response field names are confirm items. Tighten `api.ts` once the response shapes are pinned.
> - **Reschedule trend** and **on-time %** are `null` in the backend — surfaced as explicit "not tracked yet" notes rather than fake zeros.
> - **Churn/renewal** are proxy metrics (no subscription state-transition history) — labeled as such.
> - **LTV** shown only if the API returns it; otherwise "N/A".
> - **service/technician/region filters** are passed through to all endpoints; confirm which honor cross-filters server-side (revenue-by-service is inherent).

---

## Folder Structure
```
src/components/charts/index.tsx     KpiCard · ChartCard (loading/empty/error + ResponsiveContainer) · Line/Bar/Pie wrappers · color hook
src/features/
├── analytics/
│   ├── types.ts            Granularity, filters, metric DTOs
│   ├── api.ts              /analytics/* calls with defensive mapping
│   ├── hooks.ts            per-domain query hooks (60s staleTime ≈ backend cache)
│   ├── filters.tsx         useAnalyticsFilters (URL-synced) + AnalyticsFiltersBar (presets/range/granularity/region)
│   ├── AnalyticsLayout.tsx tab nav + shared filter bar + <Outlet>
│   ├── ExecutiveDashboardPage.tsx
│   ├── RevenueAnalyticsPage.tsx
│   ├── BookingAnalyticsPage.tsx
│   ├── CustomerAnalyticsPage.tsx
│   ├── TechnicianAnalyticsPage.tsx
│   └── SubscriptionReviewPages.tsx   (Subscription + Review)
├── reports/ReportsPage.tsx          report catalog → CSV/PDF export
└── exports/exportService.ts         client CSV + server CSV/PDF blob download
```

## Executive Dashboard
Six headline KPIs (revenue MTD, bookings today, active customers MTD, completed jobs MTD, active subscriptions, avg rating) + monthly growth & retention (shown when provided), plus revenue and booking trend lines.

## Domain views
- **Revenue:** total + trend (granularity-driven), revenue-by-service donut, revenue-by-technician top-10 bar.
- **Bookings:** totals (total/completed/cancelled/no-show), booking trend, status breakdown, cancellation trend; reschedule flagged.
- **Customers:** new/active/retention/LTV + acquisition trend.
- **Technicians:** revenue top-10 bar + sortable/paginated performance leaderboard (jobs, rating, revenue).
- **Subscriptions:** active/renewal/churn + optional active-over-time; proxy note.
- **Reviews:** average rating + rating trend (satisfaction).

## Filters
`useAnalyticsFilters` keeps date range (with 7D/30D/90D/12M presets), granularity (DAY/WEEK/MONTH/YEAR), and service/technician/region in the URL — shareable, and preserved across analytics tabs. All hooks key on the filter object, so changing a filter refetches just-that-combination and caches it.

## Charts
Reusable kit: `KpiCard`, `ChartCard` (owns loading skeleton / empty / error+retry and a fixed-height `ResponsiveContainer`), and `LineSeriesChart` / `BarSeriesChart` / `PieBreakdownChart`. Colors derive from the MUI theme so light/dark stay consistent.

## Reports & Export
`ReportsPage` lists report types (Revenue, Bookings, Technicians, Customers, Subscriptions); each exports **CSV or PDF** via `GET /analytics/export` (server-rendered, audited). `exportService` also offers a dependency-free client-side `downloadCsv` for exporting any on-screen dataset.

## API / Errors / Loading / Responsive
Calls go through the foundation axios client (auth refresh + `ApiError` normalization inherited). Every chart card renders its own loading/empty/error state with retry; KPI cards skeleton while loading. Layout is responsive via MUI `Grid` breakpoints (KPIs reflow 2→4 up, charts stack on mobile) and `ResponsiveContainer` for charts. RBAC: Analytics gated by `ViewDashboard`, Reports by `ComplianceExport`.

---

## Setup Instructions
1. `npm install` (picks up `recharts`).
2. Routes are wired in `routes/router.tsx` (`/analytics` tabbed section + `/reports`); sidebar now shows **Analytics** and **Reports**.
3. Ensure the backend `/analytics/*` + `/analytics/export` endpoints are reachable; confirm the flagged field names / cross-filters.
4. `npm run dev` → sign in as Super Admin or Ops Manager (the analytics endpoints are `@Roles(SUPER_ADMIN, OPERATIONS_MANAGER)`).

## Testing Instructions
- **Unit:** `useAnalyticsFilters` (defaults, presets, URL sync); `api.ts` mappers (field-name fallbacks, numeric coercion, empty arrays); `exportService.downloadCsv` (escaping commas/quotes/newlines).
- **Component:** `ChartCard` loading/empty/error/retry; `KpiCard` delta sign/color; technician leaderboard sort + paginate.
- **Integration (MSW or backend):** changing the date range refetches all visible charts; revenue donut + technician bar render from real aggregates; CSV/PDF export downloads a file; a non-admin (Dispatcher) is redirected from `/analytics` to `/403`.

---

**Stopping after the Analytics Dashboard, per instruction** (no testing/deployment modules). Still open elsewhere: the remaining admin management modules (Services, Pricing, Subscriptions, Coupons, Notifications — Wave 2) and the Flutter **Mobile App Integration (Step 40)** finish.
