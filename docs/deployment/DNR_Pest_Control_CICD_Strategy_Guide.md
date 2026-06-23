# DNR Pest Control — CI/CD Strategy

Complete continuous-integration and delivery strategy for the platform: GitHub + GitHub Actions, Docker, AWS (ECS/ECR/S3/CloudFront/RDS), across **development / staging / production**. Builds on the existing testing strategy, security audit, and performance review. **No AWS infrastructure is provisioned here** — the CD pipelines *deploy to* assumed-existing infra (names/ARNs via environment secrets/vars).

> **Artifacts in this set:** six workflows (`backend-ci`, `flutter-ci`, `react-ci`, `security-scan`, `cd-staging`, `cd-production`), a multi-stage backend `Dockerfile`, `.dockerignore`, a local `docker-compose.yml` (Postgres + Redis + API), and `.env.example`. Each header notes its repo path.

> **Honest framing:** these are production-shaped, copy-ready workflows, but they reference infra identifiers that don't exist yet (ECS cluster/service/task-def, S3 buckets, CloudFront IDs, RDS instance, IAM OIDC roles). They'll run once those are created and the listed secrets/vars are set. Deploy/rollback steps are written against ECS; if you choose EKS/Elastic Beanstalk/App Runner instead, swap the deploy job only — CI is unaffected.

---

## CI/CD Architecture Overview
A repo (mono or poly) wires **path-filtered CI** per app (backend / Flutter / React) so a change only triggers its relevant pipeline. CI proves quality (lint, typecheck, tests, coverage, security scans, build); on `develop`/`main` the backend also builds + scans + pushes an immutable image to ECR. **CD** is event-driven: a green Backend CI on `develop` auto-deploys **staging**; a published **release tag** deploys **production** behind a manual-approval environment gate. Everything authenticates to AWS via **OIDC** (no static keys).

```
PR ─▶ CI (lint, typecheck, test+cov, security scan, build)         ─▶ required checks gate merge
develop push ─▶ Backend CI ─▶ image→ECR ─▶ CD Staging (migrate, deploy, smoke, auto-rollback)
release v* ──▶ CD Production (approval → snapshot → migrate → deploy → smoke → auto-rollback → Sentry release)
```

## Branching Strategy
GitFlow-lite:
- **`main`** — always production-deployable; protected; deploys only via release tags.
- **`develop`** — integration branch; auto-deploys to staging.
- **`feature/*`** — branch off `develop`, PR back; CI required.
- **`hotfix/*`** — branch off `main` for urgent prod fixes; PR to `main` (tag/release) **and** back-merge to `develop`.
- **`release/*`** (optional) — stabilization before a tag.
Branch protection on `main`/`develop`: required status checks (CI + security), required review, linear history, no force-push.

## Environment Strategy
| Env | Trigger | Data | Approvals |
|---|---|---|---|
| **Development** | local (`docker-compose`) | disposable | none |
| **Staging** | auto on `develop` green CI | prod-like, anonymized | none (gated by CI) |
| **Production** | published release tag `v*` | live | **required reviewers** on `production` environment |
Isolation: separate AWS resources (ideally separate accounts) per env; secrets scoped to GitHub **Environments**; no cross-env credentials.

## Backend CI Pipeline
`backend-ci.yml`: **lint + typecheck** → **unit+integration tests** (Postgres service, `prisma migrate deploy`, `npm run test:cov` enforcing the 80% gate) → on `develop`/`main`: **build + Trivy image scan (fail on HIGH/CRITICAL) + push to ECR**. Concurrency-cancel on PRs; OIDC for ECR.

## Flutter CI Pipeline
`flutter-ci.yml`: **`dart format` check + `flutter analyze --fatal-infos`** → **`flutter test --coverage`** (generated files stripped) → **Android build** (`--obfuscate --split-debug-info`) and **iOS build `--no-codesign`**. Integration tests run on an emulator job gated behind a `run-integration` label (slow). Release signing is deliberately excluded from CI (it belongs to the release pipeline with keystore/provisioning secrets).

## React CI Pipeline
`react-ci.yml`: **lint + `tsc --noEmit`** → **unit tests** → **`vite build`** (build validation) → upload the `dist` artifact for CD to publish.

## CD Pipeline
- **Staging** (`cd-staging.yml`): on Backend-CI success for `develop` → `prisma migrate deploy` → `ecs update-service --force-new-deployment` + `wait services-stable` → publish admin bundle to S3 + CloudFront invalidation → **smoke test** → **auto-rollback** to the previous task definition on failure → Slack.
- **Production** (`cd-production.yml`): on release `v*` → **manual approval** (production Environment reviewers) → **RDS snapshot** → migrate → capture current task def → deploy → smoke → **auto-rollback** on failure → tag a **Sentry release** → Slack.

## GitHub Actions Workflows — structure & secrets
```
.github/workflows/
├── backend-ci.yml        # lint, test, build, image scan + push
├── flutter-ci.yml        # analyze, test, android/ios build
├── react-ci.yml          # lint, test, build
├── security-scan.yml     # dependency review, CodeQL, gitleaks, Trivy fs
├── cd-staging.yml        # auto deploy → staging
└── cd-production.yml     # tag + approval → production
```
**Repository/Environment secrets required**
| Secret | Used by |
|---|---|
| `AWS_DEPLOY_ROLE_ARN`, `AWS_PROD_DEPLOY_ROLE_ARN`, `AWS_REGION` | OIDC role assumption |
| `STAGING_DATABASE_URL`, `PROD_DATABASE_URL` | migrations |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` | release tagging |
| `SLACK_WEBHOOK_URL` | notifications |
**Environment vars (per env):** `ECS_CLUSTER`, `ECS_BACKEND_SERVICE`, `ECS_BACKEND_TASKDEF`, `ADMIN_BUCKET`, `ADMIN_CF_DIST`, `RDS_INSTANCE_ID`, `VITE_API_BASE_URL`.
Mobile release (later): `ANDROID_KEYSTORE`, `KEYSTORE_PASSWORD`, `APPLE_*`/`MATCH_*` for signing.

## Docker Strategy
- **Multi-stage build** (`Dockerfile.backend`): `deps` → `build` (prisma generate + nest build, prune dev deps) → slim `runtime` (`node:20-alpine`, **non-root**, `HEALTHCHECK`).
- **Migrations run in the deploy pipeline, not container start**, so replicas don't race.
- **Env vars** injected at runtime from Secrets Manager (never baked into the image); `.dockerignore` keeps source/tests/secrets out of the context.
- **Immutable tags**: image tagged with the **git SHA** (+ branch tag) so every deploy is traceable and rollback is just "deploy the previous SHA".
- **React** ships as a **static bundle to S3/CloudFront** (no container needed).

## Versioning Strategy
**SemVer** `vMAJOR.MINOR.PATCH` git tags drive production. Backend images tagged by **git SHA** (immutable) + branch. Flutter uses `version: x.y.z+build`. Conventional Commits enable automated changelog/release notes. One tag = one production deploy.

## Release Management Strategy
`develop` accumulates features → cut a `release/*` (optional) → merge to `main` → **publish a GitHub Release `vX.Y.Z`** which triggers prod CD (with approval). Hotfixes branch from `main`, ship via a patch tag, back-merge to `develop`. Release notes auto-generated from commits.

## Automated Quality Gates
A PR can merge only when: lint + typecheck pass, all tests pass, **coverage ≥ 80%** (jest threshold), build succeeds, **security scans report no HIGH/CRITICAL**, and required reviews are approved. Production additionally requires the **environment approval**.

## Security Checks
- **Dependency scanning** — `dependency-review-action` (PRs) + Trivy fs; fail on high.
- **Secret scanning** — gitleaks on full history.
- **SAST** — CodeQL (JS/TS).
- **Container scanning** — Trivy on the built image **before push** (fail on HIGH/CRITICAL, ignore-unfixed).
These directly action the security-audit findings (supply chain, secrets, image hygiene).

## Monitoring Integration
CD tags a **Sentry release** per prod deploy (error attribution + regression detection). Deploy markers + smoke results flow to **Slack**; CloudWatch alarms (from the performance review — RDS, ALB p95/5xx, queue depth) provide post-deploy health signal. Failed smoke → auto-rollback + alert.

## Rollback Procedures
- **App:** immutable image tags → redeploy the previous task definition (automated on smoke failure; one-command manual otherwise).
- **DB:** migrations are **expand-only / backward-compatible** (add columns/tables, dual-write, backfill, later contract) so a previous app version still runs against the new schema — the key enabler of safe rollback. Pre-prod **RDS snapshot** is the last-resort recovery point.
- **Static admin:** re-sync the previous `dist` + invalidate CDN.

## Disaster Recovery Automation
- **RDS:** automated backups + PITR; pre-deploy snapshots; documented restore runbook.
- **S3:** versioning + lifecycle (recover deleted/overwritten media).
- **Config:** all secrets in Secrets Manager (re-injectable); infra reproducible via IaC (next phase).
- **Drills:** periodic restore tests; RTO/RPO targets defined and validated.

## CI/CD Readiness Review
**Risks**
1. **Infra not provisioned** — pipelines reference ECS/S3/RDS/OIDC roles that must exist first (out of scope here by instruction). *High until done.*
2. **Migration safety** — rollback depends on expand-only migrations; enforce in review. *High.*
3. **iOS/Android release signing** not yet wired (CI builds unsigned). *Medium.*
4. **Smoke tests are shallow** (health check) — expand to key-journey checks. *Medium.*
5. **Single-region** assumptions; multi-region DR is later. *Low/Medium.*

**Recommendations**
- Stand up the AWS infra + **GitHub OIDC roles** and populate environment secrets/vars.
- Add a **`/health`** (and `/ready`) endpoint (the Dockerfile + smoke tests assume it).
- Enforce **expand-only migration** review checklist; add a migration linter.
- Add **release-signing** workflows for store builds when ready.
- Wire the **Redis/queue** services the performance review calls for so staging mirrors prod.

**CI/CD Readiness Score: 75 / 100** — the automation design and pipelines are production-grade and copy-ready; the gap is entirely **infra provisioning + secret wiring + a health endpoint**, none of which are redesigns. Once infra + OIDC + secrets are in place and `/health` exists, estimated **90 / 100**.

---

**Stopping after the CI/CD strategy, per instruction** (no AWS infrastructure provisioning). Open elsewhere: the AWS infrastructure/IaC layer (the natural next step these pipelines deploy into), Admin Dashboard Wave 2, and the Flutter Step 40 integration finish.
