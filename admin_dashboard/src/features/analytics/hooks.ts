// src/features/analytics/hooks.ts
// Query hooks keyed by the active filters, so changing the date range / granularity / scope
// refetches and caches per-combination. 60s staleTime matches the backend KPI cache.

import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from './api';
import type { AnalyticsFilters } from './types';

const key = (domain: string, f: AnalyticsFilters) => ['analytics', domain, f] as const;
const opts = { staleTime: 60_000 } as const;

export const useKpis = (f: AnalyticsFilters) => useQuery({ queryKey: key('kpis', f), queryFn: () => analyticsApi.kpis(f), ...opts });
export const useRevenue = (f: AnalyticsFilters) => useQuery({ queryKey: key('revenue', f), queryFn: () => analyticsApi.revenue(f), ...opts });
export const useBookingAnalytics = (f: AnalyticsFilters) => useQuery({ queryKey: key('bookings', f), queryFn: () => analyticsApi.bookings(f), ...opts });
export const useCustomerAnalytics = (f: AnalyticsFilters) => useQuery({ queryKey: key('customers', f), queryFn: () => analyticsApi.customers(f), ...opts });
export const useTechnicianAnalytics = (f: AnalyticsFilters) => useQuery({ queryKey: key('technicians', f), queryFn: () => analyticsApi.technicians(f), ...opts });
export const useSubscriptionAnalytics = (f: AnalyticsFilters) => useQuery({ queryKey: key('subscriptions', f), queryFn: () => analyticsApi.subscriptions(f), ...opts });
export const useReviewAnalytics = (f: AnalyticsFilters) => useQuery({ queryKey: key('reviews', f), queryFn: () => analyticsApi.reviews(f), ...opts });
export const useServicesAnalytics = (f: AnalyticsFilters) => useQuery({ queryKey: key('services', f), queryFn: () => analyticsApi.services(f), ...opts });
