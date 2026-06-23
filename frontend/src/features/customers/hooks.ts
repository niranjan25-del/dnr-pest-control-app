import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi } from './api';
import type { QueryParams } from '@/services/createResourceService';
import type { UserStatus } from './types';

const keys = {
  all: ['customers'] as const,
  list: (p: QueryParams) => ['customers', 'list', p] as const,
  profile: (id: string) => ['customers', 'profile', id] as const,
  addresses: (id: string) => ['customers', id, 'addresses'] as const,
  bookings: (id: string, p: QueryParams) => ['customers', id, 'bookings', p] as const,
  invoices: (id: string, p: QueryParams) => ['customers', id, 'invoices', p] as const,
};

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof customersApi.create>[0]) => customersApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useCustomers(params: QueryParams) {
  return useQuery({ queryKey: keys.list(params), queryFn: () => customersApi.list(params), placeholderData: (p) => p });
}

export function useCustomerProfile(id: string) {
  return useQuery({ queryKey: keys.profile(id), queryFn: () => customersApi.profile(id), enabled: Boolean(id) });
}

export function useUpdateCustomerProfile(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof customersApi.updateProfile>[1]) => customersApi.updateProfile(userId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.profile(userId) });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useCustomerAddresses(userId: string) {
  return useQuery({
    queryKey: keys.addresses(userId),
    queryFn: () => customersApi.addresses(userId),
    enabled: Boolean(userId),
  });
}

export function useCreateAddress(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof customersApi.createAddress>[1]) => customersApi.createAddress(userId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.addresses(userId) });
      qc.invalidateQueries({ queryKey: keys.profile(userId) });
    },
  });
}

export function useUpdateAddress(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ addressId, body }: { addressId: string; body: Parameters<typeof customersApi.updateAddress>[2] }) =>
      customersApi.updateAddress(userId, addressId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.addresses(userId) }),
  });
}

export function useDeleteAddress(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (addressId: string) => customersApi.deleteAddress(userId, addressId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.addresses(userId) });
      qc.invalidateQueries({ queryKey: keys.profile(userId) });
    },
  });
}

export function useCustomerBookings(id: string, params: QueryParams) {
  return useQuery({ queryKey: keys.bookings(id, params), queryFn: () => customersApi.bookings(id, params), enabled: Boolean(id), placeholderData: (p) => p });
}

export function useCustomerInvoices(id: string, params: QueryParams) {
  return useQuery({ queryKey: keys.invoices(id, params), queryFn: () => customersApi.invoices(id, params), enabled: Boolean(id), placeholderData: (p) => p });
}

export function useCustomerStats(userId: string) {
  return useQuery({
    queryKey: ['customers', userId, 'stats'],
    queryFn: () => customersApi.stats(userId),
    enabled: Boolean(userId),
  });
}

export function useCustomerReviews(userId: string, params: QueryParams) {
  return useQuery({
    queryKey: ['customers', userId, 'reviews', params],
    queryFn: () => customersApi.reviews(userId, params),
    enabled: Boolean(userId),
    placeholderData: (p) => p,
  });
}

export function useSetCustomerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: string; status: UserStatus; reason?: string }) => customersApi.setStatus(vars.userId, vars.status, vars.reason),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.all });
      qc.invalidateQueries({ queryKey: keys.profile(vars.userId) });
    },
  });
}
