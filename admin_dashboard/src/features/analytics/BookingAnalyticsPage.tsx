// src/features/analytics/BookingAnalyticsPage.tsx
// Booking trends, cancellation trend, status breakdown, and service demand. Reschedule
// trend is shown as unavailable (backend marks rescheduled = null — flagged).

import { Alert } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { KpiCard, ChartCard, LineSeriesChart, PieBreakdownChart, useChartColors } from '@/components/charts';
import { useAnalyticsFilters } from './filters';
import { useBookingAnalytics } from './hooks';

export function BookingAnalyticsPage() {
  const { filters } = useAnalyticsFilters();
  const colors = useChartColors();
  const q = useBookingAnalytics(filters);
  const d = q.data;

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 6, md: 3 }}><KpiCard label="Total" value={d ? String(d.total) : '—'} loading={q.isLoading} /></Grid>
      <Grid size={{ xs: 6, md: 3 }}><KpiCard label="Completed" value={d ? String(d.completed) : '—'} loading={q.isLoading} /></Grid>
      <Grid size={{ xs: 6, md: 3 }}><KpiCard label="Cancelled" value={d ? String(d.cancelled) : '—'} loading={q.isLoading} /></Grid>
      <Grid size={{ xs: 6, md: 3 }}><KpiCard label="No-show" value={d ? String(d.no_show) : '—'} loading={q.isLoading} /></Grid>

      <Grid size={{ xs: 12, md: 8 }}>
        <ChartCard title="Booking trend" loading={q.isLoading} error={q.error} isEmpty={!d?.series.length} onRetry={q.refetch}>
          <LineSeriesChart data={d?.series ?? []} xKey="period" series={[{ key: 'value', name: 'Bookings', color: colors[0] }]} />
        </ChartCard>
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <ChartCard title="By status" loading={q.isLoading} error={q.error} isEmpty={!d?.by_status.length} onRetry={q.refetch}>
          <PieBreakdownChart data={d?.by_status ?? []} nameKey="label" valueKey="value" colors={colors} />
        </ChartCard>
      </Grid>

      <Grid size={{ xs: 12, md: 8 }}>
        <ChartCard title="Cancellation trend" loading={q.isLoading} error={q.error} isEmpty={!d?.cancellations.length} onRetry={q.refetch}>
          <LineSeriesChart data={d?.cancellations ?? []} xKey="period" series={[{ key: 'value', name: 'Cancellations', color: colors[5] }]} />
        </ChartCard>
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <Alert severity="info" sx={{ height: '100%' }}>
          Reschedule trend isn’t tracked as a distinct metric yet (the backend marks it null). Record booking
          reschedule events to enable this chart.
        </Alert>
      </Grid>
    </Grid>
  );
}
