// src/features/analytics/ExecutiveDashboardPage.tsx
// Executive overview: the six headline KPIs + monthly growth & retention, plus revenue and
// booking trend charts. Reads shared filters from the URL.

import Grid from '@mui/material/Grid2';
import { KpiCard, ChartCard, LineSeriesChart, useChartColors } from '@/components/charts';
import { formatMoney } from '@/utils/format';
import { useAnalyticsFilters } from './filters';
import { useKpis, useRevenue, useBookingAnalytics, useCustomerAnalytics, useReviewAnalytics } from './hooks';

export function ExecutiveDashboardPage() {
  const { filters } = useAnalyticsFilters();
  const colors = useChartColors();
  const kpis = useKpis(filters);
  const revenue = useRevenue(filters);
  const bookings = useBookingAnalytics(filters);
  const customers = useCustomerAnalytics(filters); // retention not in dashboard payload
  const reviews = useReviewAnalytics(filters);      // average rating not in dashboard payload

  const k = kpis.data;
  const cards = [
    { label: 'Total revenue', value: k ? formatMoney(k.total_revenue) : '—' },
    { label: 'Monthly revenue', value: k ? formatMoney(k.monthly_revenue) : '—' },
    { label: 'Total bookings', value: k ? String(k.total_bookings) : '—' },
    { label: 'Active customers', value: k ? String(k.active_customers) : '—' },
    { label: 'Active technicians', value: k ? String(k.active_technicians) : '—' },
    { label: 'Active subscriptions', value: k ? String(k.active_subscriptions) : '—' },
    { label: 'Customer retention', value: customers.data ? `${customers.data.retention_pct.toFixed(1)}%` : '—' },
    { label: 'Avg rating', value: reviews.data ? reviews.data.average_rating.toFixed(2) : '—' },
  ];
  const cardsLoading = kpis.isLoading || customers.isLoading || reviews.isLoading;

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 1 }}>
        {cards.map((c) => (
          <Grid key={c.label} size={{ xs: 6, sm: 4, md: 3 }}>
            <KpiCard label={c.label} value={c.value} loading={cardsLoading} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <ChartCard title="Revenue trend" loading={revenue.isLoading} error={revenue.error} isEmpty={!revenue.data?.series.length} onRetry={revenue.refetch}>
            <LineSeriesChart data={revenue.data?.series ?? []} xKey="period" series={[{ key: 'value', name: 'Revenue', color: colors[0] }]} valueFormatter={(v) => formatMoney(v)} />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <ChartCard title="Booking volume" loading={bookings.isLoading} error={bookings.error} isEmpty={!bookings.data?.series.length} onRetry={bookings.refetch}>
            <LineSeriesChart data={bookings.data?.series ?? []} xKey="period" series={[{ key: 'value', name: 'Bookings', color: colors[1] }]} />
          </ChartCard>
        </Grid>
      </Grid>
    </>
  );
}
