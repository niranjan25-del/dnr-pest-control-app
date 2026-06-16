// src/features/reports/ReportsPage.tsx
// Report catalog: pick a report type + range, then export CSV or PDF (server-rendered via
// /analytics/export). Gated by the ComplianceExport permission. The shared analytics filter
// bar supplies the date range / granularity.

import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import DescriptionIcon from '@mui/icons-material/Description';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import GridOnIcon from '@mui/icons-material/GridOn';
import { PageHeader } from '@/components/common';
import { AnalyticsFiltersBar, useAnalyticsFilters } from '@/features/analytics/filters';
import { downloadServerExport } from '@/features/exports/exportService';
import type { ExportFormat, ReportType } from '@/features/analytics/types';

const REPORTS: { type: ReportType; title: string; description: string }[] = [
  { type: 'REVENUE', title: 'Revenue report', description: 'Revenue totals + time series and breakdown by service.' },
  { type: 'BOOKINGS', title: 'Booking report', description: 'Booking volumes, completion, cancellations by period.' },
  { type: 'TECHNICIANS', title: 'Technician report', description: 'Jobs, ratings, and revenue generated per technician.' },
  { type: 'CUSTOMERS', title: 'Customer report', description: 'New/active customers and retention over the range.' },
  { type: 'SUBSCRIPTIONS', title: 'Subscription report', description: 'Active subscriptions, churn and renewal proxies.' },
];

export function ReportsPage() {
  const { filters } = useAnalyticsFilters();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (type: ReportType, format: ExportFormat) => {
    setBusy(`${type}-${format}`);
    setError(null);
    try {
      await downloadServerExport(type, format, filters);
    } catch {
      setError('Export failed. Please try again or narrow the date range.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Reports" subtitle="Generate and export operational reports" />
      <AnalyticsFiltersBar />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2}>
        {REPORTS.map((r) => (
          <Grid key={r.type} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <DescriptionIcon color="primary" />
                  <Typography variant="h4">{r.title}</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>{r.description}</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" variant="outlined" startIcon={<GridOnIcon />} disabled={busy === `${r.type}-CSV`} onClick={() => run(r.type, 'CSV')}>
                    {busy === `${r.type}-CSV` ? 'Exporting…' : 'CSV'}
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<GridOnIcon />} disabled={busy === `${r.type}-EXCEL`} onClick={() => run(r.type, 'EXCEL')}>
                    {busy === `${r.type}-EXCEL` ? 'Exporting…' : 'Excel'}
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<PictureAsPdfIcon />} disabled={busy === `${r.type}-PDF`} onClick={() => run(r.type, 'PDF')}>
                    {busy === `${r.type}-PDF` ? 'Exporting…' : 'PDF'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
