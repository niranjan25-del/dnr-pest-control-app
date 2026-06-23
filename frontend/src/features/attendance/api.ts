import { apiClient } from '@/services/apiClient';
import type { AttendanceListResponse, DutyStatusResponse } from './types';

export const attendanceApi = {
  async list(params: {
    date?: string;
    from?: string;
    to?: string;
    technician_id?: string;
    user_id?: string;
    page?: number;
    limit?: number;
  }): Promise<AttendanceListResponse> {
    const { data } = await apiClient.get('/admin/technicians/attendance', { params });
    return data as AttendanceListResponse;
  },
};

export const techAttendanceApi = {
  async status(): Promise<DutyStatusResponse> {
    const { data } = await apiClient.get('/technicians/me/duty-status');
    return data as DutyStatusResponse;
  },

  async punchIn(note?: string): Promise<void> {
    await apiClient.post('/technicians/me/punch-in', { note });
  },

  async punchOut(note?: string): Promise<void> {
    await apiClient.post('/technicians/me/punch-out', { note });
  },
};
