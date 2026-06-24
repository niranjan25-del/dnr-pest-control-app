export type BookingStatus =
  | 'PENDING' | 'CONFIRMED' | 'EN_ROUTE' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface BookingListItem {
  id: string;
  status: BookingStatus;
  booking_number?: string;
  // Flat fields for list display
  service_name?: string | null;
  customer_name?: string | null;
  technician_name?: string | null;
  scheduled_window_start?: string;
  scheduled_window_end?: string;
  price: string | number;
  currency: string;
  created_at?: string;
}

export interface BookingDetail extends BookingListItem {
  notes?: string | null;
  cancellation_reason?: string | null;
  cancellation_fee_applied?: boolean;
  discount_amount?: string | number;
  service?: { id: string; name: string } | null;
  package?: { id: string; name: string } | null;
  customer?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  technician?: {
    id: string;
    full_name?: string | null;
  } | null;
  address?: {
    id?: string;
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
    access_notes?: string | null;
  } | null;
  assignments?: { id: string; technicianId: string; status: string }[];
  updated_at?: string;
}

export interface StatusHistoryEntry {
  id: string;
  previous_status?: string | null;
  new_status: string;
  note?: string | null;
  changed_by_name?: string | null;
  created_at: string;
}

export interface Candidate {
  technicianId: string;
  technician_id: string;
  name: string;
  full_name: string;
  score?: number;
  is_available?: boolean;
  serves_area?: boolean;
  has_skill?: boolean;
  active_jobs?: number;
  distance_km?: number | null;
}
