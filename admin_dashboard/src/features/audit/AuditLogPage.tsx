// src/features/audit/AuditLogPage.tsx
// Append-only audit trail: who did what, when. Filter by entity type or action prefix.

import { MenuItem, TextField, Tooltip, Typography } from '@mui/material';
import { PageHeader } from '@/components/common';
import { DataTable, type Column } from '@/components/table/DataTable';
import { SearchFilterBar } from '@/components/table/SearchFilterBar';
import { useServerTable } from '@/hooks/useServerTable';
import { useQuery } from '@tanstack/react-query';
import { auditApi, type AuditLogRow } from './api';

const ENTITY_TYPES = [
  'booking', 'payment', 'invoice', 'subscription', 'technician_assignment',
  'review', 'user', 'analytics', 'coupon',
];

export function AuditLogPage() {
  const table = useServerTable({ filterKeys: ['entityType', 'action'] });

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['audit', 'list', table.apiParams],
    queryFn: () => auditApi.list({ ...table.apiParams, entityType: table.filters.entityType, action: table.filters.action }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<AuditLogRow>[] = [
    {
      field: 'created_at',
      header: 'Time',
      render: (r) =>
        new Date(r.created_at).toLocaleString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: true,
        }),
    },
    { field: 'actor_name', header: 'Actor', render: (r) => r.actor_name ?? r.actor_email ?? 'System' },
    { field: 'action', header: 'Action', render: (r) => <code>{r.action}</code> },
    { field: 'entity_type', header: 'Entity type' },
    { field: 'entity_id', header: 'Entity ID', render: (r) => r.entity_id ? (
      <Tooltip title={r.entity_id}><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{r.entity_id.slice(0, 8)}…</Typography></Tooltip>
    ) : '—' },
    { field: 'ip_address', header: 'IP', render: (r) => r.ip_address ?? '—' },
  ];

  return (
    <>
      <PageHeader title="Audit Log" subtitle="Immutable activity trail" />
      <SearchFilterBar search={table.search} onSearch={table.setSearch} placeholder="Search actions…">
        <TextField
          select size="small" label="Entity type" sx={{ minWidth: 180 }}
          value={table.filters.entityType ?? ''}
          onChange={(e) => table.setFilter('entityType', e.target.value || undefined)}
        >
          <MenuItem value="">All</MenuItem>
          {ENTITY_TYPES.map((t) => <MenuItem key={t} value={t}>{t.replace('_', ' ')}</MenuItem>)}
        </TextField>
      </SearchFilterBar>
      <DataTable<AuditLogRow>
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
        emptyMessage="No audit log entries"
      />
    </>
  );
}
