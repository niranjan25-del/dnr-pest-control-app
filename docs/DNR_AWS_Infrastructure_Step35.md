# DNR Pest Control — AWS Infrastructure & Production Deployment
**Step 35 · Cloud Infrastructure & Deployment Architecture**
Prepared by: Principal AWS Solutions Architect / Cloud Infrastructure Engineer / SRE / DevOps Lead
Region: **ap-south-1 (Mumbai)** — co-located with the India/INR user base. Scope: AWS infrastructure design + deployment architecture. No application code, architecture docs, or CI/CD workflow regeneration.

> **Design constraint honored throughout:** this infrastructure provisions exactly the resources the Step 34 deploy pipeline targets — ECS cluster `dnr-<env>`, service `dnr-backend-<env>`, container `dnr-backend`, ECR repo `dnr-backend`, the admin S3 bucket + CloudFront distribution, and the OIDC deploy role — so CI/CD activates the moment this is applied.

---

## 1. Architecture Overview

```
                                   ┌────────────── Route 53 (dnr.example.com) ──────────────┐
                                   │  api.* → ALB   admin.* → CloudFront   cdn.* → CloudFront │
                                   └───────────────────────────┬────────────────────────────┘
                                                               │ ACM TLS (1.2+)
            ┌──────────────────────────────────────────────────┼─────────────────────────────────────┐
            │                          AWS WAF + Shield Standard │                                     │
   ┌────────▼─────────┐                              ┌──────────▼──────────┐               ┌───────────▼──────────┐
   │  CloudFront (CDN) │                              │  Application LB (ALB)│               │ CloudFront (CDN)     │
   │  admin SPA (S3)   │                              │  :443  →  target grp │               │ media via OAC (S3)   │
   └────────┬─────────┘                              └──────────┬──────────┘               └───────────┬──────────┘
            │ OAC                                                │  private                              │ signed URLs
   ┌────────▼─────────┐         ┌──────────────────── VPC (10.0.0.0/16, 2+ AZ) ──────────────────────┐  │
   │ S3: admin bucket │         │  Public subnets:  ALB · NAT GW                                     │  │
   │ (private, OAC)   │         │  Private (app):   ECS Fargate tasks  ◄── auto-scale (CPU + reqs)   │  │
   └──────────────────┘         │  Private (data):  RDS Postgres (Multi-AZ) · ElastiCache Redis      │  │
                                │                   VPC endpoints: S3, ECR, Secrets, Logs, CW        │  │
                                └───────────────────────┬───────────────────────┬──────────────────┘  │
                                                        │                       │                      │
                                  ┌─────────────────────▼──┐      ┌─────────────▼─────────────┐  ┌─────▼──────────┐
                                  │ RDS PostgreSQL 16       │      │ ElastiCache Redis (Multi- │  │ S3: media      │
                                  │ Multi-AZ · PITR · KMS   │      │ AZ) — sockets/cache/queue │  │ bucket (private)│
                                  └─────────────────────────┘      └───────────────────────────┘  └────────────────┘
   External: Stripe (webhooks → ALB) · Firebase (FCM egress via NAT) · Google Maps (egress via NAT)
   Secrets Manager → injected into ECS task · ECR ← images from CI · CloudWatch ← logs/metrics from all
```

**Service interactions:** clients hit Route 53 → CloudFront (admin SPA + media) or ALB (API). The ALB forwards to ECS Fargate tasks in private subnets. Tasks read/write RDS + Redis (private), pull secrets from Secrets Manager, store/serve files via S3 (+ CloudFront OAC for delivery), and reach Stripe/Firebase/Maps outbound through the NAT gateway. Stripe webhooks arrive inbound at the ALB. CI pushes images to ECR and assumes the OIDC role to roll the ECS service.

---

## 2. Infrastructure Design

### 2.1 Networking (VPC)
- **VPC** `10.0.0.0/16`, **2 AZs minimum** (ap-south-1a/1b), 3 for production.
- **Public subnets** (`10.0.0.0/24`, `10.0.1.0/24`): ALB + NAT Gateway + Internet Gateway.
- **Private app subnets** (`10.0.10.0/24`, `10.0.11.0/24`): ECS Fargate tasks (no public IP).
- **Private data subnets** (`10.0.20.0/24`, `10.0.21.0/24`): RDS + ElastiCache (no internet route).
- **NAT Gateway** (one per AZ in prod for HA) — egress for FCM/Stripe/Maps from private subnets.
- **VPC Endpoints** (cost + security): S3 (gateway), ECR, Secrets Manager, CloudWatch Logs, SSM (interface) — keeps AWS-service traffic off the NAT/internet.

**Security groups (least privilege):**
| SG | Inbound | From |
|---|---|---|
| `alb-sg` | 443 | 0.0.0.0/0 (via WAF) |
| `ecs-sg` | app port (3000) | `alb-sg` only |
| `rds-sg` | 5432 | `ecs-sg` only |
| `redis-sg` | 6379 | `ecs-sg` only |

### 2.2 Backend — ECS Fargate (recommended over EC2)
**Why Fargate:** no node management, per-task isolation, scales to zero ops overhead — ideal for a stateless NestJS API. **Cluster `dnr-<env>`, service `dnr-backend-<env>`, container `dnr-backend`** (matching the deploy pipeline).
- **Task:** 0.5 vCPU / 1 GB (MVP) → 1 vCPU / 2 GB (growth); 2+ tasks across AZs for HA.
- **Auto-scaling:** target-tracking on CPU 60% **and** ALB requests-per-target; **also scale on active socket count** once Redis-backed (Step 33) — sockets are sticky and CPU-light, so request/CPU alone under-scales them.
- **Load balancing:** **ALB** (`:443`), HTTPS-only, health check `GET /health` (the app exposes it), deregistration delay 30s for graceful drains. **Sticky sessions** enabled for the WebSocket namespaces (`/chat`, `/location`) so handshakes pin to a task; cross-task fan-out handled by the Redis adapter.
- **Deployment:** rolling with the **ECS deployment circuit breaker + auto-rollback** (wired in `deploy.yml`); `prisma migrate deploy` runs on container start (idempotent).

### 2.3 Database — RDS PostgreSQL
- **Engine:** PostgreSQL 16; **Multi-AZ** (synchronous standby, automatic failover).
- **Instance:** `db.t4g.medium` (MVP) → `db.r6g.large` + **read replica** (growth, analytics offload).
- **Backups:** automated daily + **PITR** (35-day retention in prod); snapshots before each release.
- **Security:** private data subnet, `rds-sg` from `ecs-sg` only, **KMS encryption at rest**, TLS in transit, IAM auth optional. **Connection pooling: RDS Proxy** (mandatory at 10k+ to survive task×Prisma connection multiplication).
- **Recovery:** Multi-AZ failover (RTO minutes); PITR for logical errors (RPO ≤ 5 min).

### 2.4 Caching — ElastiCache Redis
- **Redis (Multi-AZ)** — the Step 33/19 unlock: Socket.IO adapter, presence, dashboard cache, throttler buckets, notification queue (BullMQ), GPS latest-fix. `cache.t4g.small` (MVP) → `cache.r6g.large` (growth) → cluster-mode (enterprise).
- **Action item:** `REDIS_URL` is consumed in code but missing from `.env.example` — add it to the task secret set (flagged Steps 19/32/33).

### 2.5 Storage — S3
**As built, the backend uses a single private media bucket** (`AWS_S3_MEDIA_BUCKET`) with **ownerType prefixes** (`media/`, `invoice/`, `service_report/`, `report_signature/`, `analytics/exports/`), not three separate buckets. Two valid designs:
- **Recommended (matches code):** one private bucket `dnr-media-<env>` with the prefixes above + lifecycle rules per prefix. Simplest, no code change.
- **Spec alternative (three buckets):** `dnr-media-`, `dnr-invoices-`, `dnr-reports-<env>` — requires config to point each S3 client at its bucket (the three inits flagged in Step 19). Choose this only if you need separate IAM/lifecycle/billing boundaries.
- **Admin SPA bucket** `dnr-admin-<env>` (the pipeline's `ADMIN_BUCKET`) — private, served only via CloudFront OAC.

**Security model:** all buckets **Block Public Access ON**; no ACLs; bucket policy allows only the task role (prefix-scoped) + CloudFront OAC; **SSE-KMS** encryption; versioning ON; access logging to a log bucket.

### 2.6 CDN — CloudFront
- **Admin SPA:** CloudFront → S3 admin bucket via **OAC**; SPA routing (403/404 → `index.html`); `max-age` long for hashed assets, short for `index.html`.
- **Media:** CloudFront → S3 media bucket via OAC; **signed URLs** for private media (the app already mints presigned/CloudFront-signed URLs — `CLOUDFRONT_KEY_PAIR_ID` + `CLOUDFRONT_PRIVATE_KEY` must be provisioned, flagged Step 19). Cache by object; honor query-string signature.
- **Caching strategy:** static assets cached at edge (immutable, hashed); media cached with TTL bounded by URL expiry; API is **not** fronted by CloudFront caching (dynamic) — optionally use CloudFront for TLS termination + WAF in front of the ALB.

### 2.7 DNS & TLS
- **Route 53** hosted zone `dnr.example.com`: `api.` → ALB (alias), `admin.` → CloudFront, `cdn.` → CloudFront; health checks + (optionally) latency/failover routing for DR.
- **ACM:** public certs (DNS-validated) for `*.dnr.example.com`; ALB + CloudFront enforce **TLS 1.2+**, HSTS; auto-renewal.

---

## 3. Security Design

- **IAM (least privilege):** distinct roles — **task execution role** (pull ECR, read Secrets, write Logs), **task role** (app runtime: `s3:{Get,Put,Delete}Object` on the media-bucket prefix only, `kms:Decrypt` for its key — **no `s3:*`, no `*` resource**), and the **CI OIDC deploy role** (ECR push, ECS update, S3 sync, CloudFront invalidate — scoped to the named resources). No static IAM users for the app.
- **Secrets Manager:** `DATABASE_URL`, `JWT_ACCESS/REFRESH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FIREBASE_PRIVATE_KEY`/`CLIENT_EMAIL`/`PROJECT_ID`, `GOOGLE_MAPS_API_KEY`, `CLOUDFRONT_KEY_PAIR_ID`/`PRIVATE_KEY`, `REDIS_URL` — injected into the task definition as `secrets` (never env-baked into the image). Rotation enabled for DB credentials. **Task role replaces `AWS_ACCESS_KEY_ID`/`SECRET`** (drop static keys, per Step 32).
- **WAF** (on CloudFront/ALB): AWS managed rule sets (common, SQLi, bad-inputs, IP-reputation) + rate-based rule (complements the app throttler). **Shield Standard** is automatic; **Shield Advanced** only if a DDoS profile warrants it.
- **Network:** private subnets for app+data, SGs least-privilege, no public DB, VPC endpoints keep AWS traffic internal.
- **Encryption:** KMS at rest (RDS, S3, Redis, EBS); TLS in transit everywhere.

---

## 4. Monitoring Design

- **Log Groups:** `/ecs/dnr-backend-<env>` (structured pino JSON), ALB access logs → S3, RDS/Redis logs, CloudTrail (account-wide), VPC Flow Logs. Retention 30–90 days hot → S3/Glacier archive.
- **CloudWatch metrics + alarms:**
  | Alarm | Threshold |
  |---|---|
  | ALB 5xx rate | > 1% (5 min) |
  | ALB target p95 latency | > 800 ms |
  | ECS CPU / memory | > 80% sustained |
  | ECS running tasks | < desired (deploy/health failure) |
  | RDS CPU / connections | > 80% / > 80% of max |
  | RDS free storage / replica lag | < 10% / > 30 s |
  | Redis evictions / CPU | > 0 sustained / > 75% |
  | Queue depth (notifications) | > threshold (backlog) |
- **Dashboards:** golden signals (latency/traffic/errors/saturation) + business KPIs; **Sentry** for app/admin errors correlated by `request_id`; **release markers** on each deploy. **Container Insights** on the ECS cluster. SNS → Slack/PagerDuty for alarm routing.

---

## 5. Cost Analysis (ap-south-1, order-of-magnitude USD/mo)

| Component | MVP (≤1k) | Growth (~10k) | Enterprise (~100k) |
|---|---:|---:|---:|
| ECS Fargate | ~$70 (2×0.5/1) | ~$400 (4–8×1/2) | ~$2,500 (autoscale fleet) |
| RDS Postgres | ~$120 (t4g.medium Multi-AZ) | ~$450 (r6g.large + replica) | ~$2,200 (r6g.2xl + replicas + Proxy) |
| ElastiCache Redis | ~$30 (t4g.small) | ~$140 (r6g.large MAZ) | ~$700 (cluster) |
| S3 + CloudFront | ~$30 | ~$150 | ~$900 |
| ALB + NAT + data | ~$60 | ~$180 | ~$700 |
| CloudWatch/WAF/Secrets | ~$40 | ~$120 | ~$500 |
| **Approx. total** | **~$350/mo** | **~$1,440/mo** | **~$8,400/mo** |

These exclude data-transfer spikes, Shield Advanced, and support plans, and are planning estimates to validate against the AWS Pricing Calculator + real load tests (Step 33). **Cost levers:** Savings Plans/Reserved (compute + RDS) at steady state, single-NAT in non-prod, S3 lifecycle (IA/Glacier) + Intelligent-Tiering, VPC endpoints to cut NAT egress, right-sized log retention.

---

## 6. Deployment Strategy

### 6.1 Infrastructure as Code — Terraform (recommended)
Mature AWS provider, broad ecosystem, remote state. (CDK is a fine alternative if the team prefers TypeScript.) **Remote state** in S3 + DynamoDB lock; **one state per environment**.

```
infra/
├── modules/
│   ├── network/        # VPC, subnets, NAT, IGW, route tables, VPC endpoints, SGs
│   ├── ecs/            # cluster, service, task def, ALB, target group, autoscaling
│   ├── rds/            # Postgres Multi-AZ, subnet group, params, RDS Proxy
│   ├── redis/          # ElastiCache replication group
│   ├── storage/        # S3 buckets (media, admin) + lifecycle + policies
│   ├── cdn/            # CloudFront (admin + media OAC), ACM, Route 53 records
│   ├── security/       # IAM roles (task, exec, CI-OIDC), Secrets Manager, WAF
│   └── observability/  # log groups, alarms, dashboards, SNS
├── envs/
│   ├── staging/        # main.tf (module wiring) + staging.tfvars + backend.tf (state)
│   └── production/     # main.tf + production.tfvars + backend.tf
└── global/             # Route 53 zone, ECR repo, OIDC provider (shared)
```

### 6.2 Deployment Process
- **Initial (one-time, IaC):** `terraform apply` `global/` (ECR, Route 53 zone, OIDC provider) → `envs/staging` → `envs/production`. Creates the exact names the pipeline expects; seed Secrets Manager; request/validate ACM certs.
- **Staging:** push to `develop` → `backend-ci` builds/scans/pushes the image → `deploy.yml(staging)` rolls the ECS service + publishes the admin SPA + smoke test. Continuous.
- **Production:** publish a `vX.Y.Z` GitHub Release → `deploy.yml(production)` → **environment approval** → ECS rolling update (circuit-breaker auto-rollback) + admin publish + smoke test. Pre-deploy RDS snapshot; expand/contract migrations so app rollback never needs a schema rollback.

### 6.3 Backup & Disaster Recovery
- **Backups:** RDS automated daily + PITR (35d prod); pre-release snapshots; **S3 versioning + cross-region replication** (to ap-southeast-1 or another region) for compliance artifacts (invoices, reports, signatures); AWS Backup plan governing both.
- **DR objectives:** **RPO ≤ 5 min** (PITR), **RTO ≤ 1 hr** (Multi-AZ failover + IaC redeploy + last-good ECR tag). **Failover plan:** AZ loss → automatic (Multi-AZ RDS/Redis, multi-AZ ECS); region loss (pilot-light) → re-apply IaC in the DR region, restore RDS from cross-region snapshot, repoint Route 53 (failover record). Quarterly restore drills.

---

## 7. Readiness Score

| Dimension | Score | Rationale |
|---|---:|---|
| Security | 86 | Private subnets, least-privilege IAM, Secrets Manager, KMS, WAF, OIDC CI; pending: provision CloudFront signing keys + drop static AWS keys (both flagged). |
| Scalability | 82 | Fargate autoscale + Multi-AZ RDS + Redis + RDS Proxy path; enterprise needs replicas + cluster Redis + append-table partitioning (Step 33). |
| Reliability | 84 | Multi-AZ everywhere, circuit-breaker rollback, PITR, smoke tests; deduct until DR drill + cross-region replication are live. |
| Cost efficiency | 80 | Sensible sizing + clear levers; deduct until Savings Plans + lifecycle + single-NAT(non-prod) applied. |
| **Overall** | **83** | **PRODUCTION-READY DESIGN; PROVISION + VERIFY.** |

**Risks:** (1) **the infrastructure is designed, not yet provisioned** — `terraform apply` + Secrets Manager seeding + ACM validation must happen before the Step 34 deploy pipeline can run (this is the gating dependency). (2) **Provision the CloudFront key-pair + add `REDIS_URL`/`CLOUDFRONT_*` to the task secrets** or media signing + Redis features stay inert. (3) **Confirm the single-bucket-vs-three-bucket decision** before writing the storage module. (4) Cost figures are estimates — validate against the Pricing Calculator + load tests.

**Recommendations:** provision via the Terraform structure above, staging first; seed all secrets; request ACM certs early (DNS validation lead time); run the Step 33 load tests against staging to right-size before production; enable WAF + GuardDuty + CloudTrail from day one; schedule the first DR restore drill within 30 days of launch.

**AWS Readiness: 83/100 — the architecture is production-grade and matches the CI/CD pipeline's expectations exactly; the remaining work is provisioning it as code, seeding secrets, and verifying under load — not redesign.**
```
