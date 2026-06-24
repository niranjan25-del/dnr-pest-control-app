// src/modules/service-reports/interfaces/index.ts

import { ReportStatus } from "@prisma/client";

export interface ChemicalEntry {
  chemicalName: string;
  quantity: string | null;
  area_notes: string | null;
}

export interface ServiceReportView {
  id: string;
  booking_id: string;
  technician_id: string;
  status: ReportStatus;
  summary: string | null;
  recommendations: string | null;
  findings: string[];
  services: string[];
  chemicals: ChemicalEntry[];
  before_photo_media_ids: string[];
  after_photo_media_ids: string[];
  safety_notes: string[];
  regulatory_notes: string[];
  has_signature: boolean;
  submitted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// Assembled data passed to the PDF template (image buffers fetched best-effort).
export interface ReportPdfData {
  reportNumber: string;
  status: string;
  createdAt: Date;
  submittedAt: Date | null;
  customer: {
    name: string;
    email: string;
    phone: string | null;
    address?: string;
  };
  technician: { name: string; license?: string | null };
  summary: string | null;
  recommendations: string | null;
  findings: string[];
  services: string[];
  chemicals: ChemicalEntry[];
  beforePhotos: Buffer[];
  afterPhotos: Buffer[];
  safetyNotes: string[];
  regulatoryNotes: string[];
  signature: Buffer | null;
}
