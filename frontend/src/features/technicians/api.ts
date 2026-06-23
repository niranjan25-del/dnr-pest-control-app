// src/features/technicians/api.ts
import { apiClient } from '@/services/apiClient';
import type { QueryParams } from '@/services/createResourceService';
import type { Paginated } from '@/types';
import type { ServiceArea, TechnicianJobRow, TechnicianProfile, TechnicianRow } from './types';
import type { UserStatus } from '@/features/customers/types';

export const techniciansApi = {
  async list(params: QueryParams): Promise<Paginated<TechnicianRow>> {
    const { data } = await apiClient.get<Paginated<TechnicianRow>>('/admin/technicians', { params });
    return data;
  },

  async profile(id: string): Promise<TechnicianProfile> {
    const { data } = await apiClient.get<TechnicianProfile>(`/admin/technicians/${id}`);
    return data;
  },

  async create(body: {
    email: string; fullName: string; password: string; phone?: string;
    licenseNumber?: string; skills?: string[];
  }): Promise<{ id: string; email: string; full_name: string; status: string }> {
    const { data } = await apiClient.post('/admin/technicians', body);
    return data as { id: string; email: string; full_name: string; status: string };
  },

  async update(id: string, body: {
    skills?: string[]; service_area_ids?: string[]; is_available?: boolean; license_number?: string;
  }): Promise<TechnicianProfile> {
    const { data } = await apiClient.patch<TechnicianProfile>(`/admin/technicians/${id}`, body);
    return data;
  },

  async serviceAreas(): Promise<ServiceArea[]> {
    const { data } = await apiClient.get<{ data?: ServiceArea[] } | ServiceArea[]>('/service-areas');
    return (data as { data?: ServiceArea[] }).data ?? (data as ServiceArea[]) ?? [];
  },

  async setStatus(userId: string, status: UserStatus, reason?: string): Promise<void> {
    await apiClient.patch(`/admin/technicians/${userId}/status`, { status, ...(reason ? { reason } : {}) });
  },

  async jobs(technicianId: string, params?: QueryParams): Promise<Paginated<TechnicianJobRow>> {
    const { data } = await apiClient.get<Paginated<TechnicianJobRow>>('/bookings', {
      params: { ...params, technician_id: technicianId },
    });
    return data;
  },
};
