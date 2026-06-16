// src/features/analytics/SubscriptionReviewPages.tsx
// Lighter analytics views: Subscriptions, Reviews, and Services breakdowns.

import { Alert, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { KpiCard, ChartCard, LineSeriesChart, useChartColors } from '@/components/charts';
import { formatMoney } from '@/utils/format';
import { useAnalyticsFilters } from './filters';
import { useSubscriptionAnalytics, useReviewAnalytics, useServicesAnalytics } from './hooks';

export function SubscriptionAnalyticsPage() {
  const { filters } = useAnalyticsFilters();
  const colors = useChartColors();
  const q = useSubscriptionAnalytics(filters);
  const d = q.data;

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}><KpiCard label="Active subscriptions" value={d ? String(d.active) : '—'} loading={q.isLoading} /></Grid>
      <Grid size={{ xs: 6, md: 4 }}><KpiCard label="Renewal rate" value={d ? `${d.renewal_rate_pct.toFixed(1)}%` : '—'} loading={q.isLoading} /></Grid>
      <Grid size={{ xs: 6, md: 4 }}><KpiCard label="Churn rate" value={d ? `${d.churn_rate_pct.toFixed(1)}%` : '—'} loading={q.isLoading} /></Grid>
      {d?.series && d.series.length > 0 && (
        <Grid size={12}>
          <ChartCard title="Active subscriptions over time" loading={q.isLoading} error={q.error} onRetry={q.refetch}>
            <LineSeriesChart data={d.series} xKey="period" series={[{ key: 'value', name: 'Active', color: colors[0] }]} />
          </ChartCard>
        </Grid>
      )}
      <Grid size={12}>
        <Alert severity="info">Churn & renewal are computed as proxies (no subscription state-transition history yet). Track status transitions for exact cohort rates.</Alert>
      </Grid>
    </Grid>
  );
}

export function ReviewAnalyticsPage() {
  const { filters } = useAnalyticsFilters();
  const colors = useChartColors();
  const q = useReviewAnalytics(filters);
  const d = q.data;

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <KpiCard label="Average rating" value={d ? `${d.average_rating.toFixed(2)} ★` : '—'} loading={q.isLoading} helper="Selected range" />
      </Grid>
      <Grid size={12}>
        <ChartCard title="Rating trend (customer satisfaction)" loading={q.isLoading} error={q.error} isEmpty={!d?.trend.length} onRetry={q.refetch} height={320}>
          <LineSeriesChart data={d?.trend ?? []} xKey="period" series={[{ key: 'value', name: 'Avg rating', color: colors[0] }]} valueFormatter={(v) => v.toFixed(2)} />
        </ChartCard>
      </Grid>
    </Grid>
  );
}

export function ServicesAnalyticsPage() {
  const { filters } = useAnalyticsFilters();
  const colors = useChartColors();
  const q = useServicesAnalytics(filters);
  const d = q.data;

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6 }}>
        <ChartCard title="Most booked services" loading={q.isLoading} error={q.error} isEmpty={!d?.most_popular.length} onRetry={q.refetch} height={300}>
          {d?.most_popular.map((item, i) => (
            <Grid container key={item.label} sx={{ mb: 0.5 }} alignItems="center">
              <Grid size={6}><Typography variant="body2" noWrap>{item.label}</Typography></Grid>
              <Grid size={2}><Typography variant="body2" align="right">{item.value}</Typography></Grid>
              <Grid size={4}>
                <div style={{ height: 8, borderRadius: 4, backgroundColor: colors[i % colors.length], width: `${Math.min(100, (item.value / (d.most_popular[0]?.value || 1)) * 100)}%` }} />
              </Grid>
            </Grid>
          ))}
        </ChartCard>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <ChartCard title="Revenue by service" loading={q.isLoading} error={q.error} isEmpty={!d?.revenue_by_service.length} onRetry={q.refetch} height={300}>
          {d?.revenue_by_service.map((item, i) => (
            <Grid container key={item.label} sx={{ mb: 0.5 }} alignItems="center">
              <Grid size={5}><Typography variant="body2" noWrap>{item.label}</Typography></Grid>
              <Grid size={3}><Typography variant="body2" align="right">{formatMoney(item.value)}</Typography></Grid>
              <Grid size={4}>
                <div style={{ height: 8, borderRadius: 4, backgroundColor: colors[i % colors.length], width: `${Math.min(100, (item.value / (d.revenue_by_service[0]?.value || 1)) * 100)}%` }} />
              </Grid>
            </Grid>
          ))}
        </ChartCard>
      </Grid>
      {d?.growth && d.growth.length > 0 && (
        <Grid size={12}>
          <ChartCard title="Booking growth by service" loading={q.isLoading} error={q.error} onRetry={q.refetch}>
            <LineSeriesChart data={d.growth} xKey="period" series={[{ key: 'value', name: 'Bookings', color: colors[0] }]} />
          </ChartCard>
        </Grid>
      )}
    </Grid>
  );
}
