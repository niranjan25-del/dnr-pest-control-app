// src/features/technicians/types.ts
import type { UserStatus } from '@/features/customers/types';

export interface TechnicianRow {
  id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  status: UserStatus;
  is_available?: boolean;
  on_duty?: boolean;
  rating?: number;
  completed_jobs?: number;
  active_jobs?: number;
}

export interface ServiceArea {
  id: string;
  name: string;
}

export interface TechnicianProfile {
  id: string;
  user_id?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  status?: UserStatus;
  is_available?: boolean;
  on_duty?: boolean;
  license_number?: string;
  license_expiry?: string;
  skills?: string[];
  certifications?: { name: string; number?: string; expiry?: string }[];
  service_areas?: ServiceArea[];
  rating?: number;
  completed_jobs?: number;
  on_time_rate?: number;
  active_jobs?: number;
  total_earnings?: number;
  joined_at?: string;
}

export interface TechnicianJobRow {
  id: string;
  status: string;
  service_name?: string;
  customer_name?: string;
  address_line?: string;
  scheduled_window_start?: string;
  scheduled_window_end?: string;
  total_amount?: number;
}

export interface TechnicianStats {
  completed_this_month: number;
  completed_total: number;
  on_time_rate: number;
  avg_rating: number;
  total_earnings: number;
  active_now: number;
}