// src/features/technicians/api.ts
// Technician admin calls: list via /users (role=TECHNICIAN), detail via /technicians/:id,
// update (certs/areas/skills) via PATCH /technicians/:id, available service areas via
// /service-areas, status via /users/:id/status.

import { apiClient } from '@/services/apiClient';
import type { QueryParams } from '@/services/createResourceService';
import type { Paginated } from '@/types';
import type { ServiceArea, TechnicianProfile, TechnicianRow } from './types';
import type { UserStatus } from '@/features/customers/types';

export const techniciansApi = {
  async list(params: QueryParams): Promise<Paginated<TechnicianRow>> {
    const { data } = await apiClient.get<Paginated<TechnicianRow>>('/users', { params: { ...params, role: 'TECHNICIAN' } });
    return data;
  },
  async profile(id: string): Promise<TechnicianProfile> {
    const { data } = await apiClient.get<{ data?: TechnicianProfile } | TechnicianProfile>(`/technicians/${id}`);
    return (data as { data?: TechnicianProfile }).data ?? (data as TechnicianProfile);
  },
  async update(id: string, body: Partial<Pick<TechnicianProfile, 'skills'>> & { service_area_ids?: string[] }): Promise<TechnicianProfile> {
    const { data } = await apiClient.patch(`/technicians/${id}`, body);
    return (data as { data?: TechnicianProfile }).data ?? (data as TechnicianProfile);
  },
  async serviceAreas(): Promise<ServiceArea[]> {
    const { data } = await apiClient.get<{ data?: ServiceArea[] } | ServiceArea[]>('/service-areas');
    return (data as { data?: ServiceArea[] }).data ?? (data as ServiceArea[]) ?? [];
  },
  async setStatus(userId: string, status: UserStatus, reason?: string): Promise<void> {
    await apiClient.patch(`/users/${userId}/status`, { status, ...(reason ? { reason } : {}) });
  },
};
