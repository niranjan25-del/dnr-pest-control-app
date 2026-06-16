// src/features/services/ServicesListPage.tsx
// Catalog: services directory with search + active filter + CRUD via the form dialog.

import { useState } from 'react';
import { Button, Chip, MenuItem, TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Can, PageHeader } from '@/components/common';
import { DataTable, type Column } from '@/components/table/DataTable';
import { SearchFilterBar } from '@/components/table/SearchFilterBar';
import { useServerTable } from '@/hooks/useServerTable';
import { Permission } from '@/features/auth/permissions';
import { useServices } from './hooks';
import { ServiceFormDialog } from './ServiceFormDialog';
import type { ServiceRow } from './types';

export function ServicesListPage() {
  const table = useServerTable({ filterKeys: ['is_active'] });
  const { data, isLoading, isFetching, error, refetch } = useServices(table.apiParams);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [open, setOpen] = useState(false);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (row: ServiceRow) => { setEditing(row); setOpen(true); };

  const columns: Column<ServiceRow>[] = [
    { field: 'name', header: 'Service', sortable: true },
    { field: 'base_price', header: 'Base price', align: 'right', render: (r) => `₹${r.base_price}` },
    { field: 'duration_minutes', header: 'Duration', render: (r) => (r.duration_minutes ? `${r.duration_minutes} min` : '—') },
    { field: 'is_active', header: 'Status', render: (r) => <Chip size="small" label={r.is_active ? 'Active' : 'Inactive'} color={r.is_active ? 'success' : 'default'} /> },
  ];

  return (
    <>
      <PageHeader
        title="Services" subtitle="Service catalog"
        actions={<Can permission={Permission.ManageCatalog}><Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>New service</Button></Can>}
      />
      <SearchFilterBar search={table.search} onSearch={table.setSearch} placeholder="Search services…">
        <TextField select size="small" label="Status" sx={{ minWidth: 140 }} value={table.filters.is_active ?? ''} onChange={(e) => table.setFilter('is_active', e.target.value || undefined)}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="true">Active</MenuItem>
          <MenuItem value="false">Inactive</MenuItem>
        </TextField>
      </SearchFilterBar>
      <DataTable<ServiceRow>
        columns={columns} rows={data?.data ?? []} total={data?.meta.total ?? 0}
        loading={isLoading || isFetching} error={error} onRetry={refetch}
        page={table.page} limit={table.limit} sort={table.sort} order={table.order}
        onSort={table.setSort} onPageChange={table.setPage} onLimitChange={table.setLimit}
        getRowId={(r) => r.id} onRowClick={openEdit} emptyMessage="No services found"
      />
      <ServiceFormDialog open={open} onClose={() => setOpen(false)} existing={editing} />
    </>
  );
}
