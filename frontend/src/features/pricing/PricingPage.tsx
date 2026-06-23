// src/features/pricing/PricingPage.tsx
// Pricing management: base service pricing, package pricing, and subscription plans.
// Promotional pricing is handled by the Coupons module.

import { useState } from 'react';
import {
  Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, Stack, Switch, Tab, Tabs, TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Can, PageHeader, useConfirm } from '@/components/common';
import { DataTable, type Column } from '@/components/table/DataTable';
import { Permission } from '@/features/auth/permissions';
import { useServerTable } from '@/hooks/useServerTable';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/providers/ToastProvider';
import { apiClient } from '@/services/apiClient';
import { useServices, useServicePackages } from '@/features/services/hooks';
import { ServiceFormDialog } from '@/features/services/ServiceFormDialog';
import type { ServiceRow, ServicePackageRow } from '@/features/services/types';
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
  WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', YEARLY: 'Yearly',
};

function ServicePricing() {
  const table = useServerTable();
  const { data, isLoading, isFetching, error, refetch } = useServices(table.apiParams);
  const [editing, setEditing] = useState<ServiceRow | null>(null);

  const columns: Column<ServiceRow>[] = [
    { field: 'name', header: 'Service', sortable: true },
    { field: 'basePrice', header: 'Base price', align: 'right', render: (r) => `₹${r.basePrice}` },
    { field: 'isActive', header: 'Status', render: (r) => <Chip size="small" label={r.isActive ? 'Active' : 'Inactive'} color={r.isActive ? 'success' : 'default'} /> },
  ];
  return (
    <>
      <DataTable<ServiceRow>
        columns={columns} rows={data?.data ?? []} total={data?.meta.total ?? 0}
        loading={isLoading || isFetching} error={error} onRetry={refetch}
        page={table.page} limit={table.limit} sort={table.sort} order={table.order}
        onSort={table.setSort} onPageChange={table.setPage} onLimitChange={table.setLimit}
        getRowId={(r) => r.id} onRowClick={(r) => setEditing(r)} emptyMessage="No services"
      />
      <ServiceFormDialog open={Boolean(editing)} onClose={() => setEditing(null)} existing={editing} />
    </>
  );
}

function PackagePricing() {
  const table = useServerTable();
  const { data, isLoading, isFetching, error, refetch } = useServicePackages(table.apiParams);
  const columns: Column<ServicePackageRow>[] = [
    { field: 'name', header: 'Package', sortable: true },
    { field: 'price', header: 'Price', align: 'right', render: (r) => `₹${r.price}` },
    { field: 'is_active', header: 'Status', render: (r) => <Chip size="small" label={r.is_active ? 'Active' : 'Inactive'} color={r.is_active ? 'success' : 'default'} /> },
  ];
  return (
    <DataTable<ServicePackageRow>
      columns={columns} rows={data?.data ?? []} total={data?.meta.total ?? 0}
      loading={isLoading || isFetching} error={error} onRetry={refetch}
      page={table.page} limit={table.limit} sort={table.sort} order={table.order}
      onSort={table.setSort} onPageChange={table.setPage} onLimitChange={table.setLimit}
      getRowId={(r) => r.id} emptyMessage="No packages"
    />
  );
}

// ─── Subscription Plans ────────────────────────────────────────────────────────

interface PlanFormProps { open: boolean; onClose: () => void; existing: Plan | null; }

function PlanForm({ open, onClose, existing }: PlanFormProps) {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [price, setPrice] = useState(String(existing?.price ?? ''));
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(existing?.billingCycle ?? 'MONTHLY');
  const [visitsPerCycle, setVisitsPerCycle] = useState(String(existing?.visitsPerCycle ?? 1));
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const qc = useQueryClient();
  const toast = useToast();

  const handleOpen = () => {
    setName(existing?.name ?? '');
    setDescription(existing?.description ?? '');
    setPrice(String(existing?.price ?? ''));
    setBillingCycle(existing?.billingCycle ?? 'MONTHLY');
    setVisitsPerCycle(String(existing?.visitsPerCycle ?? 1));
    setIsActive(existing?.isActive ?? true);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(), description: description.trim() || undefined,
        price: parseFloat(price), billingCycle,
        visitsPerCycle: parseInt(visitsPerCycle, 10) || 1,
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
    onError: () => toast.error('Save failed'),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth TransitionProps={{ onEnter: handleOpen }}>
      <DialogTitle>{existing ? 'Edit plan' : 'New subscription plan'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
          <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} multiline rows={2} fullWidth />
          <TextField label="Price (₹)" value={price} onChange={(e) => setPrice(e.target.value)} type="number" inputProps={{ min: 0, step: 0.01 }} required fullWidth />
          <TextField select label="Billing cycle" value={billingCycle} onChange={(e) => setBillingCycle(e.target.value as BillingCycle)} fullWidth>
            {(Object.keys(CYCLE_LABELS) as BillingCycle[]).map((c) => <MenuItem key={c} value={c}>{CYCLE_LABELS[c]}</MenuItem>)}
          </TextField>
          <TextField label="Visits per cycle" value={visitsPerCycle} onChange={(e) => setVisitsPerCycle(e.target.value)} type="number" inputProps={{ min: 1, step: 1 }} fullWidth />
          <FormControlLabel control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />} label="Active" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={!name.trim() || !price || mutation.isPending}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PlansSection() {
  const table = useServerTable();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
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
    onError: () => toast.error('Delete failed'),
  });

  const columns: Column<Plan>[] = [
    { field: 'name', header: 'Plan', sortable: true },
    { field: 'billingCycle', header: 'Cycle', render: (r) => CYCLE_LABELS[r.billingCycle] },
    { field: 'price', header: 'Price', align: 'right', render: (r) => `₹${Number(r.price).toLocaleString('en-IN')}` },
    { field: 'visitsPerCycle', header: 'Visits', align: 'right' },
    { field: 'isActive', header: 'Status', render: (r) => <Chip size="small" label={r.isActive ? 'Active' : 'Inactive'} color={r.isActive ? 'success' : 'default'} /> },
    {
      field: 'actions', header: 'Actions', align: 'right',
      render: (r) => (
        <Can permission={Permission.ManagePricing}>
          <Stack direction="row" spacing={1} justifyContent="flex-end" onClick={(e) => e.stopPropagation()}>
            <Button size="small" onClick={() => { setEditing(r); setOpen(true); }}>Edit</Button>
            <Button size="small" color="error" disabled={deleteMutation.isPending}
              onClick={async () => {
                const ok = await confirm({ title: 'Delete plan?', message: `"${r.name}" and all active subscriptions on this plan may be affected.`, confirmText: 'Delete', destructive: true });
                if (ok) deleteMutation.mutate(r.id);
              }}>
              Delete
            </Button>
          </Stack>
        </Can>
      ),
    },
  ];

  return (
    <>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Can permission={Permission.ManagePricing}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setOpen(true); }}>New plan</Button>
        </Can>
      </Stack>
      <DataTable<Plan>
        columns={columns} rows={data?.data ?? []} total={data?.meta.total ?? 0}
        loading={isLoading || isFetching} error={error} onRetry={refetch}
        page={table.page} limit={table.limit} sort={table.sort} order={table.order}
        onSort={table.setSort} onPageChange={table.setPage} onLimitChange={table.setLimit}
        getRowId={(r) => r.id} emptyMessage="No subscription plans"
      />
      <PlanForm open={open} onClose={() => setOpen(false)} existing={editing} />
    </>
  );
}

// ─── Tabbed Pricing page ───────────────────────────────────────────────────────

export function PricingPage() {
  const [tab, setTab] = useState(0);
  return (
    <>
      <PageHeader title="Pricing" subtitle="Service prices, packages, and subscription plans" />
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Services (base)" />
        <Tab label="Packages" />
        <Tab label="Subscription plans" />
      </Tabs>
      {tab === 0 && <ServicePricing />}
      {tab === 1 && <PackagePricing />}
      {tab === 2 && <PlansSection />}
    </>
  );
}
