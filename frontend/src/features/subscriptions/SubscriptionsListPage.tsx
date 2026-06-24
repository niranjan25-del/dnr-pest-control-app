// src/features/subscriptions/SubscriptionsListPage.tsx
// Subscription oversight: status filter + per-row pause / resume / cancel (confirmed).

import { Button, Chip, MenuItem, Stack, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import LayersIcon from '@mui/icons-material/Layers';
import { Can, PageHeader, useConfirm } from '@/components/common';
import { DataTable, type Column } from '@/components/table/DataTable';
import { SearchFilterBar } from '@/components/table/SearchFilterBar';
import { useServerTable } from '@/hooks/useServerTable';
import { Permission } from '@/features/auth/permissions';
import { ApiError } from '@/types';
import { useToast } from '@/providers/ToastProvider';
import { useSubscriptions, useSubscriptionAction } from './hooks';
import type { SubscriptionRow, SubscriptionStatus } from './types';
import { paths } from '@/routes/paths';

const statusColor = (s: SubscriptionStatus): 'success' | 'warning' | 'default' | 'error' =>
  s === 'ACTIVE' ? 'success' : s === 'PAUSED' ? 'warning' : s === 'CANCELLED' || s === 'EXPIRED' ? 'error' : 'default';

export function SubscriptionsListPage() {
  const navigate = useNavigate();
  const table = useServerTable({ filterKeys: ['status'] });
  const { data, isLoading, isFetching, error, refetch } = useSubscriptions(table.apiParams);
  const action = useSubscriptionAction();
  const confirm = useConfirm();
  const toast = useToast();

  const run = async (row: SubscriptionRow, act: 'pause' | 'resume' | 'cancel') => {
    if (act === 'cancel') {
      const ok = await confirm({ title: 'Cancel subscription?', message: 'Recurring visits will stop. This cannot be undone.', confirmText: 'Cancel subscription', destructive: true });
      if (!ok) return;
    }
    action.mutate({ id: row.id, action: act }, {
      onSuccess: () => toast.success(`Subscription ${act === 'pause' ? 'paused' : act === 'resume' ? 'resumed' : 'cancelled'}`),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Action failed'),
    });
  };

  const columns: Column<SubscriptionRow>[] = [
    { field: 'customer_name', header: 'Customer', render: (r) => r.customer_name ?? '—' },
    { field: 'plan_name', header: 'Plan', render: (r) => r.plan_name ?? '—' },
    { field: 'billing_cycle', header: 'Cycle', render: (r) => r.billing_cycle?.toLowerCase() ?? '—' },
    { field: 'price', header: 'Price', align: 'right', render: (r) => (r.price != null ? `₹${r.price}` : '—') },
    { field: 'next_billing_date', header: 'Next billing', render: (r) => (r.next_billing_date ? r.next_billing_date.slice(0, 10) : '—') },
    { field: 'status', header: 'Status', render: (r) => <Chip size="small" label={r.status} color={statusColor(r.status)} /> },
    {
      field: 'actions', header: 'Actions', align: 'right',
      render: (r) => (
        <Can permission={Permission.ManageCustomers}>
          <Stack direction="row" spacing={1} justifyContent="flex-end" onClick={(e) => e.stopPropagation()}>
            {r.status === 'ACTIVE' && <Button size="small" onClick={() => run(r, 'pause')}>Pause</Button>}
            {r.status === 'PAUSED' && <Button size="small" onClick={() => run(r, 'resume')}>Resume</Button>}
            {(r.status === 'ACTIVE' || r.status === 'PAUSED') && <Button size="small" color="error" onClick={() => run(r, 'cancel')}>Cancel</Button>}
          </Stack>
        </Can>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Subscriptions"
        subtitle="Recurring service plans"
        actions={
          <Can permission={Permission.ManagePricing}>
            <Button
              variant="outlined"
              startIcon={<LayersIcon />}
              onClick={() => navigate(paths.plans)}
              size="small"
            >
              Manage plans
            </Button>
          </Can>
        }
      />
      <SearchFilterBar search={table.search} onSearch={table.setSearch} placeholder="Search customer…">
        <TextField select size="small" label="Status" sx={{ minWidth: 150 }} value={table.filters.status ?? ''} onChange={(e) => table.setFilter('status', e.target.value || undefined)}>
          <MenuItem value="">All</MenuItem>
          {['ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED', 'PENDING'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
      </SearchFilterBar>
      <DataTable<SubscriptionRow>
        columns={columns} rows={data?.data ?? []} total={data?.meta.total ?? 0}
        loading={isLoading || isFetching} error={error} onRetry={refetch}
        page={table.page} limit={table.limit} sort={table.sort} order={table.order}
        onSort={table.setSort} onPageChange={table.setPage} onLimitChange={table.setLimit}
        getRowId={(r) => r.id} emptyMessage="No subscriptions found"
      />
    </>
  );
}
