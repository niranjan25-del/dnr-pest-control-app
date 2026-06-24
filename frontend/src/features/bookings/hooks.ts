// src/features/bookings/hooks.ts
// TanStack Query hooks for bookings. Mutations invalidate the affected queries so the list
// + detail stay fresh after assign/reassign/cancel/reschedule.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingsApi } from './api';
import type { QueryParams } from '@/services/createResourceService';

const keys = {
  all: ['bookings'] as const,
  list: (params: QueryParams) => ['bookings', 'list', params] as const,
  detail: (id: string) => ['bookings', 'detail', id] as const,
  history: (id: string) => ['bookings', 'history', id] as const,
  candidates: (id: string) => ['bookings', 'candidates', id] as const,
};

export function useBookings(params: QueryParams) {
  return useQuery({ queryKey: keys.list(params), queryFn: () => bookingsApi.list(params), placeholderData: (prev) => prev });
}

export function useBooking(id: string) {
  return useQuery({ queryKey: keys.detail(id), queryFn: () => bookingsApi.detail(id), enabled: Boolean(id) });
}

export function useBookingHistory(id: string) {
  return useQuery({ queryKey: keys.history(id), queryFn: () => bookingsApi.statusHistory(id), enabled: Boolean(id) });
}

export function useCandidates(bookingId: string, enabled: boolean) {
  return useQuery({ queryKey: keys.candidates(bookingId), queryFn: () => bookingsApi.candidates(bookingId), enabled });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof bookingsApi.create>[0]) => bookingsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useBookingMutations(id: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.all });
  };

  const assign = useMutation({ mutationFn: (technicianId: string) => bookingsApi.assign(id, technicianId), onSuccess: invalidate });
  const reassign = useMutation({
    mutationFn: (vars: { technicianId?: string; reason?: string }) => bookingsApi.reassign(id, vars.technicianId, vars.reason),
    onSuccess: invalidate,
  });
  const cancel = useMutation({ mutationFn: (reason?: string) => bookingsApi.cancel(id, reason), onSuccess: invalidate });
  const reschedule = useMutation({
    mutationFn: (vars: { start: string }) => bookingsApi.reschedule(id, vars.start),
    onSuccess: invalidate,
  });

  return { assign, reassign, cancel, reschedule };
}
