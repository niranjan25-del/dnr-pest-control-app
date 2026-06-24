// src/modules/service-reports/enums/index.ts
//
// Report status machine + item-label conventions + media owner types.
//
// NOTE (schema reconciliation): ReportStatus is {DRAFT, SUBMITTED, APPROVED, REJECTED}. The
// requirement's "In Progress" = DRAFT (still editable); "Archived" = soft-delete (deletedAt).
// Report content is stored in the flexible ServiceReportItem rows keyed by `label` (no dedicated
// columns for findings/services/photos/notes). Signature + generated PDF are MediaFiles
// (polymorphic ownerType), since ServiceReport has no signature/pdf columns.

import { ReportStatus } from "@prisma/client";

export const REPORT_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  DRAFT: [ReportStatus.SUBMITTED],
  SUBMITTED: [ReportStatus.APPROVED, ReportStatus.REJECTED],
  REJECTED: [ReportStatus.SUBMITTED], // technician edits then resubmits
  APPROVED: [], // terminal (archive via soft-delete)
};

export function isReportTransitionAllowed(
  from: ReportStatus,
  to: ReportStatus,
): boolean {
  return REPORT_TRANSITIONS[from]?.includes(to) ?? false;
}

export const EDITABLE_STATUSES: ReportStatus[] = [
  ReportStatus.DRAFT,
  ReportStatus.REJECTED,
];

// ServiceReportItem.label conventions — the report's structured content lives here.
export enum ReportItemLabel {
  FINDING = "finding", // initial findings / pest observations (value = text)
  SERVICE = "service", // service performed (value = text)
  CHEMICAL = "chemical", // chemicalName + quantity + value(area/notes)
  BEFORE_PHOTO = "before_photo", // mediaId
  AFTER_PHOTO = "after_photo", // mediaId
  SAFETY_NOTE = "safety_note", // value = text
  REGULATORY_NOTE = "regulatory_note",
}

// MediaFile.ownerType markers for report-owned media.
export const SIGNATURE_OWNER_TYPE = "report_signature";
export const REPORT_PDF_OWNER_TYPE = "service_report_pdf";

export const SIGNED_URL_TTL_SECONDS = 300;
