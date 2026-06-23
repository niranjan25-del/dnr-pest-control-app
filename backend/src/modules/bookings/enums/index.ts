// src/modules/bookings/enums/index.ts
//
// Booking state machine + scheduling rules + the human-readable booking-number helper.
//
// NOTE (schema reconciliation): the approved BookingStatus enum has no ASSIGNED or
// RESCHEDULED value.
//   • "Assigned" is represented by a TechnicianAssignment row (Step 7); the booking itself
//     stays CONFIRMED. We do not add an ASSIGNED booking status.
//   • "Rescheduled" is an ACTION (it moves the time window) recorded in BookingStatusHistory
//     with a note — not a distinct status.

import { BookingStatus } from '@prisma/client';

// Allowed status transitions (state machine).
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  CONFIRMED: [BookingStatus.EN_ROUTE, BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
  EN_ROUTE: [BookingStatus.ARRIVED, BookingStatus.CANCELLED],
  ARRIVED: [BookingStatus.IN_PROGRESS, BookingStatus.NO_SHOW, BookingStatus.CANCELLED],
  IN_PROGRESS: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

// Statuses a technician may set on an assigned booking (progressing the job).
// CONFIRMED is included so technicians can accept (confirm) a pending assignment.
export const TECHNICIAN_SETTABLE: BookingStatus[] = [
  BookingStatus.CONFIRMED, BookingStatus.EN_ROUTE, BookingStatus.ARRIVED,
  BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED, BookingStatus.NO_SHOW,
];

// "Live" statuses that occupy a slot (used for conflict detection + cancel eligibility).
export const ACTIVE_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.EN_ROUTE,
  BookingStatus.ARRIVED, BookingStatus.IN_PROGRESS,
];

// Statuses from which a customer/admin may cancel or reschedule.
export const CANCELLABLE_BY_CUSTOMER: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

export function isTransitionAllowed(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

// --- Scheduling rules (defaults; promote to ConfigService/DB if they must be tunable live) ---
export const SCHEDULING = {
  WORKING_HOUR_START: 9,   // 09:00 local
  WORKING_HOUR_END: 18,    // 18:00 local — window must END by this hour
  SLOT_BUFFER_MIN: 30,     // buffer added after the service duration
  MIN_LEAD_TIME_MIN: 120,  // earliest a booking may be scheduled from "now"
  MAX_CONCURRENT_PER_SLOT: 5, // capacity model pre-assignment (overlapping live bookings)
} as const;

// Human-readable, display-only reference derived from the UUID + creation date.
// DERIVED (not stored): the schema has no bookingNumber column. If a persisted, sequential
// number is required, add `bookingNumber String @unique` to Booking and generate on create.
export function formatBookingNumber(id: string, createdAt: Date): string {
  const d = createdAt;
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `DNR-${ymd}-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}
