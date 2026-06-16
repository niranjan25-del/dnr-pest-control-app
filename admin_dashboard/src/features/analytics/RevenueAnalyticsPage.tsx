// src/features/analytics/RevenueAnalyticsPage.tsx
// Revenue over time (granularity-driven: daily/weekly/monthly), revenue by service (donut),
// and revenue by technician (bar, sourced from the technicians leaderboard).

import Grid from '@mui/material/Grid2';
import { KpiCard, ChartCard, LineSeriesChart, BarSeriesChart, PieBreakdownChart, useChartColors } from '@/components/charts';
import { formatMoney } from '@/utils/format';
import { useAnalyticsFilters } from './filters';
import { useRevenue, useTechnicianAnalytics } from './hooks';

export function RevenueAnalyticsPage() {
  const { filters } = useAnalyticsFilters();
  const colors = useChartColors();
  const revenue = useRevenue(filters);
  const techs = useTechnicianAnalytics(filters);

  const byTech = (techs.data?.leaderboard ?? [])
    .map((t) => ({ name: t.full_name, value: t.revenue_generated }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <KpiCard label="Total revenue" value={revenue.data ? formatMoney(revenue.data.total, revenue.data.currency) : '—'} loading={revenue.isLoading} helper="Selected range" />
      </Grid>

      <Grid size={12}>
        <ChartCard title={`Revenue (${filters.granularity.toLowerCase()})`} loading={revenue.isLoading} error={revenue.error} isEmpty={!revenue.data?.series.length} onRetry={revenue.refetch}>
          <LineSeriesChart data={revenue.data?.series ?? []} xKey="period" series={[{ key: 'value', name: 'Revenue', color: colors[0] }]} valueFormatter={(v) => formatMoney(v)} />
        </ChartCard>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <ChartCard title="Revenue by service" loading={revenue.isLoading} error={revenue.error} isEmpty={!revenue.data?.by_service.length} onRetry={revenue.refetch}>
          <PieBreakdownChart data={revenue.data?.by_service ?? []} nameKey="label" valueKey="value" colors={colors} />
        </ChartCard>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <ChartCard title="Revenue by technician (top 10)" loading={techs.isLoading} error={techs.error} isEmpty={!byTech.length} onRetry={techs.refetch}>
          <BarSeriesChart data={byTech} xKey="name" barKey="value" color={colors[2]} valueFormatter={(v) => formatMoney(v)} />
        </ChartCard>
      </Grid>
    </Grid>
  );
}
