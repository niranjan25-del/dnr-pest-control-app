## DNR Pest Control — Invoices & Billing Module (Step 25)

**Module:** `invoices` (NestJS) — production-ready
**Builds on:** Prisma schema (17) · Auth (18) · Users & Profiles (19) · Services (20) · Bookings (21) · Dispatch (22) · Addresses (23) · Payments (24) · API Spec (4)
**Tech:** NestJS · Prisma · PostgreSQL · **PDFKit** (PDF) · **AWS S3** (storage)
**Scope:** Invoices & Billing ONLY. No other modules generated.

> **Relationship to Payments (important).** The Payments module (Step 24) **creates the `Invoice` row at payment-intent time** (so Stripe has an amount) and the webhook flips it to `PAID`. This module therefore **does NOT create duplicate invoices**. It owns: canonical **numbering**, **PDF generation**, **S3 storage + secure downloads**, **lifecycle (void)**, **history/search/filter**, and **CSV export**. The "auto-create after successful payment" requirement is fulfilled as **auto-generate + store the PDF when the invoice is paid**, via an `invoice.paid` event.
>
> **One-line wiring to add in Payments** (`onPaymentSucceeded`, after marking PAID):
> ```ts
> this.eventEmitter.emit('invoice.paid', { invoiceId: payment.invoiceId });
> ```
> Until that line is added, PDFs are still generated on first download and via the admin **regenerate** endpoint, so nothing breaks.

> **Status reconciliation:** requested "Cancelled" is not an `InvoiceStatus` value → mapped to **VOID**. Per accounting best practice, **only unpaid invoices are voidable**; a PAID invoice is corrected by a **refund/credit note** (Payments), never by deleting or voiding.

---

## Module Structure
```
src/modules/invoices/
├── invoices.module.ts
├── invoices.controller.ts          # /invoices (+ /me, /export, /:id, /:id/download, /:id/regenerate, /:id/void)
├── invoices.service.ts             # lifecycle, scoping, PDF orchestration, export, event listener
├── pdf.service.ts                  # PDFKit → Buffer (pure)
├── storage.service.ts              # S3 upload + presigned download URLs
├── invoice-number.service.ts       # canonical sequential numbering (Postgres sequence)
├── enums/ invoice-status.ts        # voidable set, role buckets, mappings
├── interfaces/ invoice.interfaces.ts
├── dto/ query-invoices · void-invoice · export-invoices
└── templates/ invoice-template.ts  # PDFKit layout (company/customer/items/tax/total)
```

## Features → Endpoints
| Feature | Method/Path | Roles |
|---|---|---|
| Billing history (own) | `GET /api/v1/invoices/me` | Customer |
| View all invoices (search/filter/paginate) | `GET /api/v1/invoices` | Billing view |
| Export billing report (CSV) | `GET /api/v1/invoices/export` | Billing manage |
| Invoice detail | `GET /api/v1/invoices/:id` | Customer (own) / Billing view |
| Download (presigned URL) | `GET /api/v1/invoices/:id/download` | Customer (own) / Billing view |
| Regenerate PDF | `POST /api/v1/invoices/:id/regenerate` | Billing manage |
| Void invoice | `POST /api/v1/invoices/:id/void` | Billing manage |

Billing view = Super/Ops/Support · Billing manage = Super/Ops. Routes are role-scoped in the service (customers only ever see their own).

## Invoice PDF Generation
PDFKit (no headless browser, built-in fonts) renders: company details, bill-to (customer + service address), line items, **tax breakdown** (`taxLines[]`), discount, and total. Money is formatted via `Intl.NumberFormat` using the invoice `currency`.

## Invoice Storage (S3)
- Private bucket, **server-side encryption** (AES256), **versioned keys** (`invoices/<id>/<number>-<ts>.pdf`) so regeneration never overwrites prior copies (audit-friendly).
- Each PDF is recorded as an `UploadedFile` (`relatedEntityType='invoice'`, `fileType=PDF`, `storageKey`).
- **Secure access:** downloads are **short-lived presigned URLs** (default 300s) — objects are never public.

## Tax Calculation Framework (multi-region ready)
- Tax is computed upstream by the Payments `TaxService` and stored on `Invoice.taxAmount` (single source of truth — not recomputed here).
- The PDF uses a **`taxLines[]` array**, not a single field, so multiple jurisdictions/rates can be itemized later without changing the template contract.
- `Invoice.currency` drives formatting; the design supports per-region currencies. When you adopt Stripe Tax (recommended), populate `taxLines` from the tax breakdown.

## Invoice Numbering Strategy
- **Canonical, sequential, gapless** via a Postgres **sequence**: `INV-<YEAR>-<6-digit seq>` (`InvoiceNumberService.next()`).
- Numbers are **immutable** once assigned; regeneration of the PDF never changes the number.
- **Required migration** (raw SQL — Prisma can't model a sequence directly):
  ```sql
  CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1000;
  ```
- Payments currently uses a random fallback at creation; switch it to `InvoiceNumberService.next()` for fully sequential numbers (exported for that purpose).

## Error Handling
- 400 — voiding a non-voidable (paid) invoice; missing uploader config.
- 403 — wrong role / not owner.
- 404 — invoice not found (or out of scope).

## Logging / Transaction Handling
- `Logger` records PDF storage, regenerate, void (ids only).
- PDF record swap on regenerate (soft-delete old `UploadedFile` + insert new) runs in a `$transaction`. The `invoice.paid` listener never throws (logs failures for retry/alerting).

---

## Setup Instructions
1. Install deps: `npm i pdfkit @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` and (if not already) `npm i @nestjs/event-emitter`; `npm i -D @types/pdfkit`.
2. Ensure `EventEmitterModule.forRoot()` is registered (foundation `app.module.ts`) for the `invoice.paid` listener.
3. Run the numbering sequence migration (above).
4. Place files under `src/modules/invoices/`; register `InvoicesModule` in `app.module.ts`.
5. Add config namespaces:
   ```ts
   aws: { region: process.env.AWS_REGION, invoiceBucket: process.env.AWS_INVOICE_BUCKET },
   billing: {
     downloadUrlTtlSeconds: Number(process.env.INVOICE_DOWNLOAD_TTL ?? 300),
     systemUserId: process.env.BILLING_SYSTEM_USER_ID, // uploader for system-generated PDFs
   },
   company: {
     name: process.env.COMPANY_NAME ?? 'DNR Pest Control',
     email: process.env.COMPANY_BILLING_EMAIL,
     phone: process.env.COMPANY_PHONE,
     taxId: process.env.COMPANY_TAX_ID,
     addressLines: (process.env.COMPANY_ADDRESS ?? '').split('|').filter(Boolean),
   },
   ```
6. (Recommended) wire the `invoice.paid` emit in Payments' `onPaymentSucceeded` (one line, above).
7. AWS credentials via the default provider chain (env vars or IAM role) — never hardcoded.

## Environment Variables
| Variable | Required | Notes |
|---|---|---|
| `AWS_REGION` | yes | e.g. `us-east-1` |
| `AWS_INVOICE_BUCKET` | yes | private bucket for invoice PDFs |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | * | or use an IAM role (preferred) |
| `INVOICE_DOWNLOAD_TTL` | no | presigned URL TTL seconds (default 300) |
| `BILLING_SYSTEM_USER_ID` | rec. | uploader id for system-generated PDFs (event path) |
| `COMPANY_NAME` / `COMPANY_BILLING_EMAIL` / `COMPANY_PHONE` / `COMPANY_TAX_ID` / `COMPANY_ADDRESS` | rec. | shown on the PDF (`COMPANY_ADDRESS` is `|`-separated lines) |

## Testing Instructions
**Unit (mock Prisma/PDF/Storage):**
- list/findById: customer scoped to own; admin sees all; search/status/date filters; meta math.
- getDownloadUrl: existing PDF → reuse key; none → generate then presign.
- regenerate: soft-deletes old UploadedFile + inserts new (transaction).
- voidInvoice: PAID/REFUNDED → 400; ISSUED → VOID.
- onInvoicePaid: generates PDF; swallows + logs errors (never throws).
- PdfService.renderInvoicePdf: returns a non-empty Buffer for sample data.
- exportCsv: proper escaping of commas/quotes/newlines.

**Integration:**
- S3 against LocalStack or a test bucket; assert object exists + presigned URL downloads.
- Emit `invoice.paid` → assert an `UploadedFile` PDF row is created.

---

## Example API Requests

**Customer billing history**
```
GET /api/v1/invoices/me?page=1&limit=20&status=PAID
Authorization: Bearer <customer token>
```

**Download an invoice (presigned URL)**
```
GET /api/v1/invoices/<uuid>/download
Authorization: Bearer <customer token>
```
```json
{ "url": "https://s3.amazonaws.com/...&X-Amz-Signature=...", "expiresInSeconds": 300 }
```

**Void an invoice (billing admin)**
```
POST /api/v1/invoices/<uuid>/void
Authorization: Bearer <ops token>

{ "reason": "Duplicate booking — billed in error" }
```

**Export billing report (CSV)**
```
GET /api/v1/invoices/export?from=2026-01-01&to=2026-03-31&status=PAID
Authorization: Bearer <ops token>
```
Returns `text/csv` (attachment): `invoice_number,status,currency,subtotal,discount,tax,total,customer_name,customer_email,issued_at,created_at`.

---

**Stopping after the Invoices module, per instruction.** No other modules generated. Remaining: **Reports** (service reports + the pesticide/compliance field set — the last long-open input), plus **Notifications**/**Subscriptions**/**Admin**.
