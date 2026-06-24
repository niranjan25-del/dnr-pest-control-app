import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customerPortalApi } from './api';
import type { QueryParams } from '@/services/createResourceService';

const keys = {
  profile:       ['customer-portal', 'profile'] as const,
  addresses:     ['customer-portal', 'addresses'] as const,
  bookings: (p: QueryParams) => ['customer-portal', 'bookings', p] as const,
  invoices: (p: QueryParams) => ['customer-portal', 'invoices', p] as const,
  serviceReports: ['customer-portal', 'service-reports'] as const,
  subscriptions:  ['customer-portal', 'subscriptions'] as const,
  warranties:     ['customer-portal', 'warranties'] as const,
};

// ── Profile ─────────────────────────────────────────────────────────────────

export function useMyProfile() {
  return useQuery({ queryKey: keys.profile, queryFn: () => customerPortalApi.getProfile() });
}

export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof customerPortalApi.updateProfile>[0]) =>
      customerPortalApi.updateProfile(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.profile }),
  });
}

// ── Addresses ────────────────────────────────────────────────────────────────

export function useMyAddresses() {
  return useQuery({ queryKey: keys.addresses, queryFn: () => customerPortalApi.listAddresses() });
}

export function useCreateMyAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof customerPortalApi.createAddress>[0]) =>
      customerPortalApi.createAddress(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.addresses });
      qc.invalidateQueries({ queryKey: keys.profile });
    },
  });
}

export function useUpdateMyAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof customerPortalApi.updateAddress>[1] }) =>
      customerPortalApi.updateAddress(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.addresses }),
  });
}

export function useDeleteMyAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customerPortalApi.deleteAddress(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.addresses });
      qc.invalidateQueries({ queryKey: keys.profile });
    },
  });
}

// ── Bookings ──────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS']);

export function useMyBookings(params: QueryParams) {
  return useQuery({
    queryKey: keys.bookings(params),
    queryFn: () => customerPortalApi.listBookings(params),
    placeholderData: (p) => p,
  });
}

export function useMyBooking(id: string) {
  return useQuery({
    queryKey: ['customer-portal', 'booking', id],
    queryFn: () => customerPortalApi.getBooking(id),
    enabled: Boolean(id),
    refetchInterval: (query) => ACTIVE_STATUSES.has(query.state.data?.status ?? '') ? 30_000 : false,
  });
}

export function useCancelMyBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      customerPortalApi.cancelBooking(id, reason),
    onSuccess: (data) => {
      qc.setQueryData(['customer-portal', 'booking', data.id], data);
      qc.invalidateQueries({ queryKey: ['customer-portal', 'bookings'] });
    },
  });
}

export function useRescheduleMyBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduledStart, reason }: { id: string; scheduledStart: string; reason?: string }) =>
      customerPortalApi.rescheduleBooking(id, scheduledStart, reason),
    onSuccess: (data) => {
      qc.setQueryData(['customer-portal', 'booking', data.id], data);
      qc.invalidateQueries({ queryKey: ['customer-portal', 'bookings'] });
    },
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof customerPortalApi.createBooking>[0]) =>
      customerPortalApi.createBooking(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-portal', 'bookings'] });
    },
  });
}

// ── Invoices ──────────────────────────────────────────────────────────────────

export function useMyInvoices(params: QueryParams) {
  return useQuery({
    queryKey: keys.invoices(params),
    queryFn: () => customerPortalApi.listInvoices(params),
    placeholderData: (p) => p,
  });
}

// ── Payments (Cashfree) ───────────────────────────────────────────────────────

export function useCreateCashfreeOrder() {
  return useMutation({
    mutationFn: (bookingId: string) => customerPortalApi.createCashfreeOrder(bookingId),
  });
}

export function useConfirmCashfreePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => customerPortalApi.confirmCashfreePayment(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-portal', 'invoices'] });
      qc.invalidateQueries({ queryKey: ['customer-portal', 'bookings'] });
    },
  });
}

// ── Service Reports ───────────────────────────────────────────────────────────

export function useMyServiceReports() {
  return useQuery({
    queryKey: keys.serviceReports,
    queryFn: () => customerPortalApi.listServiceReports(),
    staleTime: 60_000,
  });
}

export function useMyServiceReport(id: string) {
  return useQuery({
    queryKey: [...keys.serviceReports, id],
    queryFn: () => customerPortalApi.getServiceReport(id),
    enabled: Boolean(id),
  });
}

// ── Coupons ───────────────────────────────────────────────────────────────────

export function useValidateCoupon() {
  return useMutation({
    mutationFn: (vars: { code: string; bookingId?: string; amount?: number }) =>
      customerPortalApi.validateCoupon(vars.code, { bookingId: vars.bookingId, amount: vars.amount }),
  });
}

export function useRedeemCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, bookingId }: { code: string; bookingId: string }) =>
      customerPortalApi.redeemCoupon(code, bookingId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['customer-portal', 'booking', vars.bookingId] });
      qc.invalidateQueries({ queryKey: ['customer-portal', 'bookings'] });
    },
  });
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { bookingId: string; rating: number; comment?: string }) =>
      customerPortalApi.submitReview(body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['customer-portal', 'booking', vars.bookingId] });
    },
  });
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export function useMySubscriptions() {
  return useQuery({
    queryKey: keys.subscriptions,
    queryFn: () => customerPortalApi.listSubscriptions(),
  });
}

export function usePauseSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customerPortalApi.pauseSubscription(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.subscriptions }),
  });
}

export function useResumeSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customerPortalApi.resumeSubscription(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.subscriptions }),
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      customerPortalApi.cancelSubscription(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.subscriptions }),
  });
}

// ── Warranties ────────────────────────────────────────────────────────────────

export function useMyWarranties() {
  return useQuery({
    queryKey: keys.warranties,
    queryFn: () => customerPortalApi.listWarranties(),
  });
}

export function useWarrantyForBooking(bookingId: string) {
  return useQuery({
    queryKey: [...keys.warranties, 'booking', bookingId],
    queryFn: () => customerPortalApi.getWarrantyForBooking(bookingId),
    enabled: Boolean(bookingId),
    retry: false,
  });
}

// ── Service Area Coverage ─────────────────────────────────────────────────────

export function useCheckCoverage(postalCode: string) {
  return useQuery({
    queryKey: ['service-areas', 'coverage', postalCode],
    queryFn: () => customerPortalApi.checkCoverage(postalCode),
    enabled: Boolean(postalCode),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Catalog ───────────────────────────────────────────────────────────────────

export function useAvailableServices() {
  return useQuery({
    queryKey: ['customer-portal', 'services'],
    queryFn: () => customerPortalApi.listServices(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAvailablePackages() {
  return useQuery({
    queryKey: ['customer-portal', 'packages'],
    queryFn: () => customerPortalApi.listPackages(),
    staleTime: 5 * 60 * 1000,
  });
}
