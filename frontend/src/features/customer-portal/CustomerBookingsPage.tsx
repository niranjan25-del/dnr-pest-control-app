import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, Chip, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { DataTable, type Column } from '@/components/table/DataTable';
import { useServerTable } from '@/hooks/useServerTable';
import { formatDateTime, formatMoney } from '@/utils/format';
import { StatusChip } from '@/components/common';
import { paths } from '@/routes/paths';
import { useMyBookings } from './hooks';
import type { CustomerBooking } from './types';

const BOOKING_STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function CustomerBookingsPage() {
  const navigate = useNavigate();
  const table = useServerTable({ defaultLimit: 10, filterKeys: ['status'] });
  const { data, isLoading, isFetching, error, refetch } = useMyBookings(table.apiParams);

  const columns: Column<CustomerBooking>[] = [
    {
      field: 'booking_number', header: 'Booking #',
      render: (r) => (
        <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace', letterSpacing: 0.5 }}>
          {r.booking_number ?? r.id.slice(0, 8).toUpperCase()}
        </Typography>
      ),
    },
    { field: 'service_name', header: 'Service', render: (r) => r.service_name ?? '—' },
    {
      field: 'scheduled_window_start', header: 'Date', sortable: true,
      render: (r) => r.scheduled_window_start ? formatDateTime(r.scheduled_window_start, 'dd MMM yyyy, HH:mm') : '—',
    },
    {
      field: 'address_line', header: 'Address',
      render: (r) => (
        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 220 }}>
          {r.address_line ?? '—'}
        </Typography>
      ),
    },
    {
      field: 'technician_name', header: 'Technician',
      render: (r) => r.technician_name
        ? <Typography variant="body2" fontWeight={500}>{r.technician_name}</Typography>
        : <Typography variant="body2" color="text.disabled">Not assigned</Typography>,
    },
    { field: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
    { field: 'price', header: 'Amount', align: 'right', render: (r) => formatMoney(r.price, r.currency) },
  ];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>My Bookings</Typography>
          <Typography variant="body2" color="text.secondary">
            {data?.meta.total ?? 0} booking{(data?.meta.total ?? 0) !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <TextField
            select size="small" label="Status" sx={{ minWidth: 160 }}
            value={table.filters.status ?? ''}
            onChange={(e) => table.setFilter('status', e.target.value || undefined)}
          >
            {BOOKING_STATUSES.map((s) => (
              <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate(paths.customerBook)}
            sx={{ bgcolor: '#1565C0', whiteSpace: 'nowrap' }}
          >
            Book a Service
          </Button>
        </Stack>
      </Stack>

      <Card>
        <DataTable<CustomerBooking>
          columns={columns}
          rows={data?.data ?? []}
          total={data?.meta.total ?? 0}
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
          emptyMessage="No bookings yet"
          onRowClick={(r) => navigate(paths.customerBookingDetail.replace(':id', r.id))}
        />
      </Card>

      {/* Status legend */}
      <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap">
        {[
          { label: 'Pending', color: '#FF9800' },
          { label: 'Confirmed', color: '#2196F3' },
          { label: 'In progress', color: '#1E8E5A' },
          { label: 'Completed', color: '#4CAF50' },
          { label: 'Cancelled', color: '#F44336' },
        ].map((s) => (
          <Chip
            key={s.label} size="small" label={s.label}
            sx={{ bgcolor: `${s.color}14`, color: s.color, borderColor: `${s.color}40`, fontSize: 11 }}
            variant="outlined"
          />
        ))}
      </Stack>
    </Box>
  );
}
