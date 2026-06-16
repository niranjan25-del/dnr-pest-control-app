# DNR Pest Control — Performance Optimization & Scalability Review
**Step 33 · Performance & Scalability Assessment**
Prepared by: Principal Performance Engineer / Cloud Scalability Architect / Database Optimization Specialist / Senior Solutions Architect
Scope: Backend (NestJS/Postgres/Prisma/Redis), Flutter, React Admin, AWS. Assessment + planning only — no code, architecture, or test regeneration.

---

## 1. Executive Summary

The DNR platform is **architected for performance, single-instance-ready, and one well-defined step away from horizontal scale.** The data model is well-indexed (**72 `@@index`, 23 unique constraints**, including composite hot-paths and a `[latitude, longitude]` geo index); the API is stateless at the request level with a global throttler; analytics already uses parameterized raw SQL with `date_trunc` and a short-TTL cache; and Redis is a declared dependency awaiting activation.

**The single structural constraint is shared in-process state.** Three subsystems hold state in memory that must move to Redis before running more than one instance: **(1) Socket.IO rooms + chat presence, (2) GPS tracking session state, and (3) the analytics/dashboard TTL cache.** This is the same item the Step 19 backend review flagged P0 — it is the gate between vertical and horizontal scaling, not a redesign.

**Overall Performance Readiness: 78/100 — "READY FOR MVP/GROWTH, ENTERPRISE NEEDS THE REDIS STEP."** At MVP scale (≤1k concurrent) the platform performs well as-is. The work to reach 10k–100k is bounded and known: externalize state to Redis, add the Socket.IO Redis adapter, queue the high-fan-out work (notifications, location writes), and move the heaviest analytics to materialized views.

---

## 2. Bottleneck Analysis

### 2.1 Backend (ranked by scaling impact)

| # | Bottleneck | Why it bites | Scale at which it hurts |
|---|---|---|---|
| **B-1** | **Socket.IO single-instance** — rooms + presence in process memory | A 2nd instance can't see the 1st's rooms; messages/presence fragment | Any horizontal scaling (10k+ concurrent sockets) |
| **B-2** | **GPS write-per-fix** — each location update is a row insert; technicians ping ~every few seconds | Write amplification + table bloat on `technician_location` (BigInt append table) | 10k+ active technicians or high ping rate |
| **B-3** | **Analytics multi-hop aggregation in JS** — revenue-by-service/technician fetch rows and reduce in Node | Reads many rows per dashboard load; CPU + memory on the app tier | Large datasets / frequent dashboard refresh |
| **B-4** | **Notification fan-out is synchronous** — FCM multicast + in-process retry on the request path | A broadcast blocks a worker; retries compound | Large broadcasts / high booking volume |
| **B-5** | **In-memory TTL dashboard cache** — per-instance, lost on restart, not shared | Cache stampede across instances; cold dashboards | Multi-instance |
| **B-6** | **No scheduler** — renewals/reminders/overdue sweeps not wired (Step 19 P0) | Not a latency bottleneck but a correctness/throughput gap | Subscription volume |

**API response times (expected):** CRUD + list endpoints are index-backed and paginated → low-ms at MVP. The slowest paths are the **analytics dashboards** (B-3) and any **PDF generation** (invoices/reports — synchronous pdfkit + S3 round-trip), which should be treated as async/cacheable rather than interactive.

### 2.2 Database access patterns

**Strengths:** UUID PKs; `Decimal(10,2)` money; soft-delete with `@@index([deletedAt])`; composite indexes on the real hot paths (`[status, scheduledWindowStart]` bookings, `[status, createdAt]` payments/invoices, `[technicianId, status]` reviews, `[latitude, longitude]` addresses). FK delete behaviors are deliberate.

**Slow-query risks + missing indexes (additive, next migration):**
- `payments(status, created_at)` — partial index `WHERE status IN ('SUCCEEDED','PARTIALLY_REFUNDED','REFUNDED')` to speed revenue aggregation.
- `technician_location(technicianId, recordedAt DESC)` — composite for "latest fix" + history range scans (highest-write table).
- `notifications(userId, readAt)` — composite for the unread-count query.
- `chat_message(conversationId, createdAt)` — composite for history paging.
- `subscriptions(status, nextBillingDate)` — composite for the renewal poller.
- Consider **BRIN** indexes on the large append tables (`technician_location`, `booking_status_history`, `audit_log`) on `createdAt/recordedAt` — far smaller than B-tree for time-ordered inserts.

**Reporting optimization strategy:** move revenue-by-service/technician to raw `GROUP BY` (table maps confirmed in Step 18) and introduce **materialized views** (`mv_daily_revenue`, `mv_technician_perf`) refreshed on a schedule, or nightly **rollup tables** the dashboard reads instead of live aggregation. For very large ranges, pre-bucket server-side and cap series length.

---

## 3. Redis Architecture (the unlock)

Redis is already a dependency; activate it for **four concerns** behind a single managed cluster (ElastiCache, Multi-AZ):

```
                    ┌──────────────────── Redis (ElastiCache, cluster mode) ────────────────────┐
                    │                                                                            │
  Socket.IO  ──────►│  ① Pub/Sub adapter   — cross-instance room fan-out (@socket.io/redis-adapter)
  Chat/Presence ───►│  ② Presence + rooms  — SETEX user:online, room membership sets
  Analytics  ──────►│  ③ Cache             — GET/SETEX dashboard:kpis (60s), report:* (TTL)
  Sessions   ──────►│  ④ Token/session aux — refresh-token reuse-detection set, rate-limit buckets
  GPS        ──────►│  ⑤ Latest-fix cache  — HSET tech:{id} lat/lng/ts (read path; writes batched to PG)
                    └────────────────────────────────────────────────────────────────────────────┘
```

- **Session/token caching:** back the throttler in Redis (shared buckets across instances); store refresh-token-family state for reuse-detection.
- **Query/dashboard caching:** swap the in-process `TtlCache` for Redis `SETEX` (same interface) → shared, restart-surviving, stampede-protected (add a short lock or `SETNX` guard).
- **Notification caching:** dedupe/idempotency keys for webhook + broadcast; unread-count cache invalidated on read.
- **GPS latest-fix:** serve "where is my technician" from a Redis hash (sub-ms) while **batching** durable writes to Postgres (B-2 fix).

---

## 4. Subsystem Reviews

**Booking system:** scheduling + assignment are index-backed (`[status, scheduledWindowStart]`, weighted scoring). High-volume risk is **slot-conflict contention** under concurrent bookings for the same window — use a short transaction + a unique/exclusion constraint (Postgres `EXCLUDE` on time ranges per technician) to prevent double-booking at scale rather than app-level checks alone.

**Chat (B-1):** attach `@socket.io/redis-adapter` in `main.ts`; externalize presence to Redis; enable LB **sticky sessions** (or WebSocket-native LB) for handshake affinity. Message throughput then scales horizontally; cap message history paging (composite index above).

**GPS (B-2):** thin the track (distance/time gate before persisting — e.g. ≥25m or ≥10s), **batch** inserts (buffer N fixes → `createMany`), serve live reads from Redis, and age out raw fixes (retain a downsampled history). This cuts write volume by 5–10× without losing the live experience.

**Notifications (B-4):** move fan-out + retries to a **queue** (BullMQ on Redis, or SQS + a worker). The request returns immediately; a worker drains the queue with backoff and prunes invalid tokens. Sized for bursts (a platform-wide broadcast = N pushes).

---

## 5. Flutter Performance

- **Rebuilds/state:** Riverpod with `select`/`autoDispose` is already the pattern — audit for over-broad `watch`; prefer `ref.watch(provider.select(...))` on large objects.
- **Lists:** ensure `ListView.builder`/`Sliver` everywhere (booking/chat/notification lists); add pagination + cached network images (already a dep); use `const` constructors and `RepaintBoundary` on heavy rows.
- **Maps:** throttle marker/polyline updates; cluster markers if many; dispose controllers; avoid rebuilding `GoogleMap` on unrelated state changes.
- **Chat:** virtualize history; debounce typing indicators; reuse the socket connection.
- **Startup:** the guarded-zone bootstrap is lean; defer non-critical init; `--split-debug-info` + deferred components for size.

## 6. React Dashboard Performance

- **Large tables:** the custom `DataTable` does **server-side pagination** (good) but **no virtualization** — for wide/long pages add `@tanstack/react-virtual` or switch that table to `@mui/x-data-grid` (already a dependency).
- **Charts:** memoize recharts data transforms; lazy-load recharts so non-analytics users don't pay for it; cap series length server-side.
- **API usage:** TanStack Query is filter-keyed with 60s `staleTime` (matches backend cache) + `placeholderData` — efficient. Add **code-splitting** (`React.lazy`/Suspense) per route to cut the initial bundle (analytics is heaviest); prefetch detail pages on row hover.

## 7. File Storage Optimization (S3)

- **Lifecycle:** transition media → S3-IA after 30d, → Glacier for compliance artifacts (service reports, signatures) per retention policy; **never** auto-expire reports/signatures (compliance records).
- **Images:** compress on upload (sharp) + generate thumbnails; serve via CloudFront with long cache-control + signed URLs.
- **Reports/invoices:** lazy-generate (already), cache the rendered PDF as a MediaFile (already), and S3 Object Lock for tamper-evidence on issued invoices.
- **Cost:** CloudFront in front of S3 cuts GET costs + latency; Intelligent-Tiering for unpredictable access; consolidate the three S3 client inits (Step 19 P1) — operational, not cost.

---

## 8. Load Testing Plan

Tooling: **k6/Artillery** (HTTP), **artillery-engine-socketio** (sockets). Seed realistic data first (bookings, customers, technicians, payments).

| Tier | Concurrent users | API focus | Sockets | Pass criteria |
|---|---|---|---|---|
| **1k (MVP)** | 1,000 | list/dashboard/create-intent | 1k chat + 200 GPS | p95 < 300ms reads, < 800ms writes; 0 5xx |
| **10k (Growth)** | 10,000 | + analytics under load | 10k chat, 2k GPS @ 0.2Hz | p95 < 500ms; error rate < 0.5%; **requires Redis adapter + queue** |
| **100k (Enterprise)** | 100,000 | sharded read replicas | 100k chat across N nodes | p95 < 800ms; horizontal autoscale; **requires read replicas + materialized views + multi-node sockets** |

**Specific scenarios:** API — ramp `GET /bookings` + `GET /analytics/dashboard` + `POST /payments/create-intent`; assert webhook idempotency under replay. Chat — N clients join rooms, sustained message rate, measure delivery latency p95 across instances. GPS — N technicians at the post-throttle ping rate; measure write throughput + Redis latest-fix read latency.

---

## 9. Monitoring Strategy

- **CloudWatch:** ECS CPU/mem/task-count, ALB latency + 5xx, RDS connections/CPU/replica-lag, ElastiCache hit-rate/evictions; **alarms** on p95 latency, 5xx rate, DB connection saturation, queue depth.
- **Sentry:** errors + traces on the app, Flutter (Crashlytics already abstracted), and the admin (wire into the ErrorBoundary + Axios). Correlate with the backend `request_id`.
- **APM/tracing:** OpenTelemetry on hot paths (payments, bookings, sockets); RED metrics (Rate/Errors/Duration) per endpoint.
- **Dashboards:** a "golden signals" board (latency, traffic, errors, saturation) + business KPIs (bookings/hr, payment success rate, push delivery rate, socket connections).

## 10. Capacity Planning (order-of-magnitude)

| Resource | 1k | 10k | 100k |
|---|---|---|---|
| App tier (ECS Fargate) | 2 × 0.5vCPU/1GB | 4–8 × 1vCPU/2GB autoscale | 20–40 tasks, multi-AZ, autoscale on CPU + socket count |
| Postgres (RDS) | db.t4g.medium | db.r6g.large + 1 read replica | db.r6g.2xl+ + 2–3 replicas, PgBouncer pooling |
| Redis (ElastiCache) | cache.t4g.small | cache.r6g.large, Multi-AZ | cluster-mode, sharded |
| DB growth | — | bookings/payments steady; **`technician_location` + `audit_log` dominate** | partition/downsample the append tables; archive cold rows to S3 |
| Storage growth | media + PDFs | lifecycle to IA/Glacier | Intelligent-Tiering; thumbnails dominate read volume |

**Connection pooling is mandatory at 10k+** — front RDS with **PgBouncer/RDS Proxy** (NestJS/Prisma connection counts × instances will exhaust Postgres otherwise).

## 11. Cost Optimization

- **Compute:** Fargate autoscaling on real signals (CPU + socket count); Savings Plans/Spot for workers (queue consumers).
- **DB:** read replicas for analytics offload; reserved instances once steady-state; downsample/partition the append tables to control storage + vacuum cost.
- **Storage:** S3 lifecycle (IA/Glacier) + CloudFront caching (cuts GET volume); compress images.
- **Network:** CloudFront reduces S3 egress; keep cross-AZ chatter low (co-locate app + Redis + RDS writer).
- **Redis:** right-size + Multi-AZ only where needed; the dashboard cache + GPS reads pay for themselves in offloaded DB load.

## 12. Disaster Recovery

- **Backups:** RDS automated backups + PITR (≥7d retention); periodic snapshots; S3 versioning + cross-region replication for compliance artifacts.
- **RPO/RTO targets:** RPO ≤ 5 min (PITR), RTO ≤ 1 hr (Multi-AZ failover + IaC redeploy). Test restores quarterly.
- **Resilience:** Multi-AZ for RDS + Redis; ECS across AZs; idempotent payment/webhook handling means a replay after recovery is safe.

---

## 13. Scalability Roadmap

- **MVP (≤1k):** ship as-is + wire the scheduler. Single app instance is fine; in-memory state acceptable. Add CloudFront + basic CloudWatch alarms.
- **Growth (1k–10k):** **activate Redis** (adapter + presence + cache + throttler), **queue notifications**, **batch GPS writes + Redis latest-fix**, add **read replica** + the missing indexes + materialized views, code-split the admin, PgBouncer.
- **Enterprise (10k–100k):** multi-node sockets across AZs, sharded Redis, multiple read replicas, **partition the append tables** (time-based), CDN everywhere, WAF, autoscaling on socket count, and a data-warehouse offload (e.g. nightly export to Redshift/Athena) for heavy BI so OLTP stays clean.

---

## 14. Performance Risk Assessment

- **Critical:** none (no current-scale failure).
- **High:** B-1 sockets single-instance, B-2 GPS write amplification — both block horizontal scale.
- **Medium:** B-3 analytics in-JS aggregation, B-4 sync notification fan-out, B-5 per-instance cache, missing composite indexes, no connection pooler at scale.
- **Low:** PDF generation latency (make async/cached), admin bundle size, Flutter list/map polish.

---

## 15. Performance Readiness Score

| Dimension | Score | Rationale |
|---|---:|---|
| Backend efficiency | 82 | Stateless requests, indexed, paginated; deduct sync fan-out + in-JS analytics. |
| Database | 84 | 72 indexes + deliberate FKs; deduct a few composite/partial gaps + append-table growth. |
| Scalability (horizontal) | 68 | Gated by in-memory state (sockets/presence/cache/GPS) → the Redis step. |
| Frontend (mobile + admin) | 80 | Good patterns; deduct no virtualization + no code-splitting. |
| Infra/cost readiness | 76 | Sound targets; config + pooling + lifecycle pending. |
| **Overall** | **78** | **MVP/Growth-ready; Enterprise needs the Redis + queue + replica step.** |

**Required improvements before high scale (the bounded list):**
1. Redis: Socket.IO adapter + externalize presence/tracking/cache + back the throttler.
2. Queue notification fan-out (BullMQ/SQS) + wire the scheduler.
3. Batch GPS writes + Redis latest-fix + thin the track.
4. Add the composite/partial indexes + materialized views; move revenue aggregations to raw `GROUP BY`.
5. Connection pooling (PgBouncer/RDS Proxy) + a read replica for analytics.
6. Frontend: admin code-splitting + table virtualization; Flutter list/map polish.

**Go/No-Go: GO for MVP/Growth; CONDITIONAL for Enterprise** — the platform is performant and well-indexed today; reaching 10k–100k is a known, bounded sequence (Redis → queues → replicas → partitioning), not architectural rework. Re-score after the Growth items → expected ≥ 90.
```
