// src/features/customers/CustomerDetailPage.tsx
// Customer detail with tabs: Profile (+ account status actions), Booking history, Payment
// history. Status changes (suspend/activate) are gated by SuspendUsers and confirmed.

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Button, Card, CardContent, Stack, Tab, Tabs, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { PageHeader, StatusChip, Can, useConfirm } from '@/components/common';
import { LoadingScreen, ErrorState } from '@/components/feedback';
import { DataTable, type Column } from '@/components/table/DataTable';
import { useServerTable } from '@/hooks/useServerTable';
import { Permission } from '@/features/auth/permissions';
import { formatDateTime, formatMoney } from '@/utils/format';
import { paths } from '@/routes/paths';
import { useCustomerProfile, useCustomerBookings, useCustomerInvoices, useSetCustomerStatus } from './hooks';
import type { InvoiceRow } from './types';
import type { BookingListItem } from '@/features/bookings/types';

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2">{value || '—'}</Typography>
    </Box>
  );
}

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const confirm = useConfirm();
  const [tab, setTab] = useState(0);

  const { data: profile, isLoading, error, refetch } = useCustomerProfile(id);
  const setStatus = useSetCustomerStatus();

  if (isLoading) return <LoadingScreen />;
  if (error || !profile) return <ErrorState error={error} onRetry={refetch} />;

  const userId = profile.user_id ?? profile.id;
  const isActive = (profile.status ?? 'ACTIVE') === 'ACTIVE';

  const toggleStatus = async () => {
    const next = isActive ? 'SUSPENDED' : 'ACTIVE';
    const ok = await confirm({
      title: isActive ? 'Suspend customer?' : 'Reactivate customer?',
      message: isActive ? 'Suspending blocks sign-in and revokes active sessions.' : 'Reactivating restores account access.',
      confirmText: isActive ? 'Suspend' : 'Reactivate',
      destructive: isActive,
    });
    if (ok) await setStatus.mutateAsync({ userId, status: next });
  };

  return (
    <>
      <PageHeader
        title={profile.full_name ?? 'Customer'}
        crumbs={[{ label: 'Customers', to: paths.customers }, { label: 'Detail' }]}
        actions={
          <Can permission={Permission.SuspendUsers}>
            <Button
              variant="outlined"
              color={isActive ? 'error' : 'success'}
              startIcon={isActive ? <BlockIcon /> : <CheckCircleIcon />}
              onClick={toggleStatus}
              disabled={setStatus.isPending}
            >
              {isActive ? 'Suspend' : 'Reactivate'}
            </Button>
          </Can>
        }
      />

      <Card sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Profile" />
          <Tab label="Bookings" />
          <Tab label="Payments" />
        </Tabs>
        <CardContent>
          {tab === 0 && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <StatusChip status={profile.status ?? 'ACTIVE'} />
                </Stack>
                <Field label="Email" value={profile.email} />
                <Field label="Phone" value={profile.phone} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="Customer type" value={profile.customer_type ?? 'Residential'} />
                <Field label="Company" value={profile.company_name} />
                <Field label="Joined" value={formatDateTime(profile.created_at, 'dd MMM yyyy')} />
              </Grid>
            </Grid>
          )}
          {tab === 1 && <CustomerBookingsTab customerId={id} />}
          {tab === 2 && <CustomerPaymentsTab customerId={id} />}
        </CardContent>
      </Card>
    </>
  );
}

function CustomerBookingsTab({ customerId }: { customerId: string }) {
  const table = useServerTable({ defaultLimit: 10 });
  const { data, isLoading, isFetching, error, refetch } = useCustomerBookings(customerId, table.apiParams);
  const columns: Column<BookingListItem>[] = [
    { field: 'service_name', header: 'Service', render: (r) => r.service_name ?? '—' },
    { field: 'scheduled_window_start', header: 'Scheduled', render: (r) => formatDateTime(r.scheduled_window_start) },
    { field: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
    { field: 'price', header: 'Amount', align: 'right', render: (r) => formatMoney(r.price, r.currency) },
  ];
  return (
    <DataTable<BookingListItem>
      columns={columns} rows={data?.data ?? []} total={data?.meta.total ?? 0}
      loading={isLoading || isFetching} error={error} onRetry={refetch}
      page={table.page} limit={table.limit} order={table.order} onSort={table.setSort}
      onPageChange={table.setPage} onLimitChange={table.setLimit} getRowId={(r) => r.id}
      emptyMessage="No bookings"
    />
  );
}

function CustomerPaymentsTab({ customerId }: { customerId: string }) {
  const table = useServerTable({ defaultLimit: 10 });
  const { data, isLoading, isFetching, error, refetch } = useCustomerInvoices(customerId, table.apiParams);
  const columns: Column<InvoiceRow>[] = [
    { field: 'invoice_number', header: 'Invoice', render: (r) => r.invoice_number ?? r.id.slice(0, 8) },
    { field: 'created_at', header: 'Date', render: (r) => formatDateTime(r.created_at, 'dd MMM yyyy') },
    { field: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
    { field: 'total_amount', header: 'Total', align: 'right', render: (r) => formatMoney(r.total_amount, r.currency) },
  ];
  return (
    <DataTable<InvoiceRow>
      columns={columns} rows={data?.data ?? []} total={data?.meta.total ?? 0}
      loading={isLoading || isFetching} error={error} onRetry={refetch}
      page={table.page} limit={table.limit} order={table.order} onSort={table.setSort}
      onPageChange={table.setPage} onLimitChange={table.setLimit} getRowId={(r) => r.id}
      emptyMessage="No payments"
    />
  );
}
