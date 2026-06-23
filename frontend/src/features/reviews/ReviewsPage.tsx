// src/features/reviews/ReviewsPage.tsx
// Review moderation queue: list all reviews, filter by status, approve (PUBLISHED) or
// hide (HIDDEN) individual reviews.

import { Chip, MenuItem, Stack, Button, TextField, Rating } from '@mui/material';
import { PageHeader } from '@/components/common';
import { DataTable, type Column } from '@/components/table/DataTable';
import { SearchFilterBar } from '@/components/table/SearchFilterBar';
import { useServerTable } from '@/hooks/useServerTable';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/providers/ToastProvider';
import { reviewsApi, type ReviewRow, type ReviewStatus } from './api';

const STATUS_COLORS: Record<ReviewStatus, 'success' | 'error' | 'warning' | 'default'> = {
  PUBLISHED: 'success',
  HIDDEN: 'default',
  PENDING: 'warning',
  FLAGGED: 'error',
};

export function ReviewsPage() {
  const table = useServerTable({ filterKeys: ['status'] });
  const qc = useQueryClient();
  const toast = useToast();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['reviews', 'list', table.apiParams],
    queryFn: () => reviewsApi.list(table.apiParams),
    placeholderData: (prev) => prev,
  });

  const moderate = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReviewStatus }) => reviewsApi.moderate(id, status),
    onSuccess: (_, vars) => {
      toast.success(`Review ${vars.status === 'PUBLISHED' ? 'published' : vars.status === 'HIDDEN' ? 'hidden' : 'flagged'}`);
      qc.invalidateQueries({ queryKey: ['reviews'] });
    },
    onError: () => toast.error('Moderation action failed'),
  });

  const columns: Column<ReviewRow>[] = [
    { field: 'customer_name', header: 'Customer', render: (r) => r.customer_name ?? '—' },
    { field: 'technician_name', header: 'Technician', render: (r) => r.technician_name ?? '—' },
    {
      field: 'rating',
      header: 'Rating',
      render: (r) => <Rating value={r.rating} readOnly size="small" />,
    },
    {
      field: 'comment',
      header: 'Comment',
      render: (r) => (
        <span style={{ maxWidth: 300, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.comment ?? '—'}
        </span>
      ),
    },
    {
      field: 'status',
      header: 'Status',
      render: (r) => <Chip size="small" label={r.status} color={STATUS_COLORS[r.status] ?? 'default'} />,
    },
    {
      field: 'created_at',
      header: 'Date',
      render: (r) => new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    {
      field: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => (
        <Stack direction="row" spacing={1} justifyContent="flex-end" onClick={(e) => e.stopPropagation()}>
          {r.status !== 'PUBLISHED' && (
            <Button size="small" color="success" disabled={moderate.isPending}
              onClick={() => moderate.mutate({ id: r.id, status: 'PUBLISHED' })}>
              Publish
            </Button>
          )}
          {r.status !== 'HIDDEN' && (
            <Button size="small" color="inherit" disabled={moderate.isPending}
              onClick={() => moderate.mutate({ id: r.id, status: 'HIDDEN' })}>
              Hide
            </Button>
          )}
          {r.status !== 'FLAGGED' && (
            <Button size="small" color="error" disabled={moderate.isPending}
              onClick={() => moderate.mutate({ id: r.id, status: 'FLAGGED' })}>
              Flag
            </Button>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Reviews" subtitle="Customer feedback moderation" />
      <SearchFilterBar search={table.search} onSearch={table.setSearch} placeholder="Search reviews…">
        <TextField
          select size="small" label="Status" sx={{ minWidth: 140 }}
          value={table.filters.status ?? ''}
          onChange={(e) => table.setFilter('status', e.target.value || undefined)}
        >
          <MenuItem value="">All</MenuItem>
          {(['PENDING', 'PUBLISHED', 'HIDDEN', 'FLAGGED'] as ReviewStatus[]).map((s) => (
            <MenuItem key={s} value={s}>{s}</MenuItem>
          ))}
        </TextField>
      </SearchFilterBar>
      <DataTable<ReviewRow>
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
        emptyMessage="No reviews found"
      />
    </>
  );
}
