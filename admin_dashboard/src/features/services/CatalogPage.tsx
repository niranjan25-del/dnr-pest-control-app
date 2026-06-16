// src/features/services/CatalogPage.tsx
// Tabbed catalog hub: Services, Pest Categories, Service Areas — all managed from one place.

import { useState } from 'react';
import {
  Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, Stack, Switch, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Can, PageHeader, useConfirm } from '@/components/common';
import { DataTable, type Column } from '@/components/table/DataTable';
import { SearchFilterBar } from '@/components/table/SearchFilterBar';
import { useServerTable } from '@/hooks/useServerTable';
import { Permission } from '@/features/auth/permissions';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/providers/ToastProvider';
import { apiClient } from '@/services/apiClient';
import type { Paginated } from '@/types';
// Re-use existing Services section
import { useServices } from './hooks';
import { ServiceFormDialog } from './ServiceFormDialog';
import type { ServiceRow } from './types';

// ─── Services tab ──────────────────────────────────────────────────────────────

function ServicesSection() {
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
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Can permission={Permission.ManageCatalog}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>New service</Button>
        </Can>
      </Stack>
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

// ─── Pest Categories tab ───────────────────────────────────────────────────────

interface PestCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

interface PestCategoryFormProps {
  open: boolean;
  onClose: () => void;
  existing: PestCategory | null;
}

function PestCategoryForm({ open, onClose, existing }: PestCategoryFormProps) {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [iconUrl, setIconUrl] = useState(existing?.iconUrl ?? '');
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const qc = useQueryClient();
  const toast = useToast();

  // Reset on open
  const handleOpen = () => {
    setName(existing?.name ?? '');
    setDescription(existing?.description ?? '');
    setIconUrl(existing?.iconUrl ?? '');
    setIsActive(existing?.isActive ?? true);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { name: name.trim(), description: description.trim() || undefined, iconUrl: iconUrl.trim() || undefined, isActive };
      if (existing) {
        await apiClient.patch(`/pest-categories/${existing.id}`, body);
      } else {
        await apiClient.post('/pest-categories', body);
      }
    },
    onSuccess: () => {
      toast.success(existing ? 'Category updated' : 'Category created');
      qc.invalidateQueries({ queryKey: ['pest-categories'] });
      onClose();
    },
    onError: () => toast.error('Save failed'),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth TransitionProps={{ onEnter: handleOpen }}>
      <DialogTitle>{existing ? 'Edit pest category' : 'New pest category'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
          <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} multiline rows={2} fullWidth />
          <TextField label="Icon URL" value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} fullWidth placeholder="https://…" />
          <FormControlLabel control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />} label="Active" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PestCategoriesSection() {
  const table = useServerTable({ filterKeys: ['isActive'] });
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PestCategory | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useQuery<Paginated<PestCategory>>({
    queryKey: ['pest-categories', 'list', table.apiParams],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<PestCategory>>('/pest-categories', { params: table.apiParams });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/pest-categories/${id}`),
    onSuccess: () => { toast.success('Category deleted'); qc.invalidateQueries({ queryKey: ['pest-categories'] }); },
    onError: () => toast.error('Delete failed'),
  });

  const columns: Column<PestCategory>[] = [
    { field: 'name', header: 'Name', sortable: true },
    { field: 'slug', header: 'Slug', render: (r) => <Typography variant="body2" fontFamily="monospace">{r.slug}</Typography> },
    { field: 'description', header: 'Description', render: (r) => r.description ?? '—' },
    { field: 'isActive', header: 'Status', render: (r) => <Chip size="small" label={r.isActive ? 'Active' : 'Inactive'} color={r.isActive ? 'success' : 'default'} /> },
    {
      field: 'actions', header: 'Actions', align: 'right',
      render: (r) => (
        <Can permission={Permission.ManageCatalog}>
          <Stack direction="row" spacing={1} justifyContent="flex-end" onClick={(e) => e.stopPropagation()}>
            <Button size="small" onClick={() => { setEditing(r); setOpen(true); }}>Edit</Button>
            <Button size="small" color="error" disabled={deleteMutation.isPending}
              onClick={async () => {
                const ok = await confirm({ title: 'Delete category?', message: `"${r.name}" will be removed from the catalog.`, confirmText: 'Delete', destructive: true });
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
        <Can permission={Permission.ManageCatalog}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setOpen(true); }}>New category</Button>
        </Can>
      </Stack>
      <SearchFilterBar search={table.search} onSearch={table.setSearch} placeholder="Search categories…">
        <TextField select size="small" label="Status" sx={{ minWidth: 140 }} value={table.filters.isActive ?? ''} onChange={(e) => table.setFilter('isActive', e.target.value || undefined)}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="true">Active</MenuItem>
          <MenuItem value="false">Inactive</MenuItem>
        </TextField>
      </SearchFilterBar>
      <DataTable<PestCategory>
        columns={columns} rows={data?.data ?? []} total={data?.meta.total ?? 0}
        loading={isLoading || isFetching} error={error} onRetry={refetch}
        page={table.page} limit={table.limit} sort={table.sort} order={table.order}
        onSort={table.setSort} onPageChange={table.setPage} onLimitChange={table.setLimit}
        getRowId={(r) => r.id} emptyMessage="No pest categories"
      />
      <PestCategoryForm open={open} onClose={() => setOpen(false)} existing={editing} />
    </>
  );
}

// ─── Service Areas tab ─────────────────────────────────────────────────────────

interface ServiceArea {
  id: string;
  name: string;
  postalCodes: string[];
  technicianId: string | null;
  createdAt: string;
  deletedAt: string | null;
}

interface ServiceAreaFormProps {
  open: boolean;
  onClose: () => void;
  existing: ServiceArea | null;
}

function ServiceAreaForm({ open, onClose, existing }: ServiceAreaFormProps) {
  const [name, setName] = useState(existing?.name ?? '');
  const [postalCodes, setPostalCodes] = useState((existing?.postalCodes ?? []).join(', '));
  const qc = useQueryClient();
  const toast = useToast();

  const handleOpen = () => {
    setName(existing?.name ?? '');
    setPostalCodes((existing?.postalCodes ?? []).join(', '));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const codes = postalCodes.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
      const body = { name: name.trim(), postalCodes: codes };
      if (existing) {
        await apiClient.patch(`/service-areas/${existing.id}`, body);
      } else {
        await apiClient.post('/service-areas', body);
      }
    },
    onSuccess: () => {
      toast.success(existing ? 'Area updated' : 'Area created');
      qc.invalidateQueries({ queryKey: ['service-areas'] });
      onClose();
    },
    onError: () => toast.error('Save failed'),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth TransitionProps={{ onEnter: handleOpen }}>
      <DialogTitle>{existing ? 'Edit service area' : 'New service area'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth placeholder="e.g. South Chennai" />
          <TextField
            label="Postal codes" value={postalCodes} onChange={(e) => setPostalCodes(e.target.value)}
            multiline rows={3} fullWidth
            helperText="Comma or space separated list of pin codes"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ServiceAreasSection() {
  const table = useServerTable();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceArea | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useQuery<Paginated<ServiceArea>>({
    queryKey: ['service-areas', 'list', table.apiParams],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<ServiceArea>>('/service-areas', { params: table.apiParams });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient.patch(`/service-areas/${id}/active`, { active }),
    onSuccess: (_, { active }) => {
      toast.success(active ? 'Area activated' : 'Area deactivated');
      qc.invalidateQueries({ queryKey: ['service-areas'] });
    },
    onError: () => toast.error('Toggle failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/service-areas/${id}`),
    onSuccess: () => { toast.success('Area deleted'); qc.invalidateQueries({ queryKey: ['service-areas'] }); },
    onError: () => toast.error('Delete failed'),
  });

  const columns: Column<ServiceArea>[] = [
    { field: 'name', header: 'Name', sortable: true },
    {
      field: 'postalCodes', header: 'Postal codes',
      render: (r) => (
        <Typography variant="body2" sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.postalCodes.join(', ')}
        </Typography>
      ),
    },
    { field: 'postalCodes', header: 'Count', render: (r) => r.postalCodes.length },
    {
      field: 'deletedAt', header: 'Status',
      render: (r) => <Chip size="small" label={r.deletedAt ? 'Inactive' : 'Active'} color={r.deletedAt ? 'default' : 'success'} />,
    },
    {
      field: 'actions', header: 'Actions', align: 'right',
      render: (r) => (
        <Can permission={Permission.ManageCatalog}>
          <Stack direction="row" spacing={1} justifyContent="flex-end" onClick={(e) => e.stopPropagation()}>
            <Button size="small" onClick={() => { setEditing(r); setOpen(true); }}>Edit</Button>
            <Button size="small" color={r.deletedAt ? 'success' : 'warning'} disabled={toggleActive.isPending}
              onClick={() => toggleActive.mutate({ id: r.id, active: Boolean(r.deletedAt) })}>
              {r.deletedAt ? 'Activate' : 'Deactivate'}
            </Button>
            <Button size="small" color="error" disabled={deleteMutation.isPending}
              onClick={async () => {
                const ok = await confirm({ title: 'Delete area?', message: `"${r.name}" will be permanently removed.`, confirmText: 'Delete', destructive: true });
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
        <Can permission={Permission.ManageCatalog}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setOpen(true); }}>New area</Button>
        </Can>
      </Stack>
      <SearchFilterBar search={table.search} onSearch={table.setSearch} placeholder="Search areas…" />
      <DataTable<ServiceArea>
        columns={columns} rows={data?.data ?? []} total={data?.meta.total ?? 0}
        loading={isLoading || isFetching} error={error} onRetry={refetch}
        page={table.page} limit={table.limit} sort={table.sort} order={table.order}
        onSort={table.setSort} onPageChange={table.setPage} onLimitChange={table.setLimit}
        getRowId={(r) => r.id} emptyMessage="No service areas"
      />
      <ServiceAreaForm open={open} onClose={() => setOpen(false)} existing={editing} />
    </>
  );
}

// ─── Tabbed Catalog page ───────────────────────────────────────────────────────

export function CatalogPage() {
  const [tab, setTab] = useState(0);
  return (
    <>
      <PageHeader title="Catalog" subtitle="Services, pest categories and service areas" />
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Services" />
        <Tab label="Pest categories" />
        <Tab label="Service areas" />
      </Tabs>
      {tab === 0 && <ServicesSection />}
      {tab === 1 && <PestCategoriesSection />}
      {tab === 2 && <ServiceAreasSection />}
    </>
  );
}
