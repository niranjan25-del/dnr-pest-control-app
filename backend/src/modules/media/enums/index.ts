// src/modules/media/enums/index.ts
//
// File categories + per-category policy (owner type, allowed roles, allowed MIME types, size
// caps).
//
// NOTE (schema reconciliation): MediaFile has no `category` column — a category maps to the
// polymorphic `ownerType` string (+ optional ownerId for the linked entity). It also has no
// original-filename column; the name is preserved inside the storage key. MediaType
// (IMAGE/DOCUMENT/VIDEO) is derived from the content type.

import { MediaType, UserRole } from "@prisma/client";

export enum MediaCategory {
  PROFILE_IMAGE = "PROFILE_IMAGE",
  BOOKING_IMAGE = "BOOKING_IMAGE",
  BEFORE_SERVICE_IMAGE = "BEFORE_SERVICE_IMAGE",
  AFTER_SERVICE_IMAGE = "AFTER_SERVICE_IMAGE",
  SERVICE_REPORT_ATTACHMENT = "SERVICE_REPORT_ATTACHMENT",
  CHAT_ATTACHMENT = "CHAT_ATTACHMENT",
  INVOICE_PDF = "INVOICE_PDF",
}

export const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const PDF_MIME = "application/pdf";
const IMAGES_AND_PDF = new Set([...IMAGE_MIMES, PDF_MIME]);

const MB = 1024 * 1024;

export interface CategoryPolicy {
  ownerType: string;
  roles: UserRole[];
  mimes: Set<string>;
  maxBytes: number;
  bookingLinked: boolean; // ownerId references a Booking → verify access
}

export const CATEGORY_CONFIG: Record<MediaCategory, CategoryPolicy> = {
  PROFILE_IMAGE: {
    ownerType: "profile",
    roles: [UserRole.CUSTOMER, UserRole.TECHNICIAN, UserRole.ADMIN],
    mimes: IMAGE_MIMES,
    maxBytes: 10 * MB,
    bookingLinked: false,
  },
  BOOKING_IMAGE: {
    ownerType: "booking",
    roles: [UserRole.CUSTOMER, UserRole.ADMIN],
    mimes: IMAGE_MIMES,
    maxBytes: 10 * MB,
    bookingLinked: true,
  },
  BEFORE_SERVICE_IMAGE: {
    ownerType: "before_service",
    roles: [UserRole.TECHNICIAN, UserRole.ADMIN],
    mimes: IMAGE_MIMES,
    maxBytes: 10 * MB,
    bookingLinked: true,
  },
  AFTER_SERVICE_IMAGE: {
    ownerType: "after_service",
    roles: [UserRole.TECHNICIAN, UserRole.ADMIN],
    mimes: IMAGE_MIMES,
    maxBytes: 10 * MB,
    bookingLinked: true,
  },
  SERVICE_REPORT_ATTACHMENT: {
    ownerType: "service_report",
    roles: [UserRole.TECHNICIAN, UserRole.ADMIN],
    mimes: IMAGES_AND_PDF,
    maxBytes: 20 * MB,
    bookingLinked: false,
  },
  CHAT_ATTACHMENT: {
    ownerType: "chat",
    roles: [UserRole.CUSTOMER, UserRole.TECHNICIAN, UserRole.ADMIN],
    mimes: IMAGES_AND_PDF,
    maxBytes: 10 * MB,
    bookingLinked: false,
  },
  INVOICE_PDF: {
    ownerType: "invoice",
    roles: [UserRole.ADMIN],
    mimes: new Set([PDF_MIME]),
    maxBytes: 20 * MB,
    bookingLinked: false,
  },
};

export const BOOKING_LINKED_OWNER_TYPES = Object.values(CATEGORY_CONFIG)
  .filter((c) => c.bookingLinked)
  .map((c) => c.ownerType);

export function mediaTypeFor(contentType: string): MediaType {
  if (contentType.startsWith("image/")) return MediaType.IMAGE;
  if (contentType.startsWith("video/")) return MediaType.VIDEO;
  return MediaType.DOCUMENT;
}

export const SIGNED_URL_TTL_SECONDS = 300;
