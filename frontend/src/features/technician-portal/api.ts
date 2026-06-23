import { apiClient } from '@/services/apiClient';
import type { TechJob, TechProfile } from './types';

export const techPortalApi = {
  async profile(): Promise<TechProfile> {
    const { data } = await apiClient.get('/technicians/me');
    return data as TechProfile;
  },

  async jobs(): Promise<TechJob[]> {
    const { data } = await apiClient.get<TechJob[] | { data: TechJob[] }>('/technicians/me/jobs');
    return (data as { data?: TechJob[] }).data ?? (data as TechJob[]);
  },

  async setAvailability(isAvailable: boolean): Promise<void> {
    await apiClient.patch('/technicians/me/availability', { is_available: isAvailable });
  },

  async acceptJob(id: string): Promise<void> {
    await apiClient.post(`/bookings/${id}/accept`);
  },

  async declineJob(id: string): Promise<void> {
    await apiClient.post(`/bookings/${id}/decline`);
  },

  async advanceStatus(id: string, status: string): Promise<void> {
    await apiClient.patch(`/bookings/${id}/status`, { status });
  },

  async completeJob(id: string, photo: File, notes?: string): Promise<void> {
    const form = new FormData();
    form.append('photo', photo);
    if (notes?.trim()) form.append('notes', notes.trim());
    await apiClient.post(`/bookings/${id}/complete`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
