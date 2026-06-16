# DNR Pest Control — Performance & Scalability Assessment

**Classification:** Internal Engineering Review
**Scope:** NestJS backend, PostgreSQL/Prisma, Flutter app, React admin dashboard, analytics, AWS
**Method:** Architecture + source review of the delivered codebase and schema, mapped to production-scale workloads. Findings cite real code/schema where verified; scale projections are modeled estimates, flagged as such.

---

## Executive Summary

The platform is **well-engineered for correctness and is scale-*aware* in design, but not yet scale-*wired*.** The database is thoroughly indexed (82 indexes across 31 models, including purpose-built composites like `bookings(status, scheduledWindowStart)` for the dispatch board and `payments(providerTransactionId)` for webhook lookups). Hot external calls (Maps/ETA) are already throttled and cache-friendly. The code is explicitly "Redis-ready" in the right places.

The gap is that the **scale-critical infrastructure is designed but not deployed/wired**: no Redis (so the analytics cache is per-node and there's no shared cache, session cache, or shared rate limiter); chat presence + rate limiting live in **in-memory `Map`s** and the Socket.IO **Redis adapter is pluggable but unwired**, so real-time features are effectively **single-node**; high-frequency **GPS pings** write straight to Postgres (the top write hotspot at scale); and bulk **notifications** have no queue/worker fan-out.

**Performance Readiness Score: 70 / 100** — comfortable for an initial launch (~1k users), but the path to 10k/100k depends on the roadmap below. None of the gaps require redesign; they are infrastructure-wiring and a few query/pattern changes.

---

## 1. Backend Performance Review

**API response times** — Most endpoints are simple indexed reads/writes; expected p95 is low under modest load. The risks are: (a) **analytics endpoints** run heavy `groupBy` + `date_trunc` raw SQL on the transactional DB (compete with OLTP); (b) **list endpoints** use **offset pagination** (`page`/`limit`), which degrades on deep pages of large tables; (c) **synchronous fan-out** (announcements) blocks request threads.

**Service architecture** — Clean modular NestJS; stateless request handling **except** chat presence/rate-limit (in-memory) — the one thing blocking horizontal scale. Once those move to Redis and the app is stateless, it scales horizontally behind an ALB cleanly.

**Database access patterns** — Generally good (indexed lookups, owner-scoped `where`). Watch for **N+1** on list endpoints that `include` customer/service/technician/address per booking — verify Prisma uses a single `include`/`select` projection rather than per-row fetches, and select only needed columns.

---

## 2. Database Optimization

**Indexes** — *Strong.* Verified coverage on the hot paths: `bookings(status)`, `(scheduledWindowStart)`, composite `(status, scheduledWindowStart)`, `(subscriptionId)`; `payments(invoiceId)`, `(status)`, `(providerTransactionId)`; `invoices(customerId/status/dueDate)`; `messages(conversationId, createdAt)`; `notifications(userId, readAt)`; `reviews(technicianId/rating/isPublished)`; geo `address(latitude, longitude)`.

**Recommended additions / improvements**
- **Partial indexes for soft-deletes:** most models carry `deletedAt` and an index on it, but hot queries filter `deletedAt IS NULL`. Convert hot-path indexes to **partial** (`WHERE deleted_at IS NULL`) to shrink them and speed scans.
- **Covering composites for analytics:** `payments(status, created_at)` and `invoices(status, created_at)` to serve revenue rollups index-only (confirm both exist; add if not).
- **Keyset pagination** for high-volume lists (bookings, messages, notifications, payments): replace `OFFSET` with `WHERE (created_at, id) < (:cursor)` ordering — O(1) deep pages instead of O(n).
- **Geo:** the `(latitude, longitude)` btree is fine for bounding-box; for true nearest-technician dispatch at scale, consider **PostGIS** (`GEOGRAPHY` + GiST) or Redis GEO.

**Reporting workloads / partitioning**
- **Read replica** for all `/analytics/*` queries — isolate OLAP from OLTP.
- **Materialized views** (`mv_daily_revenue`, `mv_technician_perf`) refreshed on a schedule; query those instead of live aggregation (already recommended in the analytics design).
- **Time partitioning** for append-only high-growth tables: **location pings**, **chat messages**, **notifications**, **booking status history** — partition by month; archive/drop old partitions cheaply.

---

## 3. Caching Strategy

Currently: a **60s in-memory** KPI cache only (per-node — inconsistent across instances, lost on deploy). **No Redis.**

| Layer | Recommendation |
|---|---|
| **Redis (foundational)** | Deploy ElastiCache Redis — unlocks everything below and makes the app stateless. |
| **Query/result cache** | Move the analytics KPI cache to Redis (shared, surviving deploys); cache materialized-view reads. |
| **API cache** | Cache idempotent reads (service catalog, service areas, packages) with short TTL + event-based invalidation. CloudFront/edge cache for truly public GETs. |
| **Session/auth** | Refresh-token lookups + a fast revocation deny-list in Redis; shared rate-limit counters. |
| **Presence/real-time** | Chat presence + Socket.IO pub/sub in Redis (see §9). |

---

## 4. Flutter Performance Review

- **Widget rebuilds:** use `ref.watch(provider.select(...))` to subscribe to slices, `const` constructors everywhere, and split large screens so a single state change doesn't rebuild the tree.
- **State management:** Riverpod `autoDispose` for screen-scoped providers (prevents leaks); avoid rebuilding lists on unrelated state.
- **List performance:** ensure **`ListView.builder`/`SliverList`** (lazy) for bookings/chat/notifications — never `ListView(children: [...])` for unbounded data; add pagination/infinite scroll backed by keyset endpoints; use `itemExtent`/`prototypeItem` where possible.
- **Image loading:** `cached_network_image` is in place (good) — pair it with **server-side thumbnails/responsive sizes** (don't download full-res for avatars/list thumbs), `memCacheWidth`, and placeholders to avoid jank.

---

## 5. React Dashboard Performance Review

- **Large tables:** the `DataTable` is **server-side** (pagination/sort/filter) — correct and already scalable. If any view ever renders thousands of client rows, add row virtualization (TanStack Virtual).
- **Charts:** analytics charts render **pre-aggregated** server series (bounded) — good. Keep buckets capped (e.g. ≤365 points) and memoize chart data.
- **Data fetching:** TanStack Query gives caching + dedupe; set sensible `staleTime` (analytics already 60s), use `placeholderData` to avoid flicker (already done), and prefetch detail on row hover.
- **Pagination:** server-driven via `useServerTable` — good; move to keyset for very deep datasets.

---

## 6. File Storage Optimization (S3 / CloudFront)

- **S3 usage:** presigned, namespaced uploads — good. Add **lifecycle policies** (transition old media + archived pings/messages to IA/Glacier) and enforce size caps at the policy.
- **Image optimization:** generate **thumbnails + responsive variants** on upload (Lambda) and serve **WebP/AVIF**; strip EXIF (also a security win). This is the single biggest mobile-bandwidth and cost lever.
- **CDN:** serve all media via **CloudFront (OAC)** with long cache TTLs + compression; never hit S3 directly from clients. Cache hit-ratio directly cuts S3 GET + egress cost.

---

## 7. Notification System Performance

Risk: **synchronous fan-out** for announcements (loop over users → FCM/SMS/email inline) blocks requests and hits provider rate limits. **Recommendations:** enqueue to **SQS/BullMQ**, process with **workers** in batches (FCM multicast up to 500/req; SES/Twilio batch), with retries + dead-letter queues. Make broadcast an async job that returns immediately. Store device tokens indexed; prune invalid tokens on send failure.

---

## 8. Chat System Scalability

Today: rooms + per-user rate limiting, but **presence and rate-limit are in-memory `Map`s** and the **Redis Socket.IO adapter is unwired** → **single-node only** (a second instance breaks cross-node delivery and presence). **Recommendations:** enable `RedisIoAdapter` (pub/sub) + move presence to Redis (`SADD presence:<userId> <socket>` + TTL) and rate-limit counters to Redis; use **sticky sessions** or WebSocket-aware load balancing; cap message history queries with keyset + partitioning.

---

## 9. GPS Tracking Scalability

**Top write hotspot.** Every active technician pings location; ETA/Maps calls are already throttled and coord-rounded (good cost control), but pings persist to Postgres. At scale this dominates write IOPS and grows the ping table unbounded. **Recommendations:**
- Write **current location to Redis** (`GEOADD` / hash) as source of truth for live tracking; persist to Postgres **throttled/batched** (e.g. every N seconds or on meaningful movement) or to a **time-series store**.
- **Partition + TTL/downsample** ping history (keep high-resolution recent, downsample old).
- For nearest-technician dispatch, use **Redis GEO** or **PostGIS** rather than scanning lat/long.

---

## 10. Load Testing Plan

**Tools:** k6 or Artillery (HTTP), a Socket.IO load harness (WS), `pgbench`/query replay (DB).

**Scenarios & SLOs (suggested):**
| Scenario | Profile | Target |
|---|---|---|
| Login storm | ramp to peak concurrent auth | p95 < 400ms, 0 auth errors, throttle abusers |
| Booking create burst | spike writes + overlap checks | p95 < 600ms, no deadlocks |
| Dispatch board reads | sustained admin reads | p95 < 300ms (served by composite index) |
| Analytics dashboard | concurrent date-range queries | p95 < 1.5s (replica/MV), no OLTP impact |
| Chat concurrency | N concurrent sockets/rooms | stable delivery, presence correct **multi-node** |
| GPS ping flood | many techs pinging | write throughput sustained, p95 < 200ms |

Measure: p50/p95/p99 latency, RPS, error rate, **DB connections + CPU + lock waits**, WS concurrent connections, queue depth. Ramp → soak (30–60 min) → spike. Define pass/fail per SLO before testing.

---

## 11. Monitoring Strategy

- **CloudWatch:** infra + **RDS** (CPU, connections, read/write IOPS, replica lag), ALB (p95, 5xx), ElastiCache, SQS depth; alarms on p95/error-rate/DB-connections/lag/queue-depth.
- **Sentry:** error + performance tracing across **backend, Flutter, and React** (release health, regressions).
- **APM/tracing:** OpenTelemetry → X-Ray/Datadog for end-to-end request traces; **Prisma slow-query logging** + `pg_stat_statements` for the top offenders.
- **RUM:** client real-user metrics (app start, screen render, API latency as users see it).
- Dashboards: golden signals (latency, traffic, errors, saturation) per service.

---

## 12. Capacity Planning *(modeled estimates)*

**~1,000 users** — Single app instance + single small/medium RDS + CloudFront. In-memory caches acceptable; Redis recommended but optional. **Status: ready.**

**~10,000 users** — 2–3 app instances behind ALB → **requires Redis** (chat adapter + presence + shared cache + rate limit) to be correct; **read replica** for analytics; **PgBouncer** connection pooling; **SQS + workers** for notifications; begin **partitioning** pings/messages. **Status: needs the Phase-2 roadmap.**

**~100,000 users** — Autoscaling app fleet; **Aurora/Postgres primary + multiple read replicas**; **materialized views** on a refresh schedule; **partitioned + archived** high-growth tables; **Redis cluster**; live location in **Redis GEO**/time-series, not Postgres; dedicated notification/worker fleet; CDN tuned. **Status: roadmap-dependent; architecture supports it.**

---

## 13. Cost Optimization Recommendations

1. **CloudFront cache hit-ratio + image compression/thumbnails** — largest S3 egress + mobile-bandwidth saver.
2. **ETA/Maps caching** — already implemented; keep coord-rounding.
3. **SQS batching + FCM multicast** — fewer provider calls.
4. **S3 lifecycle** (IA/Glacier) for old media + archived pings/messages.
5. **Right-size RDS + app autoscaling**; Savings Plans/Reserved for steady baseline.
6. **Read replica for analytics** prevents over-provisioning the primary for spiky OLAP.
7. **Log/metric retention caps** to control CloudWatch cost.

---

## 14. Performance Risk Assessment

**Critical** — none (no live system to crash yet); the items below become Critical *at the stated scale* if unaddressed.

**High**
1. **Single-node real-time** (chat presence/rate-limit in-memory; Socket.IO Redis adapter unwired) — breaks on horizontal scale.
2. **No Redis** — per-node cache, no shared cache/session/rate-limit; blocks multi-node correctness.
3. **GPS ping write hotspot** — unbatched Postgres writes + unbounded growth at scale.
4. **Synchronous notification fan-out** — blocks threads, hits provider limits on broadcasts.

**Medium**
1. Offset pagination on large tables (deep-page slowness).
2. Analytics aggregation on the OLTP primary (needs replica/MV).
3. Potential N+1 on list `include`s (verify).
4. No PgBouncer (connection exhaustion under autoscaling).
5. Soft-delete indexes not partial.

**Low**
1. Image sizes unoptimized (thumbnails/WebP).
2. Flutter rebuild/list hygiene (verify `ListView.builder`, `select`).
3. Chart bucket caps.

---

## 15. Scalability Roadmap

**Phase 1 — Pre-launch (≤1k):** verify `ListView.builder` + Prisma `include`/`select` (no N+1); make hot-path indexes partial; add CloudFront image variants; basic CloudWatch + Sentry. *(Mostly hygiene.)*

**Phase 2 — Scale to 10k:** deploy **Redis**; wire **RedisIoAdapter** + move presence/rate-limit to Redis; **read replica** + point analytics at it; **PgBouncer**; **SQS + workers** for notifications; **keyset pagination**; begin **partitioning** pings/messages.

**Phase 3 — Scale to 100k:** **materialized views** + scheduled refresh; multiple read replicas / Aurora; **Redis GEO / time-series** for live location; archive + downsample history; autoscaling fleet + WAF; full tracing/APM; load-test to validate SLOs.

---

## 16. Performance Readiness Score

**Current readiness: 70 / 100.**
Well-indexed schema, scale-aware design, and good cost instincts (ETA caching, server-side tables, aggregated charts) carry it. The score is held back by **infrastructure that's designed but not wired** (Redis, Socket.IO adapter, queue, replica) and a few **query/pattern** changes (keyset pagination, partial indexes, ping batching).

### Improvements required before launch
1. **Verify no N+1** on list endpoints; project columns with `select`.
2. **`ListView.builder` + Riverpod `select`** confirmed on long lists; serve image thumbnails via CloudFront.
3. **Make hot-path indexes partial** (`WHERE deleted_at IS NULL`).
4. **Stand up Redis** and **wire the Socket.IO Redis adapter + presence** — required the moment you run more than one backend instance.
5. **Batch/throttle GPS ping persistence** (and plan partitioning) before onboarding many technicians.
6. **Async notification fan-out** (queue + workers) before any broad announcement.
7. **Baseline monitoring** (CloudWatch RDS alarms + Sentry) and a **load test against the SLOs** above.

Addressing Phase-1 + the Redis/queue items raises readiness to an estimated **86–90 / 100** for launch-scale, with Phases 2–3 sequenced as growth demands.

---

*Prepared as a performance & scalability review. Capacity and latency figures are modeled estimates to guide planning; validate against the load-test results before committing to SLAs.*
