# DNR Pest Control — CI/CD Pipeline & DevOps Automation
**Step 34** · GitHub Actions · Docker · AWS (ECR/ECS/S3/CloudFront)

## Architecture Overview

A **monorepo** (`backend/`, `admin_dashboard/`, `flutter_app/`) with **path-filtered** workflows so each project's pipeline runs only when its files change. Five workflows:

| Workflow | Trigger | Does |
|---|---|---|
| `backend-ci.yml` | PR + push to develop/main (backend/**) | lint → unit (coverage gate) → integration (real Postgres) → build → Docker build + Trivy scan → push to ECR |
| `admin-ci.yml` | PR + push (admin_dashboard/**) | lint → typecheck → vite build → upload dist + `npm audit` |
| `flutter-ci.yml` | PR + push (flutter_app/**) | codegen → format → analyze → test (coverage) → Android + iOS build validation |
| `security.yml` | PR + weekly | Gitleaks (secrets) + CodeQL (SAST) + dependency review |
| `deploy.yml` | push develop → staging; release tag → production; manual (incl. rollback) | ECS rolling deploy + S3/CloudFront publish + smoke test |

**Flow:** `feature/*` → PR → CI (must be green) → merge to `develop` → **auto-deploy staging** → soak/QA → `release/*` → tag `vX.Y.Z` + GitHub Release → **gated production deploy** (environment approval).

```
 dev push ─► CI (lint/test/build/scan) ─► merge develop ─► deploy.yml(staging) ─► smoke
                                                                     │ QA sign-off
 release vX.Y.Z (GitHub Release) ─► deploy.yml(production, APPROVAL) ─► ECS rolling + CF ─► smoke
                                                                     │ failure
                                                  ECS deployment circuit-breaker auto-rollback
```

## Git Branching Strategy

- **`main`** — production; protected; only `release/*` and `hotfix/*` merge in; every merge is tagged.
- **`develop`** — integration; auto-deploys to staging.
- **`feature/*`** — branched from `develop`; squash-merged via PR.
- **`release/*`** — cut from `develop` for stabilization; version bump + changelog; merges to `main` **and** back to `develop`.
- **`hotfix/*`** — from `main` for urgent prod fixes; merges to `main` (tag patch) **and** `develop`.

**Branch protection (main + develop):** require PR, ≥1 review (≥2 for main), all required checks green (backend/admin/flutter CI as applicable + security), up-to-date branch, linear history, no force-push, signed commits recommended. **Merge strategy:** squash for `feature/*` (clean history); merge-commit for `release/*`/`hotfix/*` (preserve provenance).

## Environment Strategy

| Env | Branch | Backend | Admin | Mobile |
|---|---|---|---|---|
| Development | local / `feature/*` | local Docker compose + local Postgres | `vite` dev | `--dart-define=FLAVOR=dev` |
| Staging | `develop` | ECS `dnr-staging` | S3+CF staging | dev/staging flavor (internal distribution) |
| Production | `main` / tags | ECS `dnr-production` | S3+CF prod | prod flavor (store release pipeline) |

**Config approach:** **no secrets in the repo.** GitHub **Environments** (`staging`, `production`) hold env-scoped **variables** (`VITE_API_BASE_URL`, `ADMIN_BUCKET`, `ADMIN_CF_DISTRIBUTION`, `API_HEALTH_URL`) and **secrets**; runtime app secrets (`JWT_*`, `STRIPE_SECRET_KEY`, `DATABASE_URL`, `FIREBASE_*`, `CLOUDFRONT_*`, `REDIS_URL`) live in **AWS Secrets Manager**, injected into the ECS task definition. CI authenticates to AWS via **OIDC role assumption** (`AWS_DEPLOY_ROLE_ARN`) — no static AWS keys anywhere.

## Required Secrets & Variables

**Repo/Environment secrets:** `AWS_DEPLOY_ROLE_ARN` (OIDC deploy role). **Environment variables:** `VITE_API_BASE_URL`, `ADMIN_BUCKET`, `ADMIN_CF_DISTRIBUTION`, `API_HEALTH_URL`. **AWS Secrets Manager (runtime):** all backend app secrets above. **Mobile signing** (in the separate release pipeline): Android keystore + Play service account; iOS distribution cert + App Store Connect key.

## Docker Strategy

`backend/Dockerfile` is **multi-stage**: stage 1 (node:20-slim) installs all deps, runs `prisma generate` + `nest build`, then prunes dev deps; stage 2 copies only `node_modules` (prod) + `dist` + `prisma` and runs as a **non-root** user. Entrypoint runs `prisma migrate deploy` (idempotent) then `node dist/main.js`. `.dockerignore` excludes tests/coverage/node_modules/secrets. Images are tagged with the short SHA + `latest` and scanned by **Trivy** (build fails on HIGH/CRITICAL) before push to ECR.

## Automated Quality Gates

- **Coverage:** `test:ci` enforces the Jest thresholds (80% lines/functions/statements, 70% branches) — a PR with lower coverage fails.
- **Lint/format/typecheck:** backend ESLint, admin ESLint + `tsc`, Flutter `dart format` + `flutter analyze` — all blocking.
- **Build verification:** every project must build; Flutter validates **both** Android + iOS.
- **Security scans:** Gitleaks (secrets), CodeQL (SAST), dependency review (PRs), Trivy (containers), `npm audit` (advisory).

## Artifact & Versioning Strategy

- **Backend:** ECR image tagged `:<short-sha>` (immutable) + `:latest`; the SHA tag is the deploy/rollback unit.
- **Admin:** the `dist/` bundle is a CI artifact; deploys sync to S3 (versioning **on** for rollback).
- **Mobile:** AAB/IPA from the release pipeline, versioned via pubspec `version: x.y.z+build`.
- **Versioning:** **SemVer**; tags `vMAJOR.MINOR.PATCH`. A GitHub **Release** on a `v*` tag triggers production deploy and serves as the changelog/source of truth.

## Release Management

1. Cut `release/x.y.0` from `develop` → bump versions + changelog.
2. Merge to `main` → tag `vx.y.0` → publish GitHub Release.
3. Release publish triggers `deploy.yml` (production) → **environment approval required** → ECS rolling update + admin publish + smoke test.
4. Merge `release/*` back to `develop`.
5. **Hotfix:** `hotfix/x.y.z` from `main` → fix → tag patch → release → cherry-pick to `develop`.

## Rollback Strategy

- **Backend (automatic):** the ECS service uses **deployment circuit breaker + rollback** — a failed health-check during a rolling deploy auto-reverts to the last stable task set. **Manual:** `deploy.yml` `workflow_dispatch` with `rollback_tag=<previous-sha>` redeploys a known-good image (images are immutable + retained in ECR).
- **Frontend (admin):** S3 versioning + a re-sync of the previous `dist` (or revert the commit and re-run) + CloudFront invalidation. Because the admin is static, rollback is near-instant.
- **Database:** migrations are forward-only + idempotent (`migrate deploy`); for a bad migration, restore via RDS PITR (see DR) — **never** auto-`migrate reset` in prod. Design migrations to be backward-compatible (expand/contract) so an app rollback doesn't require a schema rollback.

## Disaster Recovery Automation

- **Backup verification:** scheduled job asserts the latest RDS automated snapshot exists + is < 24h old; periodic **restore drill** into a scratch instance validates recoverability (quarterly). S3 versioning + cross-region replication for compliance artifacts.
- **Recovery process:** infra is reproducible (IaC — Terraform/CDK recommended); recovery = re-apply IaC + restore RDS from PITR + redeploy the last-good ECR tag + re-sync admin. **RPO ≤ 5 min** (PITR), **RTO ≤ 1 hr**. Idempotent payment/webhook handling makes post-recovery replays safe.

## Monitoring Integration

- **Deployment monitoring:** the deploy job waits for ECS service stability + runs a smoke health check; wire deploy start/finish/rollback notifications to Slack (GitHub → Slack app or a notify step). Track DORA metrics (deploy frequency, lead time, change-fail rate, MTTR) from workflow data.
- **Build monitoring:** GitHub Actions insights for pass-rate + duration; alert on `main`/`develop` build failures.
- **Runtime (from Step 33):** CloudWatch alarms (latency/5xx/DB/Redis) + Sentry errors correlated by `request_id`; surface a release marker in Sentry on each deploy.

## DevOps Dashboard Recommendations

- **Deployment visibility:** a board showing current SHA per environment, last deploy time/actor, and rollback button (GitHub Environments + a deployments view, or Backstage/Cortex).
- **Build visibility:** CI pass-rate, flaky-test tracker, coverage trend.
- **Error visibility:** Sentry issues + CloudWatch alarms on one ops dashboard, linked to the deploy that introduced them (release markers).

## CI/CD Readiness Review

**Risks:**
- **High:** production deploy assumes ECS services + task defs (`dnr-backend-<env>`), ECR repo, S3/CloudFront, and the OIDC deploy role already exist — **provision the AWS infra (IaC) first** or the deploy jobs fail. This is the main precondition.
- **Medium:** `package-lock.json` must be committed for `npm ci` (both Node projects); Flutter codegen must succeed in CI (freezed/riverpod) — pin the Flutter version (done: 3.24.x). iOS signed builds + store upload are **not** in this CI (validation only) — a separate fastlane/mobile-release pipeline is needed.
- **Medium:** migration safety — enforce expand/contract migrations so app rollback never needs schema rollback.
- **Low:** Trivy/CodeQL may need tuning to avoid noisy failures initially (start advisory, then enforce).

**Recommendations:** provision infra as code first; commit lockfiles; add the mobile **release** pipeline (fastlane → TestFlight/Play internal) as a sibling workflow; add a staging **DB migration dry-run** check on PRs touching `prisma/`; adopt trunk-friendly squash merges; wire Slack + Sentry release markers.

**Readiness score: 82/100 — "READY ONCE INFRA EXISTS."** The pipeline design is complete, multi-stage, secure (OIDC, no static keys, scanning at every layer), and rollback-capable. The gate is the **AWS infrastructure provisioning** the deploy workflow targets — bounded, standard, and best done as IaC. CI (lint/test/build/scan) is runnable immediately and gates merges today; CD activates the moment the ECS/ECR/S3/CloudFront resources + OIDC role are in place.
