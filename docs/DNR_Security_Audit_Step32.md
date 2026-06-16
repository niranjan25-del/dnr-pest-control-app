# DNR Pest Control — Security Hardening & Security Audit
**Step 32 · Application Security Assessment**
Prepared by: Principal Application Security Architect / OWASP Specialist / Penetration Testing Consultant / Cloud Security Engineer
Scope: Backend (NestJS/Prisma/Postgres/JWT/Stripe/Firebase), Flutter app, React Admin, AWS infrastructure. No code, architecture, or test regeneration — assessment + remediation only.

---

## 1. Executive Summary

The DNR platform demonstrates a **mature, defense-in-depth security baseline** built in from the start, not bolted on. Authentication uses bcrypt + short-lived access tokens + rotating refresh tokens with reuse-resistant design; authorization is enforced server-side via role + permission guards with per-row ownership scoping; the Stripe webhook verifies signatures against the raw body; media uploads are magic-byte sniffed; secrets are validated at boot; and the global pipeline ships `helmet`, a CORS allow-list, a global rate limiter with tightened auth-route limits, a uniform error envelope, and structured logging with redaction.

**Overall Security Readiness: 80/100 — "CONDITIONAL GO."** No Critical, network-exploitable vulnerability was found in the application logic. The gaps that remain are a small set of **well-understood hardening items** — most already flagged in code comments by the implementers — concentrated in three areas: **(1) a dev-only password-reset token still returned in the API response, (2) permissive WebSocket CORS, and (3) admin tokens in `localStorage`.** None require redesign; all are bounded fixes that should close before production traffic.

**Posture by surface:** Backend **84**, Mobile **86**, Admin **74**, AWS/Infra **72** (configuration-dependent, see §9).

---

## 2. Vulnerability Findings

Severity uses CVSS-style banding (Critical/High/Medium/Low) with exploitability + impact.

### 2.1 Authentication

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| **A-1** | **High** | **Password-reset token returned in the `/auth/forgot-password` response.** The service returns `{ success, reset_token }` for dev convenience; the gating is only a code comment, not enforced. In production this hands an account-takeover primitive to anyone who can call the endpoint. | `auth.service.ts` returns `reset_token`; controller does not strip it by env. |
| A-2 | Low (mitigated) | Reset token is **derived from the user's current password hash** → single-use by construction (a successful reset invalidates it). Good design. | `auth.service.ts` header note. |
| A-3 | Low | Login + forgot-password are **throttled tighter than global** (10/min, 5/min). Good. | `auth.controller.ts` `@Throttle`. |
| A-4 | Info | Refresh tokens **rotate** on use; access tokens short-lived. Confirm reuse-detection (revoke the family on a replayed refresh) is active. | refresh flow. |

**Remediation A-1 (must-fix):** gate the field on `NODE_ENV !== 'production'` (or remove entirely and rely on the emailed link). One-line controller/service guard.

### 2.2 Authorization & Privilege Escalation

| ID | Sev | Finding |
|---|---|---|
| Z-1 | Low | **RBAC enforced server-side** via `RolesGuard` + `@Roles`/`@Permissions`; clients only gate UI. Per-row scoping resolvers (customer-own / technician-assigned / admin-all) appear in every data module. No horizontal/vertical escalation path found in review. |
| Z-2 | Medium | **Admin sub-role boundaries** (Operations Manager / Dispatcher / Customer Support) are partly marked "limited/conditional" in the matrix; confirm the backend enforces the *narrow* interpretation (e.g. Dispatcher cannot mutate catalog/pricing even via direct API). Test per §11. |
| Z-3 | Medium | **Admin analytics reachable by Customer Support** (the React analytics section is gated by `ViewDashboard`, which Support holds) — least-privilege drift vs PRD. Fix client gate **and** verify the analytics endpoints reject Support server-side. |

**Privilege-escalation analysis:** the dual-control model (client hides, server enforces) is correct. The residual risk is **contract drift** between the client permission matrix and the backend `role_permissions` — close it by treating the backend as the single source and generating the client matrix from it, or by an automated parity test.

### 2.3 API Security (Injection / XSS / CSRF / SSRF)

| ID | Sev | Finding |
|---|---|---|
| API-1 | Low | **SQL injection:** Prisma parameterizes all queries; the few `$queryRaw` analytics calls use `Prisma.sql` with parameters and a **whitelisted** `date_trunc` token — safe. Keep the whitelist; never interpolate user input into `Prisma.raw`. |
| API-2 | Low | **NoSQL injection:** N/A (Postgres only). |
| API-3 | Low | **XSS:** API returns JSON; React escapes by default. Audit any `dangerouslySetInnerHTML` (none expected) and ensure user-supplied report/notes text is rendered as text, not HTML. |
| API-4 | Medium | **CSRF:** tokens are sent as `Authorization: Bearer` (not cookies) → CSRF largely N/A for the API. **But** if admin tokens move to cookies (a recommended XSS mitigation), add SameSite=strict + CSRF tokens. Decide the cookie-vs-localStorage trade-off deliberately (see Admin-1). |
| API-5 | Medium | **SSRF:** the report/PDF generator and media flows **fetch from S3 via presigned URLs** and the ETA path calls Google Maps. Ensure no endpoint fetches a **user-supplied URL** server-side; if any does (e.g. avatar-by-URL), allow-list hosts + block link-local/metadata ranges (169.254.169.254). |
| API-6 | Low | **Input validation:** global `ValidationPipe` (whitelist + transform) + class-validator DTOs on every endpoint → strong. Mass-assignment blocked by `whitelist`. |
| API-7 | Low | **Rate limiting:** global Throttler + targeted `@Throttle` on auth/chat/location/media/coupons. Recommend adding to `POST /media/signed-url` mint + `create-intent`. |

### 2.4 Mobile (OWASP Mobile)

| ID | Sev | Finding |
|---|---|---|
| M-1 | Low (good) | **Secure token storage is already hardened:** `FlutterSecureStorage` with Android `EncryptedSharedPreferences` + iOS Keychain `first_unlock`. Access + rotating refresh only; cleared on logout/401. |
| M-2 | Medium | **No certificate pinning.** Add pinning (or platform network-security config) for prod to resist MITM on hostile networks. |
| M-3 | Low | **Reverse-engineering resistance:** enable code shrinking/obfuscation (`--obfuscate --split-debug-info`) for release; no secrets in the binary (keys injected via `--dart-define`, Stripe uses publishable key only). |
| M-4 | Low | **Local data:** no PII cached in plaintext beyond the secure store; ensure the offline outbox doesn't persist sensitive bodies unencrypted. |

### 2.5 Admin Dashboard

| ID | Sev | Finding |
|---|---|---|
| **Admin-1** | **High** | **Tokens (access + refresh) in `localStorage`** → XSS-exfiltratable. The code flags this with a memory-swap note. |
| Admin-2 | Medium | Analytics RBAC drift (Z-3). |
| Admin-3 | Low | Refresh is single-flight with session-clear on failure; error envelope carries `request_id`, not PII. Good. |

**Remediation Admin-1 (must-fix):** move the **access token to memory** (module variable) and keep only the rotating refresh token in storage — or use an **HttpOnly+SameSite cookie** for the refresh token if the backend can set it. The `tokenStorage` interface is already localized for this swap.

### 2.6 Stripe / Payments

| ID | Sev | Finding |
|---|---|---|
| P-1 | Low (good) | **Webhook signature verified against the raw body** (`rawBody: true` preserved); idempotent handlers; amounts **server-computed** (client never sets price). |
| P-2 | Low (good) | **No card data on platform** — Stripe holds PANs + payment methods; only `stripeCustomerId`/intent ids persisted → PCI-DSS SAQ-A posture. |
| P-3 | Medium | Confirm **webhook idempotency under replay** (dedupe on event id) and that refund endpoints are admin-gated + audited. Add `@Throttle` to `create-intent`. |

### 2.7 Firebase

| ID | Sev | Finding |
|---|---|---|
| F-1 | Low | Firebase is the IdP; backend **verifies the ID token** server-side before issuing app JWTs. Good. Confirm the service-account key is supplied via secret manager, never committed. |
| F-2 | Low | **FCM:** server-authoritative sends; clients can't broadcast. Ensure notification payloads don't carry sensitive data (titles/bodies may surface on lock screens). |

### 2.8 AWS / Infrastructure (configuration-dependent)

| ID | Sev | Finding |
|---|---|---|
| AWS-1 | Medium | **S3 bucket must be private** with public-access-block ON; serve only via **CloudFront + OAC** and **presigned, expiring** URLs (300s in code). Verify no public ACLs. |
| AWS-2 | Medium | **IAM least-privilege:** the app task role should hold only `s3:GetObject/PutObject/DeleteObject` on the media bucket prefix — no `s3:*`, no `*` resource. Prefer task-role credentials over static `AWS_ACCESS_KEY_ID`. |
| AWS-3 | Medium | **Secrets** (`JWT_*`, `STRIPE_SECRET_KEY`, `FIREBASE_PRIVATE_KEY`, `CLOUDFRONT_PRIVATE_KEY`, `DATABASE_URL`) belong in **Secrets Manager/SSM**, injected at runtime — never in the image or `.env` committed. Note **`CLOUDFRONT_KEY_PAIR_ID`/`PRIVATE_KEY`/`REDIS_URL` are read but missing from `.env.example`** (Step 19). |
| AWS-4 | Low | CloudFront: HTTPS-only, TLS1.2+, signed URLs/cookies for private media; WAF in front (rate + common-rule managed sets). |

### 2.9 File Upload / Chat / GPS

| ID | Sev | Finding |
|---|---|---|
| U-1 | Low (good) | Uploads validated by **declared MIME + category allow-list + magic-byte sniffing**; private bucket; size caps. |
| U-2 | Medium | **No malware scanning.** Add async AV (ClamAV/Lambda or a scanning service) on upload; quarantine until clean for any admin-downloaded artifact. |
| C-1 | Low | Chat authorization enforces the participant matrix (customer↔assigned-tech/admin) on REST **and** socket; attachments via presigned URLs scoped to the conversation. Confirm the socket re-checks room membership on every `sendMessage`. |
| **WS-1** | **Medium** | **WebSocket CORS is `origin: true`** on both `/chat` and `/location` gateways — any origin may attempt a handshake (JWT still required, so not auth-bypass, but it widens CSWSH/abuse surface). **Restrict to the configured origins** like the REST layer. |
| G-1 | Low | Location updates require JWT + technician scope; ingestion throttled (~2/s). Ensure customers can only subscribe to **their own** booking's technician track (authorization on `subscribeBooking`). |

### 2.10 Logging & Audit

| ID | Sev | Finding |
|---|---|---|
| L-1 | Low (good) | `pino` request logging with **redaction**; `AuditLog` rows for sensitive admin actions (refunds, status, broadcasts, exports). |
| L-2 | Medium | **Audit completeness:** confirm auth events (login success/fail, reset, refresh-reuse) are audited, and that logs **mask** tokens/PII/`Authorization` headers everywhere (not just the request logger). Audit log is currently **write-only** — add a gated read surface for investigations. |

---

## 3. OWASP Top 10 Mapping

**OWASP API Security Top 10 (2023):**
| Risk | Status |
|---|---|
| API1 Broken Object-Level Auth (BOLA) | ✅ per-row ownership scoping in every module — the most important control, present. Pen-test to confirm (§11). |
| API2 Broken Authentication | ⚠️ strong, except **A-1** reset-token exposure. |
| API3 Broken Object Property-Level Auth | ✅ `ValidationPipe whitelist` blocks over-posting; responses are mapped, not raw entities (mostly). |
| API4 Unrestricted Resource Consumption | ✅ Throttler; ⚠️ add limits to presign + create-intent (API-7/P-3). |
| API5 Broken Function-Level Auth | ✅ `RolesGuard`; ⚠️ verify admin sub-role narrowing (Z-2). |
| API6 Unrestricted Access to Sensitive Business Flows | ✅ idempotent payments; coupon redeem throttled + tx-guarded. |
| API7 SSRF | ⚠️ confirm no user-URL server fetch (API-5). |
| API8 Security Misconfiguration | ⚠️ WS CORS (WS-1); ensure prod helmet/CSP, no stack traces. |
| API9 Improper Inventory Management | ⚠️ add OpenAPI/Swagger gated in prod; version inventory. |
| API10 Unsafe Consumption of 3rd-party APIs | ✅ Stripe sig-verified; Maps responses validated defensively. |

**OWASP Mobile Top 10 (2024):** M1 Credential (✅ secure storage), M2 Inadequate Supply Chain (pin deps), M3 Insecure Auth (✅), M4 Insufficient I/O Validation (✅), M5 Insecure Comm (⚠️ **add cert pinning, M-2**), M6 Inadequate Privacy (mask FCM payloads, F-2), M7 Insufficient Binary Protection (⚠️ **obfuscate, M-3**), M8 Misconfig (✅), M9 Insecure Data Storage (✅), M10 Insufficient Cryptography (rely on platform TLS/Keychain — ✅).

---

## 4. Risk Assessment (classified)

- **Critical:** none found in application logic.
- **High:** A-1 (reset token exposure), Admin-1 (localStorage tokens).
- **Medium:** WS-1 (socket CORS), M-2 (cert pinning), U-2 (malware scan), Z-2/Z-3 (admin sub-role/analytics drift), API-4/API-5 (CSRF-if-cookie / SSRF confirm), P-3 (webhook replay/throttle), AWS-1/2/3 (S3/IAM/secrets config), L-2 (audit completeness/masking).
- **Low:** the remainder (mostly already-good controls to keep).

---

## 5. Remediation Plan (prioritized)

**P0 — before production (the must-fix set):**
1. **A-1:** stop returning `reset_token` in prod (env-gate or remove); deliver via email only.
2. **Admin-1:** move admin access token out of `localStorage` (memory + rotating refresh, or HttpOnly cookie).
3. **WS-1:** restrict `/chat` + `/location` gateway CORS to the configured origin allow-list.
4. **AWS-1/2/3:** verify private S3 + OAC, least-privilege task-role IAM, secrets in Secrets Manager; add the missing CloudFront/Redis env vars.

**P1 — pre-launch hardening:**
5. **M-2** cert pinning; **M-3** release obfuscation.
6. **Z-3** fix analytics RBAC drift (client + server); **Z-2** verify admin sub-role narrowing.
7. **U-2** async malware scanning on uploads.
8. **P-3** webhook idempotency dedupe + `create-intent`/presign throttles.
9. **L-2** audit auth events + token/PII masking; add gated audit-log read.

**P2 — depth:**
10. WAF in front of CloudFront/API; CSP headers on the admin app; OpenAPI inventory (gated); automated RBAC parity test (client matrix ↔ backend `role_permissions`); SSRF host allow-list if any user-URL fetch exists.

---

## 6. Penetration Testing Plan

**Authentication attacks:** credential stuffing vs login throttle; reset-token harvesting (**A-1** — confirm fixed); refresh-token replay (expect family revoke); JWT tampering (alg=none, wrong-key) — expect 401; enumeration via login/forgot timing.
**Authorization attacks (BOLA/BFLA):** as Customer A, access B's booking/invoice/report by id → expect 403; as Dispatcher, hit catalog/pricing/coupon mutation endpoints → expect 403; as Customer Support, hit analytics endpoints → expect 403 (Z-3); IDOR sweep on every `:id` route.
**API attacks:** mass-assignment (post `role`/`status`) → stripped; SQLi on filters/search → parameterized; SSRF on any URL field; rate-limit bypass.
**Payment attacks:** forge webhook without signature → reject; replay a `succeeded` event → single state change; tamper client amount → server recomputes; refund as non-admin → 403.
**File-upload attacks:** rename `.exe`→`.jpg` (magic-byte catches); SVG/HTML XSS payload; oversized/zip-bomb; path traversal in filename; upload then fetch others' media by id → 403.

---

## 7. Security Hardening Checklist

**Backend:** ☐ env-gate reset token (A-1) ☐ socket CORS allow-list (WS-1) ☐ throttle presign + create-intent ☐ webhook event-id dedupe ☐ audit auth events + mask tokens/PII ☐ confirm admin sub-role enforcement ☐ Swagger gated in prod ☐ no stack traces in prod responses.
**Mobile:** ☐ cert pinning ☐ release `--obfuscate --split-debug-info` ☐ confirm offline outbox has no plaintext sensitive bodies ☐ mask FCM payloads ☐ jailbreak/root awareness (optional).
**Admin:** ☐ access token out of localStorage ☐ CSP + SameSite (if cookies) ☐ fix analytics RBAC drift ☐ dependency audit (`npm audit`) ☐ subresource integrity for any CDN scripts.
**AWS:** ☐ S3 public-access-block + OAC-only ☐ least-privilege task-role IAM (prefix-scoped) ☐ secrets in Secrets Manager ☐ CloudFront HTTPS-only + WAF ☐ add CloudFront/Redis env vars ☐ RDS in private subnet, SG-restricted, encryption at rest ☐ CloudTrail + GuardDuty on.

---

## 8. Incident Response Plan

**Workflow:** Detect (alert: 5xx spike, auth-failure spike, WAF blocks, GuardDuty finding) → Triage (severity + scope; assign IC) → Contain (rotate the relevant secret/JWT signing key, revoke refresh-token families, block IPs at WAF, disable the affected endpoint via feature flag) → Eradicate (patch, redeploy) → Recover (restore from backup if data touched; re-enable) → Post-mortem (blameless; timeline; corrective actions).
**Escalation:** On-call engineer → Security lead (≤30 min for High/Critical) → CTO + Legal/DPO if PII/payment data is implicated (breach-notification clock starts). **Specific playbooks:** JWT-signing-key compromise → rotate `JWT_*`, invalidate all sessions; Stripe key leak → roll key in dashboard + redeploy + audit charges; S3 exposure → flip bucket private, rotate presign key-pair, audit access logs.

---

## 9. Security Readiness Score

| Surface | Score | Notes |
|---|---:|---|
| Backend | 84 | Strong authn/z, validation, webhook + media hygiene; deduct A-1, WS-1, audit/masking. |
| Mobile | 86 | Secure storage already hardened; deduct cert pinning + obfuscation. |
| Admin | 74 | Solid refresh/RBAC; deduct localStorage tokens + analytics drift. |
| AWS/Infra | 72 | Config-dependent; deduct until S3/IAM/secrets/WAF verified. |
| **Overall** | **80** | **CONDITIONAL GO.** |

**Must-fix before production (P0):** A-1 reset-token exposure · Admin-1 localStorage tokens · WS-1 socket CORS · AWS-1/2/3 S3+IAM+secrets verification.

**Go/No-Go: CONDITIONAL GO** — the application's security architecture is production-grade; clear the four P0 items (all bounded, several one-line) and verify the AWS configuration, then proceed. No Critical application vulnerability blocks the path; the residual risk is hardening and cloud-config verification, not redesign.

---

## 10. Recommended Next Steps

1. Close P0 (½–1 day of focused changes + a cloud-config review).
2. Run the §6 pen-test plan (internal or third-party) against staging; prioritize the BOLA/IDOR sweep and the payment-webhook tests.
3. Stand up WAF + GuardDuty + CloudTrail; wire security alerts into the incident workflow.
4. Add the automated RBAC parity test + dependency scanning (`npm audit`, Dependabot, `flutter pub outdated`) to CI.
5. Re-score after P0 + pen-test → expected ≥ 90 and full GO.
```
