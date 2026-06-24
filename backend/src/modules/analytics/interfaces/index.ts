// src/modules/analytics/interfaces/index.ts

export interface TimeSeriesPoint {
  bucket: string;
  value: number;
}
export interface LabelledValue {
  label: string;
  value: number;
  count?: number;
}

export interface DashboardKpis {
  total_revenue: number;
  monthly_revenue: number;
  total_customers: number;
  active_customers: number;
  total_bookings: number;
  completed_bookings: number;
  active_technicians: number;
  active_subscriptions: number;
  generated_at: Date;
}

export interface ReportEnvelope {
  title: string;
  generated_at: Date;
  range: { from: string; to: string };
  sections: {
    heading: string;
    columns: string[];
    rows: (string | number)[][];
  }[];
}
