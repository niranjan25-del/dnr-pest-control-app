// src/modules/analytics/reports.service.ts
//
// Builds structured report envelopes (title + tabular sections) by composing AnalyticsService
// outputs. The same envelope drives both the JSON report endpoints and the export service, so
// CSV/Excel/PDF stay consistent with what the API returns.

import { Injectable } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Granularity } from './enums';
import { ReportEnvelope } from './interfaces';

@Injectable()
export class ReportsService {
  constructor(private readonly analytics: AnalyticsService) {}

  private envelope(title: string, from: Date, to: Date): Pick<ReportEnvelope, 'title' | 'generated_at' | 'range'> {
    return { title, generated_at: new Date(), range: { from: from.toISOString(), to: to.toISOString() } };
  }

  async revenue(from: Date, to: Date, granularity = Granularity.DAILY): Promise<ReportEnvelope> {
    const data = await this.analytics.revenue(from, to, granularity);
    return {
      ...this.envelope('Revenue Report', from, to),
      sections: [
        { heading: 'Summary', columns: ['Metric', 'Value'], rows: [['Net Revenue', data.net_revenue]] },
        { heading: 'Revenue Over Time', columns: ['Period', 'Net'], rows: data.series.map((s) => [s.bucket, s.value]) },
        { heading: 'Revenue by Service', columns: ['Service', 'Net', 'Payments'], rows: data.by_service.map((s) => [s.label, s.value, s.count ?? 0]) },
        { heading: 'Revenue by Technician', columns: ['Technician', 'Net'], rows: data.by_technician.map((s) => [s.label, s.value]) },
      ],
    };
  }

  async bookings(from: Date, to: Date, granularity = Granularity.DAILY): Promise<ReportEnvelope> {
    const data = await this.analytics.bookings(from, to, granularity);
    return {
      ...this.envelope('Booking Report', from, to),
      sections: [
        { heading: 'Summary', columns: ['Metric', 'Value'], rows: [
          ['Total', data.total], ['Completion Rate', data.completion_rate], ['Cancellation Rate', data.cancellation_rate], ['Reschedule Rate', data.reschedule_rate],
        ] },
        { heading: 'By Status', columns: ['Status', 'Count'], rows: data.by_status.map((s) => [s.label, s.value]) },
        { heading: 'Trend', columns: ['Period', 'Bookings'], rows: data.trends.map((t) => [t.bucket, t.value]) },
      ],
    };
  }

  async customers(from: Date, to: Date): Promise<ReportEnvelope> {
    const c = await this.analytics.customers(from, to);
    return {
      ...this.envelope('Customer Report', from, to),
      sections: [{ heading: 'Summary', columns: ['Metric', 'Value'], rows: [
        ['Total Customers', c.total_customers], ['New Customers', c.new_customers], ['Active Customers', c.active_customers],
        ['Repeat Customers', c.repeat_customers], ['Retention Rate', c.retention_rate], ['Avg Lifetime Value', c.avg_lifetime_value],
      ] }],
    };
  }

  async technicians(actor: import('../auth/interfaces/auth.interfaces').AuthenticatedUser, from: Date, to: Date): Promise<ReportEnvelope> {
    const { technicians } = await this.analytics.technicians(actor, from, to);
    return {
      ...this.envelope('Technician Report', from, to),
      sections: [{
        heading: 'Technician Performance',
        columns: ['Technician', 'Jobs (total)', 'Jobs (range)', 'Avg Rating', 'Revenue', 'Utilization'],
        rows: technicians.map((t) => [t.name, t.jobs_completed_total, t.jobs_completed_in_range, t.average_rating, t.revenue_generated, t.utilization_rate]),
      }],
    };
  }

  async subscriptions(from: Date, to: Date): Promise<ReportEnvelope> {
    const s = await this.analytics.subscriptions(from, to);
    return {
      ...this.envelope('Subscription Report', from, to),
      sections: [{ heading: 'Summary', columns: ['Metric', 'Value'], rows: [
        ['Active', s.active_subscriptions], ['Paused', s.paused_subscriptions], ['Cancelled (range)', s.cancelled_in_range],
        ['Churn Rate', s.churn_rate], ['Renewal Rate', s.renewal_rate], ['Subscription Revenue', s.subscription_revenue],
      ] }],
    };
  }
}
