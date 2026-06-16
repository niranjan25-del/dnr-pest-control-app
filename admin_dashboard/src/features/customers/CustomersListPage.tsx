// src/features/customers/CustomersListPage.tsx
// Customer directory: search + status filter + sort + pagination. Row → customer detail.

import { MenuItem, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PageHeader, StatusChip } from '@/components/common';
import { DataTable, type Column } from '@/components/table/DataTable';
import { SearchFilterBar } from '@/components/table/SearchFilterBar';
import { useServerTable } from '@/hooks/useServerTable';
import { formatDateTime } from '@/utils/format';
import { paths } from '@/routes/paths';
import { useCustomers } from './hooks';
import type { UserRow } from './types';

export function CustomersListPage() {
  const navigate = useNavigate();
  const table = useServerTable({ filterKeys: ['status'] });
  const { data, isLoading, isFetching, error, refetch } = useCustomers(table.apiParams);

  const columns: Column<UserRow>[] = [
    { field: 'full_name', header: 'Name', sortable: true, render: (r) => r.full_name ?? '—' },
    { field: 'email', header: 'Email', render: (r) => r.email ?? '—' },
    { field: 'phone', header: 'Phone', render: (r) => r.phone ?? '—' },
    { field: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
    { field: 'created_at', header: 'Joined', sortable: true, render: (r) => formatDateTime(r.created_at, 'dd MMM yyyy') },
  ];

  return (
    <>
      <PageHeader title="Customers" subtitle="Customer accounts" />
      <SearchFilterBar search={table.search} onSearch={table.setSearch} placeholder="Search name, email, phone…">
        <TextField select size="small" label="Status" sx={{ minWidth: 160 }} value={table.filters.status ?? ''} onChange={(e) => table.setFilter('status', e.target.value || undefined)}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="ACTIVE">Active</MenuItem>
          <MenuItem value="SUSPENDED">Suspended</MenuItem>
          <MenuItem value="DEACTIVATED">Deactivated</MenuItem>
        </TextField>
      </SearchFilterBar>
      <DataTable<UserRow>
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
        onRowClick={(r) => navigate(`${paths.customers}/${r.id}`)}
        emptyMessage="No customers found"
      />
    </>
  );
}
