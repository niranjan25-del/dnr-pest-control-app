// src/features/plans/PlansPage.tsx
// Dedicated admin page for managing subscription plan types.
// Admins create plan tiers (e.g. Monthly Basic, Annual Premium) here; customers then
// subscribe to these plans via the customer portal.

import { useEffect, useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, InputAdornment, MenuItem, Stack, Switch, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Can, PageHeader, useConfirm } from '@/components/common';
import { DataTable, type Column } from '@/components/table/DataTable';
import { SearchFilterBar } from '@/components/table/SearchFilterBar';
import { Permission } from '@/features/auth/permissions';
import { useServerTable } from '@/hooks/useServerTable';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/providers/ToastProvider';
import { apiClient } from '@/services/apiClient';
import type { Paginated } from '@/types';

type BillingCycle = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | string;
  currency: string;
  billingCycle: BillingCycle;
  visitsPerCycle: number;
  isActive: boolean;
  createdAt: string;
}

const CYCLE_LABELS: Record<BillingCycle, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
};

const CYCLE_DESCRIPTIONS: Record<BillingCycle, string> = {
  WEEKLY: 'Customer is billed every week',
  MONTHLY: 'Customer is billed every month',
  QUARTERLY: 'Customer is billed every 3 months',
  YEARLY: 'Customer is billed every 12 months',
};

// ── Plan Form Dialog ───────────────────────────────────────────────────────────

interface PlanFormDialogProps {
  open: boolean;
  onClose: () => void;
  existing: Plan | null;
}

function PlanFormDialog({ open, onClose, existing }: PlanFormDialogProps) {
  const [name,           setName]           = useState('');
  const [description,    setDescription]    = useState('');
  const [price,          setPrice]          = useState('');
  const [billingCycle,   setBillingCycle]   = useState<BillingCycle>('MONTHLY');
  const [visitsPerCycle, setVisitsPerCycle] = useState('1');
  const [isActive,       setIsActive]       = useState(true);
  const [priceError,     setPriceError]     = useState('');

  const qc   = useQueryClient();
  const toast = useToast();

  // Sync form fields whenever the dialog opens or the plan being edited changes.
  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? '');
    setDescription(existing?.description ?? '');
    setPrice(existing?.price != null ? String(existing.price) : '');
    setBillingCycle(existing?.billingCycle ?? 'MONTHLY');
    setVisitsPerCycle(String(existing?.visitsPerCycle ?? 1));
    setIsActive(existing?.isActive ?? true);
    setPriceError('');
  }, [open, existing]);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsedPrice = parseFloat(price);
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: parsedPrice,
        billingCycle,
        visitsPerCycle: Math.max(1, parseInt(visitsPerCycle, 10) || 1),
        isActive,
      };
      if (existing) {
        await apiClient.patch(`/plans/${existing.id}`, body);
      } else {
        await apiClient.post('/plans', body);
      }
    },
    onSuccess: () => {
      toast.success(existing ? 'Plan updated' : 'Plan created');
      qc.invalidateQueries({ queryKey: ['plans'] });
      onClose();
    },
    onError: () => toast.error('Could not save plan. Please try again.'),
  });

  const handleSave = () => {
    setPriceError('');
    const parsed = parseFloat(price);
    if (!price.trim() || isNaN(parsed) || parsed < 0) {
      setPriceError('Enter a valid price (₹0 or more)');
      return;
    }
    mutation.mutate();
  };

  const canSave = Boolean(name.trim()) && Boolean(price.trim()) && !isNaN(parseFloat(price)) && parseFloat(price) >= 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {existing ? 'Edit subscription plan' : 'New subscription plan'}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            label="Plan name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            placeholder="E.g. Monthly Basic, Annual Premium"
            helperText="This is what customers see when choosing a plan."
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
            fullWidth
            placeholder="E.g. Includes 2 pest control visits per month, up to 3 BHK"
            helperText="Optional. Briefly describe what the plan includes."
          />

          <TextField
            label="Price per cycle"
            value={price}
            onChange={(e) => { setPrice(e.target.value); setPriceError(''); }}
            type="number"
            inputProps={{ min: 0, step: 0.01 }}
            required
            fullWidth
            error={Boolean(priceError)}
            helperText={priceError || 'Amount charged to the customer each billing cycle.'}
            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
          />

          <TextField
            select
            label="Billing cycle"
            value={billingCycle}
            onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
            fullWidth
            helperText={CYCLE_DESCRIPTIONS[billingCycle]}
          >
            {(Object.keys(CYCLE_LABELS) as BillingCycle[]).map((c) => (
              <MenuItem key={c} value={c}>{CYCLE_LABELS[c]}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="Visits per cycle"
            value={visitsPerCycle}
            onChange={(e) => setVisitsPerCycle(e.target.value)}
            type="number"
            inputProps={{ min: 1, step: 1 }}
            fullWidth
            helperText="How many service visits are included in each billing cycle."
          />

          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 2, py: 1.5 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  color="success"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {isActive ? 'Active' : 'Inactive'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {isActive
                      ? 'Customers can see and subscribe to this plan.'
                      : 'Plan is hidden — customers cannot subscribe.'}
                  </Typography>
                </Box>
              }
            />
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!canSave || mutation.isPending}
        >
          {mutation.isPending
            ? (existing ? 'Saving…' : 'Creating…')
            : (existing ? 'Save changes' : 'Create plan')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Plans Page ─────────────────────────────────────────────────────────────────

export function PlansPage() {
  const table  = useServerTable();
  const qc     = useQueryClient();
  const toast  = useToast();
  const confirm = useConfirm();

  const [open,    setOpen]    = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useQuery<Paginated<Plan>>({
    queryKey: ['plans', 'list', table.apiParams],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<Plan>>('/plans', { params: table.apiParams });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/plans/${id}`),
    onSuccess: () => { toast.success('Plan deleted'); qc.invalidateQueries({ queryKey: ['plans'] }); },
    onError:   () => toast.error('Delete failed'),
  });

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit   = (plan: Plan) => { setEditing(plan); setOpen(true); };
  const handleClose = () => setOpen(false);

  const handleDelete = async (plan: Plan) => {
    const ok = await confirm({
      title: 'Delete plan?',
      message: `"${plan.name}" will be deactivated and hidden from customers. Existing active subscriptions on this plan are not cancelled automatically.`,
      confirmText: 'Delete plan',
      destructive: true,
    });
    if (ok) deleteMutation.mutate(plan.id);
  };

  const columns: Column<Plan>[] = [
    {
      field: 'name',
      header: 'Plan name',
      sortable: true,
      render: (r) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{r.name}</Typography>
          {r.description && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {r.description}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'billingCycle',
      header: 'Billing cycle',
      render: (r) => CYCLE_LABELS[r.billingCycle],
    },
    {
      field: 'price',
      header: 'Price / cycle',
      align: 'right',
      render: (r) => (
        <Typography variant="body2" fontWeight={700}>
          ₹{Number(r.price).toLocaleString('en-IN')}
        </Typography>
      ),
    },
    {
      field: 'visitsPerCycle',
      header: 'Visits / cycle',
      align: 'right',
    },
    {
      field: 'isActive',
      header: 'Status',
      render: (r) => (
        <Chip
          size="small"
          label={r.isActive ? 'Active' : 'Inactive'}
          color={r.isActive ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <Can permission={Permission.ManagePricing}>
          <Stack direction="row" spacing={1} justifyContent="flex-end" onClick={(e) => e.stopPropagation()}>
            <Button size="small" onClick={() => openEdit(r)}>Edit</Button>
            <Button
              size="small"
              color="error"
              disabled={deleteMutation.isPending}
              onClick={() => void handleDelete(r)}
            >
              Delete
            </Button>
          </Stack>
        </Can>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Subscription Plans"
        subtitle="Define the plan types customers can subscribe to — set pricing, billing cycle, and included visits."
        actions={
          <Can permission={Permission.ManagePricing}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              New plan
            </Button>
          </Can>
        }
      />

      <SearchFilterBar
        search={table.search}
        onSearch={table.setSearch}
        placeholder="Search plans…"
      />

      <DataTable<Plan>
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
        onRowClick={openEdit}
        emptyMessage="No subscription plans yet. Create your first plan to get started."
      />

      {/* key forces re-mount when switching between create/edit or between different plans */}
      <PlanFormDialog
        key={open ? (editing?.id ?? 'new') : 'closed'}
        open={open}
        onClose={handleClose}
        existing={editing}
      />
    </>
  );
}
