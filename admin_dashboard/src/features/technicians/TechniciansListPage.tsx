// src/features/technicians/TechniciansListPage.tsx
// Technician directory: search + status + availability filters, sortable, paginated. Row →
// technician detail.

import { Chip, MenuItem, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PageHeader, StatusChip } from '@/components/common';
import { DataTable, type Column } from '@/components/table/DataTable';
import { SearchFilterBar } from '@/components/table/SearchFilterBar';
import { useServerTable } from '@/hooks/useServerTable';
import { paths } from '@/routes/paths';
import { useTechnicians } from './hooks';
import type { TechnicianRow } from './types';

export function TechniciansListPage() {
  const navigate = useNavigate();
  const table = useServerTable({ filterKeys: ['status'] });
  const { data, isLoading, isFetching, error, refetch } = useTechnicians(table.apiParams);

  const columns: Column<TechnicianRow>[] = [
    { field: 'full_name', header: 'Name', sortable: true, render: (r) => r.full_name ?? '—' },
    { field: 'email', header: 'Email', render: (r) => r.email ?? '—' },
    { field: 'phone', header: 'Phone', render: (r) => r.phone ?? '—' },
    {
      field: 'is_available', header: 'Availability',
      render: (r) => <Chip size="small" variant="outlined" color={r.is_available ? 'success' : 'default'} label={r.is_available ? 'Available' : 'Off'} />,
    },
    { field: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
  ];

  return (
    <>
      <PageHeader title="Technicians" subtitle="Field technician accounts" />
      <SearchFilterBar search={table.search} onSearch={table.setSearch} placeholder="Search name, email, phone…">
        <TextField select size="small" label="Status" sx={{ minWidth: 160 }} value={table.filters.status ?? ''} onChange={(e) => table.setFilter('status', e.target.value || undefined)}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="ACTIVE">Active</MenuItem>
          <MenuItem value="SUSPENDED">Suspended</MenuItem>
          <MenuItem value="DEACTIVATED">Deactivated</MenuItem>
        </TextField>
      </SearchFilterBar>
      <DataTable<TechnicianRow>
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
        onRowClick={(r) => navigate(`${paths.technicians}/${r.id}`)}
        emptyMessage="No technicians found"
      />
    </>
  );
}
