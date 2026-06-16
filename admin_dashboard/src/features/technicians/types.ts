// src/features/technicians/types.ts
// Technician DTOs. List via /users?role=TECHNICIAN; detail via /technicians/:id (certs,
// service areas, skills, availability). Performance fields are surfaced if the profile
// carries them; richer metrics belong to the Analytics module (out of scope here).

import type { UserStatus } from '@/features/customers/types';

export interface TechnicianRow {
  id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  status: UserStatus;
  is_available?: boolean;
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
  license_number?: string;
  license_expiry?: string;
  skills?: string[];
  certifications?: { name: string; number?: string; expiry?: string }[];
  service_areas?: ServiceArea[];
  // Optional performance summary (if provided by the API; else hidden).
  rating?: number;
  completed_jobs?: number;
  on_time_rate?: number;
}
