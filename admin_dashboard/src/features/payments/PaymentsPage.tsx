// src/features/payments/PaymentsPage.tsx
// Payments list for admin: all transactions with status filter + inline refund action.

import { useState } from 'react';
import {
  Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { Can, PageHeader } from '@/components/common';
import { DataTable, type Column } from '@/components/table/DataTable';
import { SearchFilterBar } from '@/components/table/SearchFilterBar';
import { useServerTable } from '@/hooks/useServerTable';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/providers/ToastProvider';
import { Permission } from '@/features/auth/permissions';
import { apiClient } from '@/services/apiClient';
import { paymentsApi, type PaymentRow, type PaymentStatus } from './api';

interface RefundDialogProps {
  payment: PaymentRow | null;
  onClose: () => void;
}

function RefundDialog({ payment, onClose }: RefundDialogProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const qc = useQueryClient();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/payments/refund', {
        paymentId: payment!.id,
        amount: amount ? parseFloat(amount) : undefined,
        reason: reason.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Refund initiated');
      qc.invalidateQueries({ queryKey: ['payments'] });
      onClose();
    },
    onError: () => toast.error('Refund failed — check Stripe dashboard for details'),
  });

  if (!payment) return null;
  const maxRefundable = Number(payment.amount) - Number(payment.refunded_amount);

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Refund payment</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Invoice: {payment.invoice_number ?? '—'} · Paid: {payment.currency} {Number(payment.amount).toFixed(2)}
            {payment.refunded_amount > 0 && ` · Already refunded: ${payment.currency} ${Number(payment.refunded_amount).toFixed(2)}`}
          </Typography>
          <TextField
            label={`Refund amount (${payment.currency}) — leave blank for full refund`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            inputProps={{ min: 0.01, max: maxRefundable, step: 0.01 }}
            fullWidth
            helperText={`Max refundable: ${payment.currency} ${maxRefundable.toFixed(2)}`}
          />
          <TextField
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            multiline rows={2} fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="warning" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Processing…' : 'Issue refund'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const STATUS_COLORS: Record<PaymentStatus, 'success' | 'error' | 'warning' | 'default' | 'info'> = {
  SUCCEEDED: 'success',
  FAILED: 'error',
  REFUNDED: 'warning',
  PARTIALLY_REFUNDED: 'warning',
  PENDING: 'default',
  PROCESSING: 'info',
  CANCELLED: 'default',
};

const STATUS_OPTIONS: PaymentStatus[] = [
  'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED',
];

export function PaymentsPage() {
  const table = useServerTable({ filterKeys: ['status'] });
  const [refunding, setRefunding] = useState<PaymentRow | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['payments', 'list', table.apiParams],
    queryFn: () => paymentsApi.list(table.apiParams),
    placeholderData: (prev) => prev,
  });

  const columns: Column<PaymentRow>[] = [
    { field: 'invoice_number', header: 'Invoice', render: (r) => r.invoice_number ?? '—' },
    {
      field: 'amount',
      header: 'Amount',
      align: 'right',
      render: (r) => `${r.currency} ${Number(r.amount).toFixed(2)}`,
    },
    {
      field: 'refunded_amount',
      header: 'Refunded',
      align: 'right',
      render: (r) => (r.refunded_amount > 0 ? `${r.currency} ${Number(r.refunded_amount).toFixed(2)}` : '—'),
    },
    { field: 'method', header: 'Method', render: (r) => r.method },
    {
      field: 'status',
      header: 'Status',
      render: (r) => (
        <Chip size="small" label={r.status.replace('_', ' ')} color={STATUS_COLORS[r.status] ?? 'default'} />
      ),
    },
    {
      field: 'created_at',
      header: 'Date',
      render: (r) => new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    {
      field: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        r.status === 'SUCCEEDED' && Number(r.refunded_amount) < Number(r.amount) ? (
          <Can permission={Permission.ProcessRefunds}>
            <Button size="small" color="warning" onClick={(e) => { e.stopPropagation(); setRefunding(r); }}>
              Refund
            </Button>
          </Can>
        ) : null
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Payments" subtitle="All transactions" />
      <SearchFilterBar search={table.search} onSearch={table.setSearch} placeholder="Search by invoice…">
        <TextField
          select size="small" label="Status" sx={{ minWidth: 170 }}
          value={table.filters.status ?? ''}
          onChange={(e) => table.setFilter('status', e.target.value || undefined)}
        >
          <MenuItem value="">All</MenuItem>
          {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
        </TextField>
      </SearchFilterBar>
      <DataTable<PaymentRow>
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
        emptyMessage="No payments found"
      />
      <RefundDialog payment={refunding} onClose={() => setRefunding(null)} />
    </>
  );
}
