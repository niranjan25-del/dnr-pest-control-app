// src/features/dispatch/api.ts
// Dispatch board API: unassigned bookings + technician workloads.
// Assign/reassign/candidates are on bookingsApi (booking-centric dispatch routes).

import { apiClient } from '@/services/apiClient';
import type { Paginated } from '@/types';
import type { QueryParams } from '@/services/createResourceService';

export interface UnassignedBooking {
  id: string;
  status: string;
  scheduledWindowStart: string | null;
  scheduledWindowEnd: string | null;
  service: { name: string } | null;
  address: { city: string | null; postalCode: string | null } | null;
  customer: { user: { fullName: string | null } } | null;
}

export interface TechnicianWorkload {
  technicianId: string;
  name: string | null;
  isAvailable: boolean;
  dailyActive: number;
  weeklyActive: number;
  dailyCapacityRemaining: number;
}

export const dispatchApi = {
  async unassigned(params?: QueryParams): Promise<Paginated<UnassignedBooking>> {
    const { data } = await apiClient.get<Paginated<UnassignedBooking>>('/dispatch/unassigned', { params });
    return data;
  },
  async workloads(): Promise<TechnicianWorkload[]> {
    const { data } = await apiClient.get<TechnicianWorkload[] | { data: TechnicianWorkload[] }>('/dispatch/workloads');
    return Array.isArray(data) ? data : data.data ?? [];
  },
};
