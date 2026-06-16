// src/features/bookings/types.ts
// Booking DTOs for the admin views. Snake_case mirrors the backend. Status reflects the
// approved enum (assignment is a relation, not a status; "rescheduled" is a history note).

export type BookingStatus =
  | 'PENDING' | 'CONFIRMED' | 'EN_ROUTE' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface BookingListItem {
  id: string;
  status: BookingStatus;
  service_name?: string;
  customer_name?: string;
  technician_name?: string | null;
  scheduled_window_start?: string;
  scheduled_window_end?: string;
  price: string;
  currency: string;
  address_line?: string;
}

export interface BookingDetail extends BookingListItem {
  service?: { id: string; name: string };
  customer?: { id: string; full_name?: string; phone?: string; email?: string };
  technician?: { id: string; full_name?: string } | null;
  address?: { line1?: string; city?: string; state?: string; postal_code?: string; gate_code?: string; access_notes?: string };
  notes?: string;
  discount_amount?: string;
  invoice_id?: string;
  created_at?: string;
}

export interface StatusHistoryEntry {
  id: string;
  previous_status?: string;
  new_status: string;
  note?: string;
  changed_by_name?: string;
  created_at: string;
}

export interface Candidate {
  technician_id: string;
  full_name: string;
  score?: number;
  hard_eligible?: boolean;
  active_jobs?: number;
  distance_km?: number;
  reason?: string;
}
