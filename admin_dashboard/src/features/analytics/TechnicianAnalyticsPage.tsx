// src/features/analytics/TechnicianAnalyticsPage.tsx
// Technician performance: jobs completed, ratings, revenue generated, and performance
// rankings (sortable table). On-time % is null in the backend (flagged), so it's omitted.

import { useMemo, useState } from 'react';
import Grid from '@mui/material/Grid2';
import { ChartCard, BarSeriesChart, useChartColors } from '@/components/charts';
import { DataTable, type Column } from '@/components/table/DataTable';
import { formatMoney } from '@/utils/format';
import type { SortOrder } from '@/hooks/useServerTable';
import { useAnalyticsFilters } from './filters';
import { useTechnicianAnalytics } from './hooks';
import type { TechnicianLeaderRow } from './types';

export function TechnicianAnalyticsPage() {
  const { filters } = useAnalyticsFilters();
  const colors = useChartColors();
  const q = useTechnicianAnalytics(filters);
  const rows = q.data?.leaderboard ?? [];

  // Client-side sort/paginate over the leaderboard (already aggregated + bounded).
  const [sort, setSort] = useState<{ field: keyof TechnicianLeaderRow; order: SortOrder }>({ field: 'revenue_generated', order: 'desc' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const sorted = useMemo(() => {
    const s = [...rows].sort((a, b) => {
      const av = a[sort.field]; const bv = b[sort.field];
      if (typeof av === 'number' && typeof bv === 'number') return sort.order === 'asc' ? av - bv : bv - av;
      return sort.order === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return s;
  }, [rows, sort]);

  const paged = sorted.slice((page - 1) * limit, page * limit);
  const topRevenue = sorted.slice(0, 10).map((t) => ({ name: t.full_name, value: t.revenue_generated }));

  const columns: Column<TechnicianLeaderRow>[] = [
    { field: 'full_name', header: 'Technician', sortable: true },
    { field: 'jobs_completed', header: 'Jobs', align: 'right', sortable: true },
    { field: 'avg_rating', header: 'Rating', align: 'right', sortable: true, render: (r) => r.avg_rating.toFixed(2) },
    { field: 'revenue_generated', header: 'Revenue', align: 'right', sortable: true, render: (r) => formatMoney(r.revenue_generated) },
  ];

  const toggleSort = (field: string) =>
    setSort((s) => ({ field: field as keyof TechnicianLeaderRow, order: s.field === field && s.order === 'desc' ? 'asc' : 'desc' }));

  return (
    <Grid container spacing={2}>
      <Grid size={12}>
        <ChartCard title="Revenue generated (top 10)" loading={q.isLoading} error={q.error} isEmpty={!topRevenue.length} onRetry={q.refetch}>
          <BarSeriesChart data={topRevenue} xKey="name" barKey="value" color={colors[0]} valueFormatter={(v) => formatMoney(v)} />
        </ChartCard>
      </Grid>
      <Grid size={12}>
        <DataTable<TechnicianLeaderRow>
          columns={columns}
          rows={paged}
          total={rows.length}
          loading={q.isLoading}
          error={q.error}
          onRetry={q.refetch}
          page={page}
          limit={limit}
          sort={sort.field}
          order={sort.order}
          onSort={toggleSort}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
          getRowId={(r) => r.technician_id}
          emptyMessage="No technician data for this range"
        />
      </Grid>
    </Grid>
  );
}
