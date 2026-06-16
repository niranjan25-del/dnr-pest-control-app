// src/features/notifications/NotificationsPage.tsx
// Broadcast announcements composer + notification history. Targeted single-user send is
// available via the API/hook; this screen focuses on the broadcast + audit surface admins
// use day-to-day. Gated by SendBroadcasts.

import { Controller, useForm } from 'react-hook-form';
import {
  Button, Card, CardContent, Grid, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Campaign';
import { Can, PageHeader } from '@/components/common';
import { DataTable, type Column } from '@/components/table/DataTable';
import { useServerTable } from '@/hooks/useServerTable';
import { Permission } from '@/features/auth/permissions';
import { ApiError } from '@/types';
import { useToast } from '@/providers/ToastProvider';
import { formatDateTime } from '@/utils/format';
import { useBroadcast, useNotificationHistory } from './hooks';
import type { BroadcastValues, NotificationRow } from './types';

function BroadcastComposer() {
  const toast = useToast();
  const broadcast = useBroadcast();
  const { control, handleSubmit, reset, formState: { errors } } = useForm<BroadcastValues>({
    defaultValues: { title: '', body: '', audience: 'ALL' },
  });

  const onSubmit = (v: BroadcastValues) =>
    broadcast.mutate(v, {
      onSuccess: () => { toast.success('Broadcast sent'); reset(); },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not send broadcast'),
    });

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>New announcement</Typography>
        <Stack spacing={2}>
          <Controller name="title" control={control} rules={{ required: 'Title is required' }}
            render={({ field }) => <TextField {...field} label="Title" error={!!errors.title} helperText={errors.title?.message} fullWidth />} />
          <Controller name="body" control={control} rules={{ required: 'Message is required' }}
            render={({ field }) => <TextField {...field} label="Message" multiline minRows={3} error={!!errors.body} helperText={errors.body?.message} fullWidth />} />
          <Stack direction="row" spacing={2} alignItems="center">
            <Controller name="audience" control={control}
              render={({ field }) => (
                <TextField {...field} select label="Audience" sx={{ minWidth: 200 }}>
                  <MenuItem value="ALL">Everyone</MenuItem>
                  <MenuItem value="CUSTOMERS">Customers</MenuItem>
                  <MenuItem value="TECHNICIANS">Technicians</MenuItem>
                </TextField>
              )} />
            <Button variant="contained" startIcon={<SendIcon />} onClick={handleSubmit(onSubmit)} disabled={broadcast.isPending}>
              {broadcast.isPending ? 'Sending…' : 'Send broadcast'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function NotificationsPage() {
  const table = useServerTable();
  const { data, isLoading, isFetching, error, refetch } = useNotificationHistory(table.apiParams);

  const columns: Column<NotificationRow>[] = [
    { field: 'created_at', header: 'Sent', sortable: true, render: (r) => (r.created_at ? formatDateTime(r.created_at) : '—') },
    { field: 'type', header: 'Type', render: (r) => r.type ?? '—' },
    { field: 'title', header: 'Title' },
    { field: 'status', header: 'Status', render: (r) => r.status ?? '—' },
  ];

  return (
    <>
      <PageHeader title="Notifications" subtitle="Broadcasts & delivery history" />
      <Can permission={Permission.SendBroadcasts}>
        <BroadcastComposer />
      </Can>
      <Grid container><Grid item xs={12}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>History</Typography>
        <DataTable<NotificationRow>
          columns={columns} rows={data?.data ?? []} total={data?.meta.total ?? 0}
          loading={isLoading || isFetching} error={error} onRetry={refetch}
          page={table.page} limit={table.limit} sort={table.sort} order={table.order}
          onSort={table.setSort} onPageChange={table.setPage} onLimitChange={table.setLimit}
          getRowId={(r) => r.id} emptyMessage="No notifications yet"
        />
      </Grid></Grid>
    </>
  );
}
