# DNR Pest Control — Security Audit & Testing Plan

**Classification:** Confidential — Internal Security Review
**Scope:** NestJS backend, Flutter mobile app, React admin dashboard, authentication, payments (Stripe), Firebase, AWS (S3/CloudFront)
**Standards:** OWASP API Security Top 10 (2023), OWASP Mobile Top 10 / MASVS, OWASP ASVS
**Method:** Architecture + source review of the delivered codebase and design specs, mapped to OWASP. Findings are evidence-based; where a control is specified in design docs but not yet present in materialized code, it is flagged as *unverified/unwired* rather than assumed present or absent.

---

## Executive Summary

The platform has a **strong security foundation**: modern password and token cryptography (argon2), rotating opaque refresh tokens with reuse-detection design, Stripe signature-verified webhooks with no raw card data on the server, parameterized database access, encrypted token storage on mobile, and an audit-log facility. The cryptographic and auth *design* is above average for a platform at this stage.

The principal risk is **not weak design — it is unwired global controls.** The application bootstrap (`main.ts`) that the design specifies to register Helmet, the CORS allow-list, the global `ValidationPipe`, URI versioning, the exception filter, and the **raw-body parser the Stripe webhook depends on** is not present in the reviewed code (it is part of a pending backend consolidation pass). There is also **no global HTTP rate limiting** (only per-user chat throttling). Until those are wired and verified, the live posture is weaker than the design implies.

**Security Readiness Score: 72 / 100 — "Strong core, gated on wiring."** Not launch-ready as-is; the must-fix list below is small and well-defined.

---

## 1. Security Architecture Review

| Layer | Posture | Notes |
|---|---|---|
| Transport | Designed TLS + HSTS | Enforce TLS 1.2+ at ALB/CloudFront; HSTS depends on `main.ts`/edge config (unwired). |
| Auth | **Strong** | Firebase IdP → backend mints app JWTs; argon2; rotating refresh tokens. |
| AuthZ | RBAC matrix + guards | Verify enforcement on every resource (IDOR sweep). |
| Data | **Strong** | Prisma parameterized; analytics raw SQL parameterized + `date_trunc` whitelisted. |
| Secrets | Config/env | `getOrThrow` for JWT + webhook secrets — good; ensure delivered via AWS Secrets Manager, not `.env` in image. |
| Edge controls | **Unwired** | Helmet/CORS/global pipe/rawBody specified, not in materialized `main.ts`. |
| Observability | Audit log present | Expand coverage + tamper-resistance (below). |

**Trust boundaries:** mobile/admin client → API gateway/ALB → NestJS → (PostgreSQL, Stripe, Firebase, S3). Stripe→backend webhook is a distinct inbound boundary authenticated by signature, not session. Each boundary is identified and individually controlled — good architecture.

---

## 2. Authentication Security Review

**JWT implementation** — *Verified.* Access tokens signed with a secret from config (`jwt.accessSecret`, `getOrThrow`), 15-minute TTL. **Remediations:** pin the algorithm explicitly (reject `alg:none` / RS↔HS confusion), set and validate `iss` + `aud`, allow small clock skew only.

**Refresh tokens** — *Verified, strong.* Opaque `"<id>.<secret>"`, only an **argon2 hash** stored, **rotated on every use** with the old one revoked. This enables refresh-token **reuse detection**: if a revoked/rotated token is presented, treat it as theft and revoke the whole family/session. **Remediation:** ensure reuse triggers family revocation (confirm), and that logout + account suspension revoke all refresh tokens.

**Session handling** — Stateless access tokens mean a suspended user retains access until token expiry (≤15 min). **Remediation:** acceptable for most actions, but add a fast revocation path (short deny-list / `token_version` claim bumped on suspend) for high-impact roles (admins, technicians).

**Password reset flow** — *Partially verified.* New password is argon2-hashed on reset. **Remediations / verify:** reset tokens must be single-use, short-TTL, hashed at rest, rate-limited, and the request endpoint must **not reveal whether an email exists** (constant-time, generic response). Invalidate sessions on password change.

**Social login security** — Firebase IdP exchange. **Remediations / verify:** backend must `verifyIdToken` (signature, `aud`=project, `iss`, expiry) and require `email_verified` before issuing app JWTs; prevent **account-linking takeover** (same email across Google/Apple/password must resolve to one identity deliberately, not auto-merge); never trust client-supplied role/email — derive server-side.

---

## 3. Authorization Review

**RBAC** — Roles (CUSTOMER, TECHNICIAN, SUPER_ADMIN, OPERATIONS_MANAGER, DISPATCHER, CUSTOMER_SUPPORT) with a permission matrix and role guards; bookings use owner-scoped `where` clauses. **Strong design.**

**Privilege escalation risks** — **Must verify:** (a) role/`role_id` cannot be set or changed via registration/profile-update DTOs (mass-assignment) — the global `ValidationPipe` `forbidNonWhitelisted` is the control, which is currently *unwired*; (b) admin role changes are audited; (c) horizontal escalation — a customer cannot read another customer's bookings/invoices/payments/media/chat by ID (**IDOR**).

**Access control testing** — every `GET/PATCH /:id` must enforce ownership or role, not just authentication. Treat object-level authorization as the #1 pentest objective (OWASP API1).

---

## 4. API Security Review

| Check | Finding | Severity |
|---|---|---|
| Authentication required | Guards present; **global guard wiring lives in unwired `main.ts`** — confirm no route is unintentionally public | High (until verified) |
| **Rate limiting** | **Absent globally** (only per-user chat). Brute-force/credential-stuffing on `/auth/login`, reset abuse, scraping, payment hammering | **High** |
| Input validation | Designed `whitelist + forbidNonWhitelisted + transform`, **not wired** | High (until verified) |
| Injection protection | **Strong** — Prisma parameterized; raw SQL parameterized + unit whitelisted | Low |
| API abuse | Idempotency-Key on booking/payment POSTs (good); no global quotas/WAF | Medium |

**Remediations:** wire the global ValidationPipe; add `@nestjs/throttler` globally with **stricter limits on `/auth/*` and `/payments/*`**; add a WAF (AWS WAF) with rate-based + common-rule sets; enforce response pagination caps; add request-size limits.

---

## 5. Mobile Security Review

**Secure / token storage** — *Verified.* Tokens in `flutter_secure_storage` (iOS Keychain, Android EncryptedSharedPreferences). Good. **Remediation:** set Android `EncryptedSharedPreferences` option explicitly and iOS `first_unlock_this_device` accessibility; never cache tokens in plain prefs or logs.

**Certificate pinning** — **Absent.** **Recommendation (Medium):** pin the API + Stripe TLS certificates/public keys in Dio (e.g. `badCertificateCallback` against a pinned SPKI set) with a backup pin and a rotation plan, to resist MITM on hostile networks.

**Sensitive data handling** — **Remediations:** confirm `pretty_dio_logger` is **debug-only** (must not log Authorization headers/tokens in release); disable screenshots on payment/PII screens (`FLAG_SECURE` / iOS equivalent); exclude tokens from OS backups; scrub PII from crash/analytics; consider root/jailbreak detection and Firebase App Check for API attestation.

---

## 6. Admin Dashboard Security Review

**Session security** — SPA stores tokens (foundation uses localStorage). **Remediation:** localStorage is XSS-exposed; prefer in-memory access token + httpOnly, `Secure`, `SameSite=Strict` refresh cookie if the deployment allows, or accept the trade-off with a hard CSP. Enforce idle + absolute session timeouts; bind the admin app to its own CORS origin.

**Role enforcement** — UI gating exists (`Can`, `PermissionRoute`) but is **cosmetic**; the **server is the authority**. **Remediation:** verify every admin endpoint re-checks role server-side (don't trust the dashboard's hidden buttons).

**Audit logging** — `AuditLog` exists (exports, etc.). **Remediations:** log all privileged actions (status changes, refunds, role edits, assignments, data exports) with actor, target, before/after, IP, timestamp; make logs **append-only/tamper-evident** (separate store or WORM); never log secrets/PAN/tokens.

---

## 7. Stripe / Payment Security Review

**PCI** — *Strong.* Server **never handles raw card data** (clients confirm PaymentIntents with Stripe directly), keeping scope at **SAQ-A**. Keep it that way: no PAN in logs, DB, or transit through the API.

**Webhook validation** — *Verified design.* `constructEvent(rawBody, signature, webhookSecret)` with the secret from `getOrThrow`. **Critical dependency:** signature verification requires the **raw request body**; the webhook controller's own comments note this needs `NestFactory.create(AppModule, { rawBody: true })` in `main.ts` — which is **unwired**. If a JSON body-parser runs first, verification breaks (best case: payments never confirm; worst case: a naive "fix" disables verification → forged payment events). **Must-fix.**

**Payment handling** — Idempotent webhook application (duplicate `succeeded` events don't double-apply), refunds admin-gated + audited, amounts as Decimal strings. **Remediations:** enforce idempotency keys server-side, reconcile against Stripe as source of truth, and verify event `livemode`/account to reject cross-account replay.

---

## 8. Firebase Security Review

- **ID token verification** must happen server-side on every IdP login (see §2). 
- **FCM:** send only from the backend with the Admin SDK; never embed server keys in the app; treat device tokens as semi-public (no secrets in notification payloads).
- **App Check (recommended):** attest that API/Firebase calls originate from genuine app builds to cut bot/abuse.
- If Firestore/Storage are **not** used directly by clients (only Auth + FCM here), keep it that way; if ever added, ship locked-down Security Rules (default deny).

---

## 9. AWS S3 Security Review

| Check | Remediation |
|---|---|
| Bucket policies | **Block Public Access = ON** at account + bucket; no public-read ACLs; serve via **CloudFront with Origin Access Control**, not direct S3 URLs. |
| Signed URLs | Presigned uploads/downloads short-TTL (e.g. ≤5 min), method- and content-type-constrained, size-capped via policy; per-user key namespacing. |
| File access controls | Authorize ownership before issuing a URL (prevent IDOR on media keys); randomize keys (no user-guessable paths); enforce `Content-Type` + max size; **malware scan** (e.g. on-upload Lambda/ClamAV); **re-encode images** to strip EXIF/polyglot payloads; encrypt at rest (SSE-KMS); reject path traversal in keys. |

---

## 10. OWASP API Security Top 10 (2023) Checklist

| # | Risk | Status | Action |
|---|---|---|---|
| API1 | Broken Object Level Auth (IDOR) | ⚠ Verify | Owner/role check on every `:id` route; pentest priority |
| API2 | Broken Authentication | ✅ Strong | Pin JWT alg; reset-token hardening; reuse detection |
| API3 | Broken Object Property Level Auth | ⚠ Wire | `forbidNonWhitelisted` (unwired); block role mass-assignment |
| API4 | Unrestricted Resource Consumption | ❌ Gap | Global rate limiting + size/pagination caps + WAF |
| API5 | Broken Function Level Auth | ⚠ Verify | Server-side role checks on admin endpoints |
| API6 | Unrestricted Access to Sensitive Flows | ⚠ | Throttle login/reset/payment; bot protection (App Check) |
| API7 | SSRF | ✅ Low | Validate any server-side fetch (geocoding) allow-list |
| API8 | Security Misconfiguration | ❌ Gap | Helmet/CORS/HSTS/global pipe unwired in `main.ts` |
| API9 | Improper Inventory Management | ⚠ | Lock Swagger in prod; version + retire endpoints |
| API10 | Unsafe Consumption of 3rd-party APIs | ✅ | Verify Stripe/Firebase responses; webhook signature |

## 11. OWASP Mobile Top 10 / MASVS Checklist

| Area | Status | Action |
|---|---|---|
| M1 Credential/Improper use | ✅ | argon2 server-side; secure storage client-side |
| M2 Inadequate Supply Chain | ⚠ | Pin deps; verify Firebase/Stripe SDK integrity |
| M3 Insecure Auth/Authz | ✅/⚠ | Strong tokens; verify server-side authz |
| M4 Insufficient Validation | ⚠ | Validate inputs both client + server |
| M5 Insecure Communication | ⚠ | TLS ✓; **add certificate pinning** |
| M6 Inadequate Privacy | ⚠ | Scrub PII from logs/analytics; screenshot protection |
| M7 Insufficient Binary Protection | ⚠ | Obfuscation (`--obfuscate`), root/jailbreak detection |
| M8 Security Misconfiguration | ⚠ | Release-mode logging off; backup flags |
| M9 Insecure Data Storage | ✅ | Secure storage verified |
| M10 Insufficient Cryptography | ✅ | argon2; rely on platform TLS/crypto |

---

## 12. Penetration Testing Plan

*Test objectives + methodology for an authorized engagement against staging — not exploit payloads.*

**Authentication tests:** credential stuffing / brute force on `/auth/login` (expect throttling); refresh-token **reuse** after rotation (expect family revocation); JWT tampering — alg confusion, `alg:none`, signature strip, expired/forged `sub`/`role`; password-reset token reuse, expiry, and **user-enumeration** via timing/response differences; session fixation after reset.

**Authorization tests:** IDOR sweep — as customer A, access B's booking/invoice/payment/media/chat by ID; horizontal + vertical escalation; role mass-assignment on register/profile update; admin endpoints called with a non-admin token; technician accessing unassigned jobs.

**API attacks:** mass assignment, parameter pollution, oversized payloads, pagination abuse (`limit=10^9`), missing-auth route discovery, Swagger exposure in prod, idempotency-key replay, content-type confusion.

**File upload attacks:** wrong/forged MIME + magic bytes, oversized files, double extensions, SVG/HTML XSS, EXIF/polyglot payloads, path traversal in object keys, accessing another user's media via presigned-URL key guessing, re-use/expiry of presigned URLs.

**Payment attacks:** forged/replayed Stripe webhooks (no/invalid signature; cross-account `livemode`); price/amount tampering client-side vs server authority; double-charge / idempotency bypass; refund authorization bypass; confirming a PaymentIntent for another customer's invoice (IDOR).

---

## 13. Vulnerability Assessment (classified)

**Critical** — *(conditional)* Stripe webhook **raw-body not wired** → if launched without `rawBody:true`, payment confirmation breaks or invites an insecure bypass. Becomes Critical at launch if unaddressed.

**High**
1. **No global rate limiting** — auth brute force / API abuse (API4/API6).
2. **Global security middleware unwired** in `main.ts` — Helmet, CORS allow-list, HSTS, global ValidationPipe, global auth guard (API8/API3). Currently design-only.
3. **Unverified object-level authorization (IDOR)** across non-booking resources (API1).

**Medium**
1. No TLS **certificate pinning** on mobile (M5).
2. Admin token in **localStorage** (XSS exposure) absent a strict CSP.
3. Password-reset hardening (single-use/expiry/enumeration) unconfirmed.
4. Social-login token verification + account-linking unconfirmed.
5. S3 upload AV scanning + image re-encode not evidenced.
6. Stateless access token = up to 15-min revocation lag for suspended privileged users.

**Low**
1. Swagger exposure in prod (lock down).
2. Verbose Dio logging if shipped in release.
3. SSRF surface in server-side geocoding (allow-list).

---

## 14. Security Hardening Recommendations

1. **Wire `main.ts`:** `rawBody: true`; Helmet; strict CORS allow-list (mobile schemes + admin origin); global `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`; `GlobalExceptionFilter`; URI versioning; Swagger disabled/authed in prod.
2. **Rate limiting:** `@nestjs/throttler` globally + stricter on `/auth/*` and `/payments/*`; AWS WAF rate-based rules.
3. **Object-level authz:** centralize an ownership/role assertion helper; apply to every resource read/write; cover with the integration tests already scaffolded.
4. **Token lifecycle:** pin JWT alg + `iss`/`aud`; confirm refresh-reuse family revocation; fast revocation on suspend.
5. **Secrets:** AWS Secrets Manager / SSM, rotation; never in the image or repo.
6. **Mobile:** certificate pinning; release-mode log scrubbing; screenshot/backup protection; App Check.
7. **S3:** Block Public Access, CloudFront OAC, short signed URLs, AV scan + image re-encode, SSE-KMS.
8. **Admin:** CSP + httpOnly refresh cookie or in-memory tokens; idle/absolute timeouts.
9. **Headers/transport:** HSTS preload, TLS 1.2+, secure cookies.

---

## 15. Incident Response Recommendations

- **Detect:** centralized logging (CloudWatch/SIEM), alerts on auth-failure spikes, refresh-reuse events, webhook signature failures, privilege changes, mass data exports.
- **Contain:** kill-switch to revoke all refresh tokens / bump `token_version`; per-account lock; Stripe key + JWT secret rotation runbook; WAF block lists.
- **Eradicate/Recover:** documented rotation for JWT/webhook/DB/Firebase/AWS credentials; PITR for PostgreSQL; versioned S3 for media recovery.
- **Notify:** breach-notification process aligned to applicable data-protection law; Stripe + Firebase incident contacts.
- **Prepare:** tabletop exercises for account-takeover, payment-fraud, and data-export-abuse scenarios; immutable audit-log retention.

---

## 16. Security Readiness Score

**72 / 100 — Strong core, gated on wiring.**
The cryptography, token design, payment-signature model, and data-access layer are solid. The score is held down by **unwired global controls** and **missing rate limiting** — low-effort, high-impact fixes rather than redesigns.

### Must-fix before launch
1. **Wire `main.ts`** — `rawBody:true` (Stripe), Helmet, strict CORS, global ValidationPipe (`forbidNonWhitelisted`), global auth guard, prod-locked Swagger.
2. **Global rate limiting** — throttler + WAF, strict on auth/payment.
3. **Verify object-level authorization (IDOR)** on every `:id` resource; block role mass-assignment.
4. **Confirm Stripe webhook signature path end-to-end** on the wired app (raw body → `constructEvent`).
5. **Harden password reset** — single-use, expiring, hashed, rate-limited, non-enumerable.
6. **Verify Firebase ID-token validation + account-linking** server-side.

Re-score after these: estimated **88–90 / 100** (launch-acceptable), with the Medium mobile/admin items as fast-follows.

---

*Prepared as a defensive security review. The penetration-testing plan is a set of authorized test objectives for staging; execute only against systems you own with written authorization.*
