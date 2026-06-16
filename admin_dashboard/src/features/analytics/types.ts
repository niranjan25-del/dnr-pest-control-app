// src/features/analytics/types.ts
// Analytics DTOs. The backend returns pre-aggregated metrics (totals + time series +
// breakdowns) keyed by the filter range, so the client never handles raw rows — that's how
// "large datasets" stay fast. Field names mirror the analytics module; parsing is defensive
// (see api.ts) since a few names are confirm items.

export type Granularity = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export interface AnalyticsFilters {
  from: string; // ISO date
  to: string;   // ISO date
  granularity: Granularity;
  service_id?: string;
  technician_id?: string;
  region?: string;
}

export interface TimePoint {
  period: string;
  value: number;
  [key: string]: unknown;
}

export interface Breakdown {
  label: string;
  value: number;
  [key: string]: unknown;
}

// Matches the backend GET /analytics/dashboard response (Step 18). Retention + average
// rating are NOT part of the dashboard payload — they come from the customers/reviews
// analytics endpoints and are merged in on the Executive page (kept optional here).
export interface Kpis {
  total_revenue: number;
  monthly_revenue: number;
  total_customers: number;
  active_customers: number;
  total_bookings: number;
  completed_bookings: number;
  active_technicians: number;
  active_subscriptions: number;
  generated_at?: string;
  // merged from other analytics endpoints on the Executive page:
  retention_pct?: number;
  average_rating?: number;
}

export interface RevenueAnalytics {
  total: number;
  currency: string;
  series: TimePoint[];
  by_service: Breakdown[];
}

export interface BookingAnalytics {
  total: number;
  completed: number;
  cancelled: number;
  no_show: number;
  series: TimePoint[];          // booking volume over time
  cancellations: TimePoint[];   // cancellation trend (may be empty)
  by_status: Breakdown[];
}

export interface CustomerAnalytics {
  new_customers: number;
  active_customers: number;
  retention_pct: number;
  lifetime_value?: number;      // proxy if provided; else hidden
  series: TimePoint[];          // new customers over time
}

export interface TechnicianLeaderRow {
  technician_id: string;
  full_name: string;
  jobs_completed: number;
  avg_rating: number;
  revenue_generated: number;
}
export interface TechnicianAnalytics {
  leaderboard: TechnicianLeaderRow[];
}

export interface SubscriptionAnalytics {
  active: number;
  churn_rate_pct: number;
  renewal_rate_pct: number;
  series?: TimePoint[];
}

export interface ReviewAnalytics {
  average_rating: number;
  trend: TimePoint[];           // avg rating over time
}

export interface ServicesAnalytics {
  most_popular: Breakdown[];
  revenue_by_service: Breakdown[];
  growth: TimePoint[];
}

export type ReportType = 'REVENUE' | 'BOOKINGS' | 'TECHNICIANS' | 'CUSTOMERS' | 'SUBSCRIPTIONS';
export type ExportFormat = 'CSV' | 'EXCEL' | 'PDF';
