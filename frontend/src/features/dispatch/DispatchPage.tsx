// src/features/dispatch/DispatchPage.tsx
// Dispatch board: shows PENDING bookings with no active assignment. Admins can assign
// a technician via the shared AssignTechnicianDialog (fetches ranked candidates).

import { useState } from 'react';
import { Box, Button, Card, CardContent, Chip, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import RouteIcon from '@mui/icons-material/AltRoute';
import { PageHeader } from '@/components/common';
import { DataTable, type Column } from '@/components/table/DataTable';
import { useServerTable } from '@/hooks/useServerTable';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AssignTechnicianDialog } from '@/features/bookings/AssignTechnicianDialog';
import { dispatchApi, type UnassignedBooking, type TechnicianWorkload } from './api';

const MAX_DAILY_JOBS = 6;

function WorkloadBar({ tech }: { tech: TechnicianWorkload }) {
  const pct = Math.min(100, (tech.dailyActive / MAX_DAILY_JOBS) * 100);
  const color = pct >= 80 ? 'error' : pct >= 50 ? 'warning' : 'success';
  return (
    <Card variant="outlined" sx={{ minWidth: 150 }}>
      <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
        <Tooltip title={`${tech.dailyActive} active today · ${tech.dailyCapacityRemaining} remaining`}>
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="caption" noWrap sx={{ maxWidth: 120 }}>{tech.name ?? 'Tech'}</Typography>
              <Chip
                size="small" label={tech.isAvailable ? 'On' : 'Off'}
                color={tech.isAvailable ? 'success' : 'default'} sx={{ height: 16, fontSize: 10 }}
              />
            </Stack>
            <LinearProgress variant="determinate" value={pct} color={color} sx={{ borderRadius: 1, height: 6 }} />
            <Typography variant="caption" color="text.secondary">{tech.dailyActive}/{MAX_DAILY_JOBS} today</Typography>
          </Box>
        </Tooltip>
      </CardContent>
    </Card>
  );
}

function WorkloadSummary() {
  const { data } = useQuery({
    queryKey: ['dispatch', 'workloads'],
    queryFn: () => dispatchApi.workloads(),
    staleTime: 30_000,
  });

  if (!data || data.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Technician capacity today</Typography>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
        {data.map((t) => <WorkloadBar key={t.technicianId} tech={t} />)}
      </Stack>
    </Box>
  );
}

function fmtWindow(start: string | null, _end: string | null): string {
  if (!start) return '—';
  const d = new Date(start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const t = new Date(start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${d} ${t}`;
}

export function DispatchPage() {
  const table = useServerTable({});
  const qc = useQueryClient();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['dispatch', 'unassigned', table.apiParams],
    queryFn: () => dispatchApi.unassigned(table.apiParams),
    placeholderData: (prev) => prev,
  });

  const [assignBookingId, setAssignBookingId] = useState<string | null>(null);

  const handleAssigned = () => {
    setAssignBookingId(null);
    qc.invalidateQueries({ queryKey: ['dispatch'] });
  };

  const columns: Column<UnassignedBooking>[] = [
    {
      field: 'service',
      header: 'Service',
      render: (r) => r.service?.name ?? '—',
    },
    {
      field: 'customer',
      header: 'Customer',
      render: (r) => r.customer?.user?.fullName ?? '—',
    },
    {
      field: 'scheduledWindowStart',
      header: 'Scheduled',
      render: (r) => fmtWindow(r.scheduledWindowStart, r.scheduledWindowEnd),
    },
    {
      field: 'address',
      header: 'Area',
      render: (r) => [r.address?.city, r.address?.postalCode].filter(Boolean).join(', ') || '—',
    },
    {
      field: 'status',
      header: 'Status',
      render: (r) => <Chip size="small" label={r.status} color="warning" />,
    },
    {
      field: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <Button
          size="small"
          variant="contained"
          onClick={(e) => { e.stopPropagation(); setAssignBookingId(r.id); }}
        >
          Assign
        </Button>
      ),
    },
  ];

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  return (
    <>
      <PageHeader
        title="Dispatch"
        subtitle={
          <Stack direction="row" spacing={1} alignItems="center">
            <RouteIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              {total} unassigned {total === 1 ? 'booking' : 'bookings'}
            </Typography>
          </Stack>
        }
      />
      <WorkloadSummary />
      <DataTable<UnassignedBooking>
        columns={columns}
        rows={rows}
        total={total}
        loading={isLoading || isFetching}
        error={error}
        onRetry={refetch}
        page={table.page}
        limit={table.limit}
        sort={table.sort}
        order={table.order}
        onSort={table.setSort}
        onPageChange={table.setPage}
        onLimitChange={table.setLimit}
        getRowId={(r) => r.id}
        emptyMessage="No unassigned bookings — all caught up!"
      />
      {assignBookingId && (
        <AssignTechnicianDialog
          bookingId={assignBookingId}
          open={Boolean(assignBookingId)}
          mode="assign"
          onClose={handleAssigned}
        />
      )}
    </>
  );
}
