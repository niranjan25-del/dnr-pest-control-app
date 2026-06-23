export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type CustomerType = 'RESIDENTIAL' | 'COMMERCIAL';

export interface UserRow {
  id: string;
  customer_profile_id?: string | null;
  full_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  status: UserStatus;
  customer_type?: CustomerType | null;
  created_at?: string;
}

export interface CustomerProfile {
  id: string;
  user_id?: string;
  customer_profile_id?: string | null;
  full_name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  customer_type?: CustomerType | null;
  status?: UserStatus;
  address_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AddressRow {
  id: string;
  label?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt?: string;
}

export interface InvoiceRow {
  id: string;
  invoice_number?: string;
  total_amount: string | number;
  currency: string;
  status: string;
  created_at?: string;
}

export interface CustomerStats {
  total_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  active_bookings: number;
  total_spend: number;
  avg_rating: string | null;
  reviews_count: number;
}

export interface CustomerReviewRow {
  id: string;
  booking_id: string | null;
  rating: number;
  comment: string | null;
  status: string;
  customer_name: string | null;
  technician_name: string | null;
  created_at: string;
}
