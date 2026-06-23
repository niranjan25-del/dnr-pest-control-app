// src/features/bookings/api.ts
// Booking + dispatch calls. Assignment uses the canonical Dispatch endpoints
// (/dispatch/bookings/:id/...) per the backend; reschedule/cancel use the booking routes.

import { apiClient } from '@/services/apiClient';
import type { QueryParams } from '@/services/createResourceService';
import type { Paginated } from '@/types';
import type { BookingDetail, BookingListItem, Candidate, StatusHistoryEntry } from './types';

export const bookingsApi = {
  async create(body: {
    customerId: string;
    serviceId?: string;
    packageId?: string;
    addressId: string;
    scheduledStart: string;
    notes?: string;
  }): Promise<BookingDetail> {
    const { data } = await apiClient.post<BookingDetail>('/bookings', body);
    return data;
  },

  async list(params: QueryParams): Promise<Paginated<BookingListItem>> {
    const { data } = await apiClient.get<Paginated<BookingListItem>>('/bookings', { params });
    return data;
  },
  async detail(id: string): Promise<BookingDetail> {
    const { data } = await apiClient.get<{ data?: BookingDetail } | BookingDetail>(`/bookings/${id}`);
    return (data as { data?: BookingDetail }).data ?? (data as BookingDetail);
  },
  async statusHistory(id: string): Promise<StatusHistoryEntry[]> {
    const { data } = await apiClient.get<{ data?: StatusHistoryEntry[] } | StatusHistoryEntry[]>(`/bookings/${id}/status-history`);
    return (data as { data?: StatusHistoryEntry[] }).data ?? (data as StatusHistoryEntry[]) ?? [];
  },
  async reschedule(id: string, windowStartIso: string, windowEndIso: string): Promise<void> {
    await apiClient.patch(`/bookings/${id}/reschedule`, {
      scheduled_window_start: windowStartIso,
      scheduled_window_end: windowEndIso,
    });
  },
  async cancel(id: string, reason?: string): Promise<void> {
    await apiClient.post(`/bookings/${id}/cancel`, reason ? { reason } : {});
  },
  // ---- Dispatch (canonical) ----
  async candidates(bookingId: string): Promise<Candidate[]> {
    const { data } = await apiClient.get<{ data?: Candidate[] } | Candidate[]>(`/dispatch/bookings/${bookingId}/candidates`);
    return (data as { data?: Candidate[] }).data ?? (data as Candidate[]) ?? [];
  },
  async assign(bookingId: string, technicianId: string): Promise<void> {
    await apiClient.post(`/dispatch/bookings/${bookingId}/assign`, { technicianId });
  },
  async reassign(bookingId: string, technicianId?: string, reason?: string): Promise<void> {
    await apiClient.post(`/dispatch/bookings/${bookingId}/reassign`, {
      ...(technicianId ? { technicianId } : {}),
      ...(reason ? { reason } : {}),
    });
  },
};
