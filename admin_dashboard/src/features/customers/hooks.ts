// src/features/customers/hooks.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi } from './api';
import type { QueryParams } from '@/services/createResourceService';
import type { UserStatus } from './types';

const keys = {
  all: ['customers'] as const,
  list: (p: QueryParams) => ['customers', 'list', p] as const,
  profile: (id: string) => ['customers', 'profile', id] as const,
  bookings: (id: string, p: QueryParams) => ['customers', id, 'bookings', p] as const,
  invoices: (id: string, p: QueryParams) => ['customers', id, 'invoices', p] as const,
};

export function useCustomers(params: QueryParams) {
  return useQuery({ queryKey: keys.list(params), queryFn: () => customersApi.list(params), placeholderData: (p) => p });
}
export function useCustomerProfile(id: string) {
  return useQuery({ queryKey: keys.profile(id), queryFn: () => customersApi.profile(id), enabled: Boolean(id) });
}
export function useCustomerBookings(id: string, params: QueryParams) {
  return useQuery({ queryKey: keys.bookings(id, params), queryFn: () => customersApi.bookings(id, params), enabled: Boolean(id), placeholderData: (p) => p });
}
export function useCustomerInvoices(id: string, params: QueryParams) {
  return useQuery({ queryKey: keys.invoices(id, params), queryFn: () => customersApi.invoices(id, params), enabled: Boolean(id), placeholderData: (p) => p });
}

export function useSetCustomerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: string; status: UserStatus; reason?: string }) => customersApi.setStatus(vars.userId, vars.status, vars.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
