## DNR Pest Control — File Upload & Media Management Module (Step 30)

**Module:** `media` (NestJS) — production-ready
**Builds on:** Prisma schema (17) · Auth (18) · Users & Profiles (19) · Bookings (21) · Dispatch (22) · Chat (29) · Invoices (25)
**Tech:** NestJS · Prisma · PostgreSQL · **AWS S3** · **CloudFront** (recommended)
**Scope:** Media ONLY. No other modules generated.

> **This is the canonical media layer.** Invoices (25) and Chat (29) each built a small local S3 helper; this module centralizes upload, validation, signed URLs, ownership, and cleanup on the existing `UploadedFile` model. Those two can later be refactored to call `MediaService`/`S3Service` (exported) — no edits made here.

> **Reconciliations (no migration required):**
> - **Profile image:** no avatar column → tracked as a `user_avatar` UploadedFile; the *current* avatar = latest active one. (Optional: add `avatarFileId` to the profile for an explicit pointer.)
> - **Before/after/report photos:** `ServiceReport` has no subtype column → encoded via distinct `relatedEntityType` values (`service_report_before/_after/_attachment`), with `relatedEntityId = bookingId` for uniform authorization.
> - **Malware status:** no scan-status column → scanning is an in-band pre-upload gate (reject on infected). For async/quarantine workflows, add a `scanStatus` column (optional).

---

## Module Structure
```
src/modules/media/
├── media.module.ts
├── media.controller.ts      # upload, presign, confirm, list, download-url, delete, profile-image
├── media.service.ts         # validate+scan+S3+record, access control, cleanup crons
├── s3.service.ts            # put/get/delete/head, presigned PUT/GET, CloudFront signed URLs
├── interfaces/ media.interfaces.ts   # MediaCategory + config + MalwareScanner contract
├── validators/ file.validator.ts · noop-malware-scanner.ts
└── dto/ upload-media · presign-upload · confirm-upload · query-media
```

## Supported Files & Validation
JPG, PNG, WEBP, PDF. Validation enforces: **size cap** (config), **MIME allowlist**, and **magic-byte sniffing** so a disguised/renamed file with a spoofed Content-Type is rejected. PDFs are allowed only where the category permits (e.g. report attachments, not avatars). A **MalwareScanner** integration point runs before any S3 write (no-op default → bind ClamAV/Lambda/GuardDuty).

## Two Upload Paths
1. **Server-proxied multipart** (`POST /media/upload`) — validated + scanned in-band; best for typical photos.
2. **Direct-to-S3** (`POST /media/presign` → client PUTs → `POST /media/confirm`) — bytes bypass the API (scales for large files / high throughput). Confirm HEADs the object before creating the record. *Note:* in-band scanning isn't possible here — wire an S3 event-driven scan that deletes infected objects + records asynchronously.

## Media Categories → Ownership & Permissions
| Category | relatedEntityType | Upload roles | Attaches to |
|---|---|---|---|
| PROFILE_IMAGE | `user_avatar` | any authed | self (userId) |
| PEST_PHOTO | `booking_photo` | Customer | booking (must own) |
| BEFORE_PHOTO | `service_report_before` | Technician | booking (must be assigned) |
| AFTER_PHOTO | `service_report_after` | Technician | booking (assigned) |
| REPORT_ATTACHMENT | `service_report_attachment` | Technician | booking (assigned) |

**Download access (entity-aware):** uploader + media admins always; otherwise resolved by type — avatars (any authed), booking/report media (the booking's customer or assigned technician), chat attachments (conversation participants), invoice PDFs (the invoice's customer). Admins (Super/Ops/Support) may list/manage any record.

## S3 Storage & Security
- **Private bucket**, **server-side encryption** (AES256 or KMS), **no public ACLs**.
- Keys namespaced `relatedEntityType/YYYY/MM/ownerId/<uuid>` (tidy + lifecycle-friendly).
- **Signed URLs only:** short-lived presigned GET, or **CloudFront signed URLs** when configured (cached private delivery).
- Ownership + metadata (mime, size, uploader) tracked on `UploadedFile`.

## Media Cleanup Strategy
- **Delete = soft-delete** (`deletedAt`); a daily cron **purges the S3 object + row** after `retentionDays` (FK relations are `SetNull`, so report/chat references degrade gracefully).
- **Orphan sweep** (6-hourly): records never attached (`relatedEntityId` null) older than 24h are flagged for purge — catches abandoned direct-to-S3 confirms.

## Storage Cost Optimization
- **S3 Lifecycle rules** (set on the bucket): transition infrequently-accessed media to **S3 Standard-IA / Glacier** after N days; expire incomplete multipart uploads.
- The retention purge removes deleted objects so you don't pay to store tombstones.
- **CloudFront** cuts repeated S3 GET cost + egress and improves latency for images.
- Consider client-side image resizing or a thumbnail pipeline (Lambda@Edge / S3 trigger) to avoid serving full-res originals.

## CloudFront Recommendations
- Origin = the private S3 bucket via **Origin Access Control (OAC)**; block all public bucket access.
- Serve via **signed URLs/cookies** (key group + private key) — set `MEDIA_CLOUDFRONT_*` and the service signs automatically.
- Cache images aggressively; keep PDFs/invoices short-TTL or no-store if sensitive.

## Error Handling / Logging
- 400 — invalid type/size, magic-byte mismatch, malware hit, missing bookingId, object not found on confirm.
- 403 — role not allowed for category, not associated with the booking, download access denied.
- 404 — file not found / soft-deleted.
- `Logger` records uploads, rejections (infected), purges (ids only).

---

## Setup Instructions
1. `npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @aws-sdk/cloudfront-signer` (+ `@nestjs/platform-express` for multipart, already present).
2. Ensure `ScheduleModule.forRoot()` is registered (foundation) for the cleanup crons.
3. Register `MediaModule` in `app.module.ts`.
4. Add a `media` config namespace:
   ```ts
   media: {
     bucket: process.env.MEDIA_BUCKET,
     urlTtlSeconds: Number(process.env.MEDIA_URL_TTL ?? 300),
     maxBytes: Number(process.env.MEDIA_MAX_BYTES ?? 10485760),
     sse: process.env.MEDIA_SSE ?? 'AES256',
     retentionDays: Number(process.env.MEDIA_RETENTION_DAYS ?? 30),
     cloudfrontDomain: process.env.MEDIA_CLOUDFRONT_DOMAIN,
     cloudfrontKeyPairId: process.env.MEDIA_CLOUDFRONT_KEY_PAIR_ID,
     cloudfrontPrivateKey: process.env.MEDIA_CLOUDFRONT_PRIVATE_KEY,
   }
   // reuses aws.region
   ```
5. (Optional) bind a real scanner: `{ provide: MALWARE_SCANNER, useClass: ClamAvScanner }`.

## AWS Configuration
- **S3:** private bucket; Block Public Access ON; default encryption (SSE-S3 or SSE-KMS); lifecycle rules (IA/Glacier transition, abort incomplete multipart). CORS allowing PUT from the app origin for direct uploads.
- **IAM:** the app role needs `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:HeadObject` on the bucket ARN only.
- **CloudFront (recommended):** distribution with OAC to the bucket; a key group for signed URLs.

## Environment Variables
| Variable | Required | Notes |
|---|---|---|
| `AWS_REGION` | yes | shared |
| `MEDIA_BUCKET` | yes | private bucket |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | * | or IAM role (preferred) |
| `MEDIA_URL_TTL` | no | signed URL seconds (default 300) |
| `MEDIA_MAX_BYTES` | no | default 10 MB |
| `MEDIA_SSE` | no | `AES256` or `aws:kms` |
| `MEDIA_RETENTION_DAYS` | no | soft-delete purge window (default 30) |
| `MEDIA_CLOUDFRONT_DOMAIN` / `_KEY_PAIR_ID` / `_PRIVATE_KEY` | rec. | enables CloudFront signed URLs (`\n`-escaped key) |

## Testing Instructions
**Unit (mock Prisma/S3/scanner):**
- validateFile: size over cap → 400; mime not allowed → 400; magic-byte mismatch (declared png, jpeg bytes) → 400; pdf where not allowed → 400.
- upload: scanner reports infected → 400, no S3 write; PROFILE_IMAGE attaches to self; PEST_PHOTO by non-owner of booking → 403.
- assertCanAccess: avatar (any authed) ok; booking media for unrelated user → 403; invoice for non-owner → 403.
- presign/confirm: confirm with missing object → 400; oversize object → deleted + 400.
- purgeDeleted: only rows past retention; S3 delete called.

**Integration:** LocalStack/test bucket — upload, fetch signed URL, download, soft-delete, run purge → object gone.

---

## Example API Requests

**Customer uploads a pest photo (multipart)**
```
POST /api/v1/media/upload    (multipart: file=<jpg>)
Authorization: Bearer <customer token>
Body fields: category=PEST_PHOTO  relatedEntityId=<bookingId>
→ { "id":"<uuid>", "relatedEntityType":"booking_photo", "fileType":"IMAGE", ... }
```

**Technician after-photo via direct-to-S3**
```
POST /api/v1/media/presign
{ "category":"AFTER_PHOTO", "mimeType":"image/jpeg", "sizeBytes":824133, "relatedEntityId":"<bookingId>" }
→ { "uploadUrl":"https://s3...","storageKey":"service_report_after/2026/06/.../<uuid>" }

# client PUTs the bytes to uploadUrl, then:
POST /api/v1/media/confirm
{ "storageKey":"service_report_after/2026/06/.../<uuid>", "category":"AFTER_PHOTO", "relatedEntityId":"<bookingId>" }
```

**Get a secure download URL**
```
GET /api/v1/media/<fileId>/url
→ { "url":"https://<cloudfront-or-s3-signed>", "expiresInSeconds":300 }
```

**Profile image**
```
GET /api/v1/media/profile-image/<userId>
→ { "url":"https://...", "fileId":"<uuid>" }
```

---

**Stopping after the File Upload & Media module, per instruction.** No other modules generated. The remaining backend piece is **Service Reports** (incl. the append-only `ChemicalApplication` compliance table — still pending the jurisdiction-specific pesticide field set), plus optional **Reviews/ratings** and **Admin/Audit**.
