// src/features/coupons/CouponsListPage.tsx
// Coupon campaigns: search, create/edit, usage tracking (redeemed vs cap), activate/deactivate.

import { useState } from 'react';
import { Button, Chip, Switch, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Can, PageHeader } from '@/components/common';
import { DataTable, type Column } from '@/components/table/DataTable';
import { SearchFilterBar } from '@/components/table/SearchFilterBar';
import { useServerTable } from '@/hooks/useServerTable';
import { Permission } from '@/features/auth/permissions';
import { ApiError } from '@/types';
import { useToast } from '@/providers/ToastProvider';
import { useCoupons, useToggleCoupon } from './hooks';
import { CouponFormDialog } from './CouponFormDialog';
import type { CouponRow } from './types';

const statusColor = (s?: string): 'success' | 'warning' | 'default' | 'error' => {
  switch (s) { case 'ACTIVE': return 'success'; case 'SCHEDULED': return 'warning'; case 'EXPIRED': case 'EXHAUSTED': return 'error'; default: return 'default'; }
};

export function CouponsListPage() {
  const table = useServerTable();
  const { data, isLoading, isFetching, error, refetch } = useCoupons(table.apiParams);
  const toggle = useToggleCoupon();
  const toast = useToast();
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [open, setOpen] = useState(false);

  const onToggle = (row: CouponRow) =>
    toggle.mutate({ id: row.id, active: !row.is_active }, {
      onSuccess: () => toast.success(row.is_active ? 'Coupon deactivated' : 'Coupon activated'),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update coupon'),
    });

  const columns: Column<CouponRow>[] = [
    { field: 'code', header: 'Code', sortable: true, render: (r) => <strong>{r.code}</strong> },
    { field: 'discount', header: 'Discount', render: (r) => (r.discount_type === 'PERCENTAGE' ? `${r.discount_value}%` : `₹${r.discount_value}`) },
    { field: 'usage', header: 'Usage', render: (r) => `${r.times_redeemed}${r.max_redemptions ? ` / ${r.max_redemptions}` : ''}` },
    { field: 'valid_until', header: 'Expires', render: (r) => (r.valid_until ? r.valid_until.slice(0, 10) : '—') },
    { field: 'status', header: 'Status', render: (r) => <Chip size="small" label={r.status ?? (r.is_active ? 'Active' : 'Inactive')} color={statusColor(r.status ?? (r.is_active ? 'ACTIVE' : undefined))} /> },
    {
      field: 'active', header: 'Enabled', align: 'center',
      render: (r) => (
        <Can permission={Permission.ManageCoupons} fallback={<Chip size="small" label={r.is_active ? 'On' : 'Off'} />}>
          <Tooltip title={r.is_active ? 'Deactivate' : 'Activate'}>
            <Switch checked={r.is_active} onChange={() => onToggle(r)} onClick={(e) => e.stopPropagation()} size="small" />
          </Tooltip>
        </Can>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Coupons" subtitle="Promotional campaigns"
        actions={<Can permission={Permission.ManageCoupons}><Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setOpen(true); }}>New coupon</Button></Can>}
      />
      <SearchFilterBar search={table.search} onSearch={table.setSearch} placeholder="Search code…" />
      <DataTable<CouponRow>
        columns={columns} rows={data?.data ?? []} total={data?.meta.total ?? 0}
        loading={isLoading || isFetching} error={error} onRetry={refetch}
        page={table.page} limit={table.limit} sort={table.sort} order={table.order}
        onSort={table.setSort} onPageChange={table.setPage} onLimitChange={table.setLimit}
        getRowId={(r) => r.id} onRowClick={(r) => { setEditing(r); setOpen(true); }} emptyMessage="No coupons yet"
      />
      <CouponFormDialog open={open} onClose={() => setOpen(false)} existing={editing} />
    </>
  );
}
