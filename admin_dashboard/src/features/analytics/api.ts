// src/features/analytics/api.ts
// Calls the /analytics/* endpoints. Responses are mapped defensively (multiple plausible
// field names → our normalized types), because a few backend field names are confirm items.
// Helpers `num`, `series`, `breakdown` keep the mapping terse and null-safe.
//
// FLAG: service_id / technician_id / region filters are passed through; confirm which
// endpoints honor them server-side (revenue-by-service is inherent; cross-filters may need
// backend support).

import { apiClient } from '@/services/apiClient';
import type {
  AnalyticsFilters, BookingAnalytics, CustomerAnalytics, Kpis, RevenueAnalytics,
  ReviewAnalytics, ServicesAnalytics, SubscriptionAnalytics, TechnicianAnalytics, TimePoint, Breakdown,
} from './types';

const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : d;
};

function series(raw: unknown): TimePoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    const o = r as Record<string, unknown>;
    return { period: String(o.period ?? o.bucket ?? o.date ?? o.month ?? ''), value: num(o.value ?? o.amount ?? o.count ?? o.total) };
  });
}

function breakdown(raw: unknown, labelKeys: string[]): Breakdown[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    const o = r as Record<string, unknown>;
    const label = labelKeys.map((k) => o[k]).find(Boolean);
    return { label: String(label ?? '—'), value: num(o.value ?? o.amount ?? o.count ?? o.total) };
  });
}

function params(f: AnalyticsFilters) {
  return {
    from: f.from, to: f.to, granularity: f.granularity,
    ...(f.service_id ? { service_id: f.service_id } : {}),
    ...(f.technician_id ? { technician_id: f.technician_id } : {}),
    ...(f.region ? { region: f.region } : {}),
  };
}

function unwrap<T>(data: unknown): T {
  const m = data as { data?: T };
  return (m && typeof m === 'object' && 'data' in m ? m.data : data) as T;
}

export const analyticsApi = {
  async kpis(f: AnalyticsFilters): Promise<Kpis> {
    // Backend endpoint is GET /analytics/dashboard (8 cached KPIs); not /analytics/kpis.
    const { data } = await apiClient.get('/analytics/dashboard', { params: params(f) });
    const d = unwrap<Record<string, unknown>>(data);
    return {
      total_revenue: num(d.total_revenue),
      monthly_revenue: num(d.monthly_revenue),
      total_customers: num(d.total_customers),
      active_customers: num(d.active_customers),
      total_bookings: num(d.total_bookings),
      completed_bookings: num(d.completed_bookings),
      active_technicians: num(d.active_technicians),
      active_subscriptions: num(d.active_subscriptions),
      generated_at: typeof d.generated_at === 'string' ? d.generated_at : undefined,
    };
  },

  async revenue(f: AnalyticsFilters): Promise<RevenueAnalytics> {
    const { data } = await apiClient.get('/analytics/revenue', { params: params(f) });
    const d = unwrap<Record<string, unknown>>(data);
    return {
      total: num(d.total),
      currency: String(d.currency ?? 'INR'),
      series: series(d.series ?? d.time_series),
      by_service: breakdown(d.by_service, ['service', 'service_name', 'label']),
    };
  },

  async bookings(f: AnalyticsFilters): Promise<BookingAnalytics> {
    const { data } = await apiClient.get('/analytics/bookings', { params: params(f) });
    const d = unwrap<Record<string, unknown>>(data);
    return {
      total: num(d.total),
      completed: num(d.completed),
      cancelled: num(d.cancelled),
      no_show: num(d.no_show),
      series: series(d.series ?? d.time_series),
      cancellations: series(d.cancellations ?? d.cancellation_series),
      by_status: breakdown(d.by_status, ['status', 'label']),
    };
  },

  async customers(f: AnalyticsFilters): Promise<CustomerAnalytics> {
    const { data } = await apiClient.get('/analytics/customers', { params: params(f) });
    const d = unwrap<Record<string, unknown>>(data);
    return {
      new_customers: num(d.new ?? d.new_customers),
      active_customers: num(d.active ?? d.active_customers),
      retention_pct: num(d.retention_pct ?? d.retention),
      lifetime_value: d.lifetime_value != null ? num(d.lifetime_value) : undefined,
      series: series(d.series ?? d.new_series),
    };
  },

  async technicians(f: AnalyticsFilters): Promise<TechnicianAnalytics> {
    const { data } = await apiClient.get('/analytics/technicians', { params: params(f) });
    const d = unwrap<Record<string, unknown>>(data);
    const rows = (d.leaderboard ?? d.technicians ?? []) as Record<string, unknown>[];
    return {
      leaderboard: rows.map((r) => ({
        technician_id: String(r.technician_id ?? r.id ?? ''),
        full_name: String(r.full_name ?? r.name ?? '—'),
        jobs_completed: num(r.jobs_completed ?? r.completed_jobs),
        avg_rating: num(r.avg_rating ?? r.rating),
        revenue_generated: num(r.revenue_generated ?? r.revenue),
      })),
    };
  },

  async subscriptions(f: AnalyticsFilters): Promise<SubscriptionAnalytics> {
    const { data } = await apiClient.get('/analytics/subscriptions', { params: params(f) });
    const d = unwrap<Record<string, unknown>>(data);
    return {
      active: num(d.active),
      churn_rate_pct: num(d.churn_rate_pct ?? d.churn_rate),
      renewal_rate_pct: num(d.renewal_rate_pct ?? d.renewal_rate),
      series: series(d.series),
    };
  },

  async reviews(f: AnalyticsFilters): Promise<ReviewAnalytics> {
    const { data } = await apiClient.get('/analytics/reviews', { params: params(f) });
    const d = unwrap<Record<string, unknown>>(data);
    return {
      average_rating: num(d.average_rating ?? d.avg_rating),
      trend: series(d.trend ?? d.monthly_trend),
    };
  },

  async services(f: AnalyticsFilters): Promise<ServicesAnalytics> {
    const { data } = await apiClient.get('/analytics/services', { params: params(f) });
    const d = unwrap<Record<string, unknown>>(data);
    return {
      most_popular: breakdown(d.most_popular, ['label', 'service', 'service_name']),
      revenue_by_service: breakdown(d.revenue_by_service, ['label', 'service', 'service_name']),
      growth: series(d.growth ?? d.series),
    };
  },
};
