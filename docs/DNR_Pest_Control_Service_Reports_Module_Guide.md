## DNR Pest Control — Service Reports & Customer Signatures Module (Step 33)

**Module:** `service-reports` (NestJS) — production-ready
**Builds on:** Prisma schema (17) · Auth (18) · Users & Profiles (19) · Bookings (21) · Dispatch (22) · Media (30) · GPS (32)
**Tech:** NestJS · Prisma · PostgreSQL · **AWS S3** · **PDFKit**
**Scope:** Service Reports ONLY. No other modules generated.

> ⚠️ **COMPLIANCE — the long-flagged input. Please read.** The `ChemicalApplication` table is a **common-denominator placeholder** (the schema itself says so): productName, EPA reg #, target pest, quantity+unit, concentration, method, area, appliedAt. This module is built against it and is fully functional, **but before production you must confirm your jurisdiction's pesticide-application reporting fields.** Commonly required additions by US states/agencies:
> - **Applicator license/certification number** (per application or per technician)
> - **Restricted-Use Pesticide (RUP) flag** + permit number
> - **Re-entry interval (REI)** and **pre-harvest interval** where relevant
> - **Dilution rate / mix ratio** and **total area treated** (sq ft / linear ft)
> - **Ambient conditions at application** (temperature, wind speed/direction) for drift rules
> - **Site/EPA establishment number**, **lot/batch number** of the product
>
> `ChemicalApplication` is **append-only** (corrections = new rows), which is correct for compliance but means **adding columns later is a careful migration on a regulated, immutable table**. That's exactly why I recommended confirming the field set first. Add the confirmed fields to the model now if known.

> ⚠️ **REQUIRED SCHEMA ADDITION (status lifecycle) — please approve.** `ServiceReport` has no status column:
> ```prisma
> enum ReportStatus { DRAFT SUBMITTED APPROVED ARCHIVED }
>
> // add to model ServiceReport:
>   status        ReportStatus @default(DRAFT)
>   submittedAt   DateTime?    @map("submitted_at")
>   approvedAt    DateTime?    @map("approved_at")
>   approvedById  String?      @db.Uuid @map("approved_by_id")
>   @@index([status])
> ```
> `prisma migrate dev --name service_report_status`.

> **Already in schema (no migration):** signature link (`signatureFileId`/`signerName`/`signedAt`), the `ChemicalApplication` relation, one report per booking (`bookingId @unique`), and the **`AuditLog`** table used here for the compliance audit trail.

---

## Module Structure
```
src/modules/service-reports/
├── service-reports.module.ts
├── service-reports.controller.ts   # author · view · download · admin approve/archive/export
├── service-reports.service.ts      # lifecycle, chemicals (append-only), photos, PDF, search, CSV, audit
├── pdf-report.service.ts           # PDFKit report (chemicals + photos + signature)
├── signature.service.ts            # base64 PNG → private S3 + UploadedFile + link
├── enums/ report-status.ts         # ReportStatus, roles, audit actions
└── dto/ create-report · update-report · add-chemical · capture-signature · query-reports
```

## Report Lifecycle (statuses)
**DRAFT** (technician authoring) → **SUBMITTED** (locked; signature required) → **APPROVED** (admin) → **ARCHIVED** (admin). Reports are **immutable once submitted** — chemical corrections are new entries, never edits (audit integrity).

## Features → Endpoints
| Feature | Method/Path | Roles |
|---|---|---|
| Create report (draft) | `POST /api/v1/service-reports` | Technician (assigned) |
| Edit draft | `PATCH /api/v1/service-reports/:id` | Technician (own draft) |
| Add chemical/product | `POST /api/v1/service-reports/:id/chemicals` | Technician (own draft) |
| Capture signature | `POST /api/v1/service-reports/:id/signature` | Technician (own draft) |
| Submit | `POST /api/v1/service-reports/:id/submit` | Technician (own draft) |
| My reports | `GET /api/v1/service-reports/me` | Technician |
| Report for a booking | `GET /api/v1/service-reports/booking/:bookingId` | Customer (own) / tech / admin |
| Detail | `GET /api/v1/service-reports/:id` | role-scoped |
| Download PDF | `GET /api/v1/service-reports/:id/download` | Customer (own, completed) / tech / admin |
| List / search / filter | `GET /api/v1/service-reports?status=&technicianId=&productName=` | Super/Ops |
| Export CSV (compliance) | `GET /api/v1/service-reports/export` | Super/Ops |
| Approve / Archive | `POST /api/v1/service-reports/:id/approve` · `/archive` | Super/Ops |

**Before/after photos** are uploaded through the **Media module** (categories BEFORE_PHOTO/AFTER_PHOTO with the bookingId); this module aggregates them into the report detail + PDF by `relatedEntityId = bookingId`.

## Signature Storage Strategy
Captured as a base64 PNG from a signature pad → validated (PNG magic bytes + size) → stored as a **private, encrypted** S3 object recorded as an `UploadedFile` (`fileType=SIGNATURE`, `relatedEntityType=service_report_signature`) → linked via `signatureFileId` + `signerName` + `signedAt`. Never a public URL; surfaced via short-lived presigned URLs. Reuses the Media `S3Service` (one storage layer).

## PDF Generation Strategy
**PDFKit** (same as Invoices — no headless browser): renders parties, findings, summary/recommendations, the **chemical-application table** (product, EPA #, target, qty+unit, concentration, method, area, applied-at), **before/after photos**, and the **signature** + signer + timestamp. Image bytes are pulled via short-lived presigned URLs (no widening of `S3Service`). The PDF is stored as an `UploadedFile` (`service_report_pdf`) and returned as a presigned download.

## Compliance Requirements
- `ChemicalApplication` is **append-only** (no update/delete endpoints) — the regulator-facing record of what was applied, when, where, how much.
- CSV export is **one row per application** (the reporting grain), filterable by date/technician/status, with a product-name search for "where was product X used?" lookups.
- The PDF is a self-contained, signed compliance artifact per service.
- **Confirm jurisdiction fields before launch** (above).

## Security Requirements
- **Authoring** restricted to the **assigned** technician; **immutable** after submit.
- **Customer access** limited to **their own** booking's report and only when **completed** (SUBMITTED/APPROVED/ARCHIVED) — never drafts.
- Signatures/photos/PDFs are private S3 objects via presigned URLs; admin downloads/exports are audit-logged.

## Audit Trail
Every meaningful action writes an `AuditLog` row (`entityType='service_report'`, actor, action, entityId, JSON detail): created, updated, chemical_added, signature_captured, submitted, approved, archived, exported. Append-only, queryable for technician-activity audits.

## Error Handling / Logging
- 400 — edit after submit; submit without a signature; approve a non-submitted report.
- 403 — not the assigned technician / not your booking / non-admin admin-action.
- 404 — booking/report not found.
- 409 — a report already exists for the booking (unique).
- `Logger` records lifecycle transitions; `AuditLog` is the durable trail.

---

## Setup Instructions
1. `npm i pdfkit @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` (+ `-D @types/pdfkit`) — most present from Invoices/Media.
2. Apply the `ReportStatus` migration; add confirmed `ChemicalApplication` jurisdiction fields if known.
3. Register `ServiceReportsModule` in `app.module.ts` (it imports `MediaModule` for `S3Service`).
4. Node 18+ (uses global `fetch` to pull image bytes for the PDF).
5. Config reused: `company.name`/`company.address` (PDF header), `media.*` (bucket/SSE/TTL), `aws.region`.

## Environment Variables
| Variable | Required | Notes |
|---|---|---|
| `AWS_REGION` / `MEDIA_BUCKET` | yes | via Media S3Service |
| `MEDIA_SSE` | no | `AES256` / `aws:kms` |
| `MEDIA_URL_TTL` | no | presigned TTL (default 300) |
| `COMPANY_NAME` / `COMPANY_ADDRESS` | rec. | PDF header (`|`-separated lines) |

## Testing Instructions
**Unit (mock Prisma/S3/PDF):**
- create: not assigned → 403; duplicate booking → 409.
- getOwnedDraft: edit/chemical/signature after submit → 400.
- submit: without signature → 400; with → SUBMITTED + audit row.
- approve: non-submitted → 400; archive: draft → 400.
- assertCanView: customer sees own SUBMITTED+; draft hidden; other customer → 403.
- signature.capture: non-PNG → 400; links file + signerName/signedAt.
- exportCsv: one row per chemical; escaping; product filter.

**Integration:** author a draft → add 2 chemicals → capture signature → submit → admin approve → download PDF (asserts chemicals + signature embedded) → CSV export contains the applications → AuditLog has the full trail.

---

## Example API Requests

**Create a draft (technician)**
```
POST /api/v1/service-reports
Authorization: Bearer <technician token>

{ "bookingId":"<uuid>", "pestsFound":["German cockroach"], "areasTreated":["Kitchen","Pantry"],
  "summary":"Crack-and-crevice treatment.", "recommendations":"Reduce moisture under sink.",
  "weatherConditions":"Indoor, 24°C", "followUpRequired": true }
```

**Record a chemical (append-only)**
```
POST /api/v1/service-reports/<id>/chemicals
{ "productName":"Advion Cockroach Gel", "epaRegistrationNumber":"100-1484",
  "targetPest":"Cockroach", "quantityUsed":4.5, "unit":"g",
  "applicationMethod":"Crack & crevice", "applicationArea":"Kitchen" }
```

**Capture signature + submit**
```
POST /api/v1/service-reports/<id>/signature
{ "signatureBase64":"data:image/png;base64,iVBORw0KGgo...", "signerName":"Jane Doe" }

POST /api/v1/service-reports/<id>/submit
```

**Customer downloads the report**
```
GET /api/v1/service-reports/<id>/download
Authorization: Bearer <customer token>
→ { "url":"https://<signed>", "expiresInSeconds":300 }
```

**Admin compliance export**
```
GET /api/v1/service-reports/export?from=2026-01-01&to=2026-03-31&productName=Advion
Authorization: Bearer <ops token>
→ text/csv (one row per chemical application)
```

---

**Stopping after the Service Reports module, per instruction.** This completes the field-service record. The remaining optional piece is an **Admin/Audit** module (dashboards over the existing AuditLog), which needs no blocking inputs.
