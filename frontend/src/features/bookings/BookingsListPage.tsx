// src/features/bookings/BookingsListPage.tsx
// Booking list: searchable, status-filterable, sortable, paginated (all server-side via
// useServerTable). Row click → detail. Visible to any admin with booking view/modify rights.

import { useState } from 'react';
import { Button, MenuItem, TextField } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { PageHeader, StatusChip } from '@/components/common';
import { DataTable, type Column } from '@/components/table/DataTable';
import { SearchFilterBar } from '@/components/table/SearchFilterBar';
import { useServerTable } from '@/hooks/useServerTable';
import { formatMoney, formatDateTime } from '@/utils/format';
import { paths } from '@/routes/paths';
import { useBookings } from './hooks';
import { CreateBookingDialog } from './CreateBookingDialog';
import type { BookingListItem, BookingStatus } from './types';

const STATUSES: BookingStatus[] = ['PENDING', 'CONFIRMED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export function BookingsListPage() {
  const navigate = useNavigate();
  const table = useServerTable({ filterKeys: ['status'] });
  const { data, isLoading, error, refetch, isFetching } = useBookings(table.apiParams);
  const [createOpen, setCreateOpen] = useState(false);

  const columns: Column<BookingListItem>[] = [
    { field: 'service_name', header: 'Service', render: (r) => r.service_name ?? '—' },
    { field: 'customer_name', header: 'Customer', render: (r) => r.customer_name ?? '—' },
    { field: 'scheduled_window_start', header: 'Scheduled', sortable: true, render: (r) => formatDateTime(r.scheduled_window_start) },
    { field: 'technician_name', header: 'Technician', render: (r) => r.technician_name ?? '— Unassigned' },
    { field: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
    { field: 'price', header: 'Amount', align: 'right', sortable: true, render: (r) => formatMoney(r.price, r.currency) },
  ];

  return (
    <>
      <PageHeader
        title="Bookings"
        subtitle="All service bookings across the platform"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            New Booking
          </Button>
        }
      />

      <SearchFilterBar
        search={table.search}
        onSearch={table.setSearch}
        placeholder="Search by customer, service…"
      >
        <TextField
          select size="small" label="Status" sx={{ minWidth: 160 }}
          value={table.filters.status ?? ''}
          onChange={(e) => table.setFilter('status', e.target.value || undefined)}
        >
          <MenuItem value="">All statuses</MenuItem>
          {STATUSES.map((s) => <MenuItem key={s} value={s}>{s.replace(/_/g, ' ')}</MenuItem>)}
        </TextField>
      </SearchFilterBar>

      <DataTable<BookingListItem>
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
        onRowClick={(r) => navigate(`${paths.bookings}/${r.id}`)}
        emptyMessage="No bookings match your filters"
      />

      <CreateBookingDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
