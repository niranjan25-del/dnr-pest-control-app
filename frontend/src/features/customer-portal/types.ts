export interface CustomerSelfProfile {
  id: string;
  user_id?: string;
  full_name?: string;
  email?: string;
  phone?: string | null;
  company_name?: string | null;
  customer_type?: 'RESIDENTIAL' | 'COMMERCIAL' | null;
  status?: string;
  address_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerAddress {
  id: string;
  label?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode?: string;
  postal_code?: string;
  country: string;
  isDefault?: boolean;
  is_default?: boolean;
  access_notes?: string | null;
  createdAt?: string;
}

export interface BookingStatusEntry {
  id: string;
  previous_status: string | null;
  new_status: string;
  note?: string | null;
  created_at: string;
}

export type BookingPriority = 'NORMAL' | 'HIGH';

export interface CustomerBooking {
  id: string;
  booking_number?: string;
  status: string;
  priority?: BookingPriority;
  service_name?: string | null;
  address_line?: string | null;
  scheduled_window_start?: string;
  scheduled_window_end?: string;
  price: string | number;
  currency: string;
  notes?: string | null;
  cancellation_reason?: string | null;
  cancellation_fee_applied?: boolean;
  needs_acceptance?: boolean;
  technician_name?: string | null;
  technician?: { id: string; full_name: string | null } | null;
  service?: { id: string; name: string } | null;
  package?: { id: string; name: string } | null;
  address?: {
    id: string; line1: string; line2?: string | null;
    city: string; state: string; postal_code?: string;
    country: string; access_notes?: string | null;
  } | null;
  status_history?: BookingStatusEntry[];
  has_review?: boolean;
  discount_amount?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CouponPreview {
  valid: boolean;
  code: string;
  discount_amount: number;
  final_amount: number;
  reason?: string;
}

export interface CustomerInvoice {
  id: string;
  invoice_number?: string;
  booking_id?: string | null;
  subtotal_amount?: string | number;
  tax_amount?: string | number;
  discount_amount?: string | number;
  total_amount: string | number;
  currency: string;
  status: string;
  due_date?: string | null;
  pdf_url?: string | null;
  created_at?: string;
}

export interface ServiceOption {
  id: string;
  name: string;
  description?: string | null;
  base_price?: number;
  basePrice?: number;
  currency?: string;
  duration_minutes?: number | null;
  estimatedDurationMin?: number | null;
  warranty_days?: number;
  warrantyDays?: number;
  is_active?: boolean;
  isActive?: boolean;
}

export interface PackageOption {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency?: string;
  is_active?: boolean;
  isActive?: boolean;
}

export type BookingStep = 'service' | 'address' | 'datetime' | 'confirm';

// ── Service Reports ────────────────────────────────────────────────────────────

export interface ServiceReportItem {
  id: string;
  label: string;
  value?: string | null;
  chemical_name?: string | null;
  quantity?: string | null;
}

export interface CustomerServiceReport {
  id: string;
  booking_id: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  summary?: string | null;
  recommendations?: string | null;
  submitted_at?: string | null;
  items?: ServiceReportItem[];
  service_name?: string | null;
  technician_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string | null;
  price: string | number;
  currency: string;
  billing_cycle: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  visits_per_cycle: number;
  is_active?: boolean;
}

export interface CustomerSubscription {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';
  start_date: string;
  next_billing_date?: string | null;
  next_service_date?: string | null;
  paused_at?: string | null;
  cancelled_at?: string | null;
  plan?: SubscriptionPlan | null;
  created_at?: string;
  updated_at?: string;
}

// ── Warranties ────────────────────────────────────────────────────────────────

export interface CustomerWarranty {
  id: string;
  booking_id: string;
  service_name: string;
  warranty_days: number;
  expires_at: string;
  is_active: boolean;
  claimed_at?: string | null;
  days_remaining: number;
  created_at?: string;
}

// ── Cashfree ──────────────────────────────────────────────────────────────────

export interface CashfreeOrderResult {
  payment_id: string;           // our internal Payment record id
  order_id: string;             // Cashfree order_id (used for confirm call)
  payment_session_id: string;   // Cashfree JS SDK uses this to launch checkout
  amount: number;
  currency: string;
  status: string;
}

export interface CustomerReview {
  id: string;
  booking_id: string;
  rating: number;
  comment?: string | null;
  status: string;
  created_at?: string;
}
