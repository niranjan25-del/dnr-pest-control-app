// src/features/analytics/CustomerAnalyticsPage.tsx
// New vs active customers, retention %, lifetime value (if provided), and a new-customer
// acquisition trend.

import Grid from '@mui/material/Grid2';
import { KpiCard, ChartCard, BarSeriesChart, useChartColors } from '@/components/charts';
import { formatMoney } from '@/utils/format';
import { useAnalyticsFilters } from './filters';
import { useCustomerAnalytics } from './hooks';

export function CustomerAnalyticsPage() {
  const { filters } = useAnalyticsFilters();
  const colors = useChartColors();
  const q = useCustomerAnalytics(filters);
  const d = q.data;

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 6, md: 3 }}><KpiCard label="New customers" value={d ? String(d.new_customers) : '—'} loading={q.isLoading} /></Grid>
      <Grid size={{ xs: 6, md: 3 }}><KpiCard label="Active customers" value={d ? String(d.active_customers) : '—'} loading={q.isLoading} /></Grid>
      <Grid size={{ xs: 6, md: 3 }}><KpiCard label="Retention" value={d ? `${d.retention_pct.toFixed(1)}%` : '—'} loading={q.isLoading} /></Grid>
      <Grid size={{ xs: 6, md: 3 }}><KpiCard label="Lifetime value" value={d?.lifetime_value != null ? formatMoney(d.lifetime_value) : 'N/A'} loading={q.isLoading} helper={d?.lifetime_value == null ? 'Not provided' : undefined} /></Grid>

      <Grid size={12}>
        <ChartCard title="New customers over time" loading={q.isLoading} error={q.error} isEmpty={!d?.series.length} onRetry={q.refetch}>
          <BarSeriesChart data={d?.series ?? []} xKey="period" barKey="value" color={colors[0]} />
        </ChartCard>
      </Grid>
    </Grid>
  );
}
