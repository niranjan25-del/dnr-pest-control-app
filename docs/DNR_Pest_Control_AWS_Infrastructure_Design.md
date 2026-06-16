# DNR Pest Control — AWS Production Infrastructure & Deployment Design

**Classification:** Internal — Cloud Architecture
**Scope:** Production AWS design for the NestJS backend, PostgreSQL, Flutter app (backend services it depends on), React admin dashboard, media/files, networking, security, observability, DR, cost.
**Primary region:** `ap-south-1` (Mumbai) — matches the INR/India user base; **DR region:** `ap-southeast-1` (Singapore).
**Builds on:** the CI/CD strategy (this is the infra those pipelines deploy into), the security audit (WAF, Secrets Manager, OIDC, private subnets), and the performance review (Redis, read replicas, SQS, partitioning).

> **Honest framing:** this is a **design + IaC recommendation**, not provisioned infrastructure. Figures are **modeled estimates** to guide planning, not quotes — validate with the AWS Pricing Calculator and a load test before committing to budgets/SLAs. The design deliberately closes open items from earlier reviews (the unwired global controls now have a deployment home; Redis/queue/replica are first-class).

---

## 1. AWS Architecture Overview

A single-region, Multi-AZ, containerized design that scales horizontally and isolates tiers by subnet + security group. Public edge (CloudFront + WAF + ALB) fronts a private compute tier (ECS Fargate) that talks to private data services (RDS, ElastiCache) and AWS-managed services (S3, SQS, Secrets Manager).

```
                          Internet
                             │
                   ┌─────────▼─────────┐
                   │  Route 53 (DNS)   │
                   └─────────┬─────────┘
              ┌──────────────┼───────────────┐
              ▼                              ▼
   ┌──────────────────┐            ┌───────────────────┐
   │ CloudFront + WAF │            │ CloudFront + WAF  │
   │ app/api edge     │            │ admin SPA (S3 OAC)│
   └────────┬─────────┘            └─────────┬─────────┘
            ▼ (api.dnr…)                      ▼ (admin.dnr…)
   ┌──────────────────────────────────────────────────────┐
   │                 VPC  (10.0.0.0/16)                     │
   │  ┌──────────── Public subnets (2 AZ) ───────────────┐  │
   │  │   ALB (HTTPS)        NAT GW (per AZ)              │  │
   │  └──────────┬───────────────────────────────────────┘  │
   │             ▼                                            │
   │  ┌──────── Private app subnets (2 AZ) ───────────────┐  │
   │  │   ECS Fargate: backend tasks (auto-scaled)        │  │
   │  │   ECS Fargate: notification workers (SQS consumer)│  │
   │  └──────────┬───────────────────────┬────────────────┘  │
   │             ▼                       ▼                     │
   │  ┌──── Private data subnets (2 AZ) ─────────────────┐    │
   │  │  RDS PostgreSQL (Multi-AZ)   ElastiCache Redis   │    │
   │  └───────────────────────────────────────────────── ┘    │
   └──────────────────────────────────────────────────────┘
        │            │             │             │
        ▼            ▼             ▼             ▼
   Secrets Mgr     S3 (media/     SQS         CloudWatch /
   (creds)         invoices/      (notif.     Sentry (obs.)
                   reports)       fan-out)
```

External managed integrations (Stripe, Firebase/FCM, Twilio, SendGrid, Google Maps) are reached egress-only via the NAT gateways.

---

## 2. Network Architecture

**VPC** `10.0.0.0/16`, spanning **2 AZs** (3 for enterprise scale).

| Subnet tier | CIDR (per AZ) | Contents | Route |
|---|---|---|---|
| **Public** | 10.0.0.0/24, 10.0.1.0/24 | ALB, NAT GW | IGW |
| **Private app** | 10.0.10.0/24, 10.0.11.0/24 | ECS Fargate tasks, workers | NAT GW (egress only) |
| **Private data** | 10.0.20.0/24, 10.0.21.0/24 | RDS, ElastiCache | no internet |

**NAT gateway:** one per AZ (HA; avoids cross-AZ data charges). **VPC endpoints** (S3 gateway, ECR/Secrets Manager/CloudWatch interface) to cut NAT cost + keep AWS traffic private.

**Security groups (least privilege, reference-based — not CIDRs):**
- `sg-alb`: inbound 443 from CloudFront prefix list only; → `sg-app`.
- `sg-app` (ECS): inbound from `sg-alb` on app port; egress to `sg-data`, NAT, endpoints.
- `sg-data-rds`: inbound 5432 **from `sg-app` only**.
- `sg-data-redis`: inbound 6379 **from `sg-app` only**.
No data-tier ingress from the internet, ever.

---

## 3. Backend Deployment

**Recommendation: ECS Fargate** (not EC2). Rationale: no node management, per-task isolation, fast autoscaling, smaller ops burden — ideal for a stateless NestJS API. (EС2/EKS only if you later need daemonsets, GPU, or very high sustained scale where EC2 is cheaper.)

- **Service:** backend task (the multi-stage image from CI/CD), 2+ tasks across AZs, behind the ALB target group; health check `GET /api/v1/health`.
- **Workers:** a separate Fargate service consuming **SQS** for notification fan-out (decouples broadcasts from request threads — the performance-review fix).
- **Load balancer:** **ALB** (HTTP/2, path/host routing, TLS termination via ACM, access logs to S3, deregistration delay for graceful drains).
- **Auto scaling:** target-tracking on CPU ~60% and ALB **requests-per-target**; min 2 / max N; scale-in cooldowns to avoid flapping. Migrations run from the deploy pipeline (not task start), so scaling never races schema.

---

## 4. Database Architecture

- **RDS PostgreSQL**, **Multi-AZ** (synchronous standby in a second AZ; automatic failover). Instance sized per tier (§12); `gp3` storage with headroom + storage autoscaling.
- **Connection pooling:** **RDS Proxy** (or PgBouncer sidecar) in front — prevents connection exhaustion as Fargate tasks scale (performance-review item).
- **Read replicas (growth/enterprise):** 1–2 async replicas; point **all `/analytics/*` (OLAP) reads** at them to protect OLTP. **Materialized views** refreshed on schedule for dashboards.
- **Backups:** automated daily snapshots + **PITR** (transaction-log) with 7–35-day retention; **pre-deploy manual snapshots** (already in the prod CD pipeline); copy snapshots to the DR region.
- **Encryption:** at rest (KMS) + in transit (TLS); secrets in Secrets Manager with rotation.
- **Scale levers:** partition append-heavy tables (location pings, messages, notifications) by time; consider **Aurora PostgreSQL** at enterprise scale for faster failover + replica fan-out.

---

## 5. Storage Architecture (S3)

Separate buckets by purpose + sensitivity, all **Block Public Access = ON**, SSE-KMS, versioning:

| Bucket | Contents | Access | Lifecycle |
|---|---|---|---|
| `dnr-media-<env>` | service photos, avatars (+ thumbnails) | CloudFront OAC; presigned PUT for uploads | IA @90d, Glacier @1y |
| `dnr-invoices-<env>` | generated invoice PDFs | private; presigned GET, owner-scoped | retain per finance/legal policy |
| `dnr-reports-<env>` | exported CSV/PDF reports | private; presigned GET, role-scoped | expire @30–90d |
| `dnr-admin-web-<env>` | React SPA static bundle | CloudFront OAC only | — |
| `dnr-logs-<env>` | ALB/CloudFront/access logs | private; lifecycle to Glacier | Glacier @90d |

Uploads: short-TTL presigned URLs, content-type + size constrained, randomized keys, **on-upload Lambda** for AV scan + image re-encode (strips EXIF/polyglots — security-audit item).

---

## 6. CDN Architecture (CloudFront)

- **Two distributions:** (a) **admin SPA** (S3 origin via OAC, SPA error-routing 403/404→`index.html`, long-TTL hashed assets); (b) **media** (S3 origin via OAC, long TTL, signed URLs/cookies for private objects).
- **API:** optionally fronted by CloudFront for global TLS + WAF + caching of public GETs (service catalog) with short TTLs; mutations bypass cache.
- **Caching strategy:** immutable hashed assets cached ~1y; media long TTL keyed by object version; API cache short/zero with explicit invalidation on deploy (already in CD). High cache-hit ratio is the top S3-egress cost saver (performance review).

---

## 7. Domain Management (Route 53)

Hosted zone `dnr.example`:
- `app.dnr.example` / `api.dnr.example` → CloudFront/ALB (prod)
- `admin.dnr.example` → admin CloudFront
- `staging.*` / `staging-api.*` → staging stack
- Alias (A/AAAA) records to AWS resources; health checks + (enterprise) latency/failover routing to the DR region.

---

## 8. SSL/TLS

- **ACM** certificates (DNS-validated, auto-renew). CloudFront certs in `us-east-1`; ALB certs in the app region.
- **HTTPS enforced:** ALB/CloudFront redirect 80→443; **TLS 1.2+ only**; **HSTS** (the header the security audit flagged — now enforceable at the edge); secure cookies.

---

## 9. Monitoring & Observability

- **CloudWatch:** ECS (CPU/mem/task health), ALB (p50/95/99, 5xx, target health), **RDS** (CPU, connections, read/write IOPS, **replica lag**), ElastiCache, **SQS depth/age**, NAT bytes. Dashboards per tier (golden signals).
- **Logs:** structured JSON to CloudWatch Logs (no secrets/PII/PAN); subscription filter → central log/SIEM; retention caps for cost.
- **Tracing/APM:** OpenTelemetry → **X-Ray** (or Datadog); `pg_stat_statements` + Prisma slow-query logs.
- **Errors:** **Sentry** across backend/Flutter/React with release health (CD tags releases).
- **Alarms → SNS/Slack/PagerDuty:** p95 latency, 5xx rate, RDS CPU/connections/lag, SQS backlog, unhealthy targets, WAF spikes, failed deploys, budget thresholds.
- **Synthetics:** CloudWatch canaries on critical journeys (login, booking, payment health).

---

## 10. Security Architecture

- **IAM:** least-privilege roles; **GitHub OIDC** deploy roles (no static keys — CI/CD design); distinct task roles per service (backend vs workers) scoped to exactly the S3 prefixes / SQS queues / secrets they need; no wildcards on sensitive actions; separate accounts per env (AWS Organizations + SCPs) ideally.
- **Secrets Manager:** DB creds, JWT/refresh secrets, Stripe + webhook secret, Firebase SA, Twilio/SendGrid, Maps key — injected into ECS task defs as `secrets`, **rotation** enabled; nothing in images or `.env`.
- **WAF** (on CloudFront + ALB): AWS managed rule sets (common, bad-inputs, IP reputation), **rate-based rules** (the global throttling the security audit flagged), bot control, geo rules as needed.
- **DDoS:** Shield Standard (default) + **Shield Advanced** at enterprise scale; CloudFront/ALB absorb L3/4; WAF handles L7.
- **Network:** data tier unreachable from internet; VPC Flow Logs; GuardDuty + Security Hub + Config for continuous posture; KMS everywhere.

---

## 11. Backup Strategy

| Asset | Mechanism | Retention | DR copy |
|---|---|---|---|
| RDS | automated snapshots + PITR + pre-deploy snapshots | 7–35d | cross-region snapshot copy |
| S3 | versioning + lifecycle; **CRR** (cross-region replication) for media/invoices | per policy | replicated to DR region |
| Secrets/config | Secrets Manager (re-injectable) + IaC in Git | — | reproducible |
| Logs | S3 + Glacier | 90d+ | — |

**Recovery testing:** quarterly restore drills (RDS snapshot → temp instance → validate; S3 object-version restore); document actual RTO/RPO achieved vs target.

---

## 12. Disaster Recovery Plan

- **Objectives (suggested):** **RPO ≤ 5 min** (PITR), **RTO ≤ 1–2 h** for region-level events (warm-standby maturity dependent).
- **In-region (default):** Multi-AZ RDS auto-failover; ECS reschedules tasks across AZs; ALB routes around an unhealthy AZ — covers the common case automatically.
- **Cross-region (enterprise):** **pilot-light / warm-standby** in `ap-southeast-1` — replicated RDS snapshots + S3 CRR + IaC to stand up compute; Route 53 health-check failover. 
- **Runbooks:** region failover, DB restore, secret rotation, credential compromise; tested in drills.

---

## 13. Cost Estimation *(modeled monthly USD, ap-south-1, order-of-magnitude — validate with the Pricing Calculator)*

| Component | MVP (~1k) | Growth (~10k) | Enterprise (~100k) |
|---|---|---|---|
| ECS Fargate (API + workers) | $70–150 | $400–800 | $2,500–5,000 |
| RDS PostgreSQL (Multi-AZ) | $120–200 (t4g.medium) | $400–700 (r6g.large) | $2,000–4,000 (r6g.xl+replicas/Aurora) |
| ElastiCache Redis | $30–60 | $120–250 | $600–1,200 (cluster) |
| ALB | $20–30 | $30–60 | $80–150 |
| NAT (2 AZ) | $70–90 | $90–150 | $150–300 |
| S3 + CloudFront | $20–60 | $150–400 | $1,000–3,000 |
| SQS / Secrets / CloudWatch / WAF | $30–80 | $150–350 | $800–2,000 |
| **Approx. total** | **$370–650** | **$1,500–3,000** | **$8,000–18,000** |

Biggest levers (performance/cost review): CloudFront cache-hit ratio + image thumbnails (egress), read-replica isolation (right-size primary), Savings Plans/Reserved for steady baseline, S3 lifecycle, NAT via VPC endpoints, log retention caps. *(Excludes 3rd-party Stripe/Twilio/SendGrid/Maps usage fees.)*

---

## 14. Production Deployment Process

- **Initial:** provision via IaC (network → data → secrets → compute → edge/DNS/ACM → WAF); seed Secrets Manager; first image deploy; DNS cutover after smoke.
- **Updates:** CI builds + scans + pushes image (SHA tag) → **release tag** triggers prod CD → approval → RDS snapshot → **expand-only migration** → rolling/blue-green ECS deploy → smoke → Sentry release. (All defined in the CI/CD strategy.)
- **Rollbacks:** immutable image tags → redeploy previous task definition (auto on failed smoke); admin SPA → re-sync prior `dist` + CDN invalidation; DB protected by expand-only migrations + snapshot. **(No app-store release steps — out of scope.)**

---

## 15. Infrastructure as Code Recommendation

**Recommendation: Terraform** (with **Terragrunt** for env DRY) — broad ecosystem, multi-cloud-portable, mature module registry, strong drift detection; team-agnostic HCL. *(Choose **AWS CDK** instead only if the team is TypeScript-first and wants app + infra in one language — also excellent; trade-off is AWS-only + CloudFormation under the hood.)*

Recommended layout:
```
infra/
├── modules/            # reusable: vpc, ecs-service, rds, redis, s3-cdn, waf, observability
├── envs/
│   ├── staging/        # composition + tfvars
│   └── production/
└── global/             # route53 zone, ACM, OIDC provider + deploy roles, ECR
```
Remote state in **S3 + DynamoDB lock**, per-env workspaces, plan-on-PR + apply-on-merge (gated), least-privilege state access. Tag everything (`env`, `service`, `cost-center`).

---

## 16. Production Readiness Checklist

- [ ] VPC + 3-tier subnets + reference-based SGs; data tier private
- [ ] ECS Fargate service(s) + ALB + target-tracking autoscaling + `/health`
- [ ] RDS Multi-AZ + RDS Proxy + automated backups/PITR + pre-deploy snapshot
- [ ] ElastiCache Redis (chat adapter/presence, shared cache, rate limit)
- [ ] SQS + worker service for notification fan-out
- [ ] S3 buckets (BPA on, SSE-KMS, versioning) + on-upload AV/re-encode Lambda
- [ ] CloudFront (admin SPA + media, OAC) + cache policies + invalidation in CD
- [ ] Route 53 records + ACM certs + HTTPS redirect + HSTS
- [ ] WAF (managed + rate-based) + Shield + GuardDuty/Security Hub/Config
- [ ] Secrets Manager (all creds, rotation) + GitHub OIDC deploy roles
- [ ] CloudWatch dashboards + alarms → SNS/Slack/PagerDuty + Sentry releases + canaries
- [ ] Backups replicated cross-region + quarterly restore drill
- [ ] DR runbooks + RTO/RPO validated
- [ ] IaC (Terraform) with remote state + plan-on-PR; everything tagged
- [ ] **`main.ts` global controls wired** (Helmet/CORS/global pipe/rawBody) — the security must-fix this infra deploys

---

## 17. Infrastructure Readiness Score

**Readiness Score: 78 / 100 — production-grade design, pending implementation.**
The architecture is secure-by-default (private data tier, least-privilege IAM/OIDC, WAF, KMS, Secrets Manager), reliable (Multi-AZ, autoscaling, backups/DR), and scalable (Redis, replicas, SQS, partitioning, clear MVP→enterprise path), and it directly retires the open items from the security and performance reviews.

**Risks**
1. **Nothing is provisioned yet** — this is design + IaC plan; execution + validation pending. *High.*
2. **App-side prerequisites:** `/health` endpoint + wired global middleware (`main.ts`) + Redis/SQS integration code must land for the infra to be fully exercised. *High.*
3. **DR maturity:** in-region Multi-AZ is solid; cross-region warm-standby is enterprise-phase, not day-1. *Medium.*
4. **Cost drift** without Savings Plans + budgets/alerts. *Medium.*
5. **Single-region** at MVP/growth (accept consciously). *Low/Medium.*

**Recommendations**
- Build it as **Terraform modules**, staging first; validate with the CI/CD pipelines end-to-end before prod.
- Land the **app prerequisites** (`/health`, `main.ts` controls, Redis/SQS wiring) in parallel.
- Turn on **budgets + anomaly alerts** from day one; apply Savings Plans once baseline is known.
- Run a **load test** against staging to size RDS/Fargate before finalizing prod instance classes + the cost model.

Once provisioned + validated with a load test and the app prerequisites merged, estimated **90–92 / 100** (production-launch-ready).

---

*Prepared as a cloud-architecture design. Costs and RTO/RPO are modeled targets to guide planning — validate against the AWS Pricing Calculator and load-test results before committing to budgets or SLAs. App-store release steps are intentionally out of scope.*
