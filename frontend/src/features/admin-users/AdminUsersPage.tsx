// src/features/admin-users/AdminUsersPage.tsx
// Admin user directory. Super Admins can create new admins, change sub-roles, and
// suspend accounts. The owner account (is_owner === true) is permanently protected —
// it cannot be suspended, deleted, or downgraded from any UI action.

import { useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  InputAdornment, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { LockOutlined as LockIcon, AdminPanelSettings as ShieldIcon } from '@mui/icons-material';
import { Can, PageHeader } from '@/components/common';
import { DataTable, type Column } from '@/components/table/DataTable';
import { SearchFilterBar } from '@/components/table/SearchFilterBar';
import { useServerTable } from '@/hooks/useServerTable';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/providers/ToastProvider';
import { Permission } from '@/features/auth/permissions';
import { apiClient } from '@/services/apiClient';
import type { Paginated } from '@/types';

type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
type AdminRole = 'SUPER_ADMIN' | 'OPERATIONS_MANAGER' | 'DISPATCHER' | 'CUSTOMER_SUPPORT';

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  admin_role: AdminRole | null;
  status: UserStatus;
  email_verified: boolean;
  created_at: string;
  is_owner: boolean;
}

const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  OPERATIONS_MANAGER: 'Operations Manager',
  DISPATCHER: 'Dispatcher',
  CUSTOMER_SUPPORT: 'Customer Support',
};

const ADMIN_ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Full control — can create admins and change any role',
  OPERATIONS_MANAGER: 'Manage bookings, technicians, pricing, and payments',
  DISPATCHER: 'Assign technicians and manage bookings',
  CUSTOMER_SUPPORT: 'Help customers, moderate reviews, send broadcasts',
};

const STATUS_COLORS: Record<UserStatus, 'success' | 'warning' | 'default' | 'error'> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  DEACTIVATED: 'error',
};

function useAdminUsers(params: Record<string, unknown>) {
  return useQuery<Paginated<AdminUser>>({
    queryKey: ['admin-users', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<AdminUser>>('/admin/users', {
        params: { ...params, role: 'ADMIN' },
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

// ── Role change dialog ────────────────────────────────────────────────────────

interface RoleDialogProps {
  user: AdminUser | null;
  onClose: () => void;
}

function RoleDialog({ user, onClose }: RoleDialogProps) {
  const [adminRole, setAdminRole] = useState<AdminRole>(user?.admin_role ?? 'DISPATCHER');
  const qc = useQueryClient();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/admin/users/${user!.id}/role`, { role: 'ADMIN', adminRole });
    },
    onSuccess: () => {
      toast.success('Admin role updated');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    },
    onError: () => toast.error('Role update failed — only Super Admins can change roles'),
  });

  if (!user) return null;

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Change role — {user.full_name ?? user.email}</DialogTitle>
      <DialogContent>
        {user.is_owner && (
          <Alert severity="warning" icon={<LockIcon />} sx={{ mb: 2, mt: 1 }}>
            This is the owner account. Its role is locked at Super Admin and cannot be changed.
          </Alert>
        )}
        <TextField
          select fullWidth label="Sub-role" value={adminRole}
          onChange={(e) => setAdminRole(e.target.value as AdminRole)}
          disabled={user.is_owner}
          sx={{ mt: 1 }}
          helperText={ADMIN_ROLE_DESCRIPTIONS[adminRole]}
        >
          {(Object.keys(ADMIN_ROLE_LABELS) as AdminRole[]).map((r) => (
            <MenuItem key={r} value={r}>{ADMIN_ROLE_LABELS[r]}</MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || user.is_owner}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Create admin dialog ───────────────────────────────────────────────────────

interface CreateAdminDialogProps {
  open: boolean;
  onClose: () => void;
}

function CreateAdminDialog({ open, onClose }: CreateAdminDialogProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', phone: '', adminRole: 'DISPATCHER' as AdminRole,
  });
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const mutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/admin/users', {
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        adminRole: form.adminRole,
      });
    },
    onSuccess: () => {
      toast.success(`Admin account created for ${form.email}`);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setForm({ fullName: '', email: '', password: '', phone: '', adminRole: 'DISPATCHER' });
      setError(null);
      onClose();
    },
    onError: (e: Error) => setError(e.message ?? 'Failed to create admin account'),
  });

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    mutation.mutate();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ShieldIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>Add admin account</Typography>
        </Stack>
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="Full name" fullWidth required
              value={form.fullName} onChange={set('fullName')}
            />
            <TextField
              label="Email" type="email" fullWidth required
              value={form.email} onChange={set('email')}
            />
            <TextField
              label="Password" type="password" fullWidth required
              value={form.password} onChange={set('password')}
              helperText="Minimum 8 characters"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Typography variant="caption" color="text.secondary">
                      {form.password.length}/8+
                    </Typography>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Phone (optional)" fullWidth
              value={form.phone} onChange={set('phone')}
              placeholder="+91XXXXXXXXXX"
            />
            <TextField
              select label="Permission level" fullWidth required
              value={form.adminRole}
              onChange={(e) => setForm((f) => ({ ...f, adminRole: e.target.value as AdminRole }))}
              helperText={ADMIN_ROLE_DESCRIPTIONS[form.adminRole]}
            >
              {(Object.keys(ADMIN_ROLE_LABELS) as AdminRole[]).map((r) => (
                <MenuItem key={r} value={r}>
                  <Stack>
                    <Typography variant="body2" fontWeight={600}>{ADMIN_ROLE_LABELS[r]}</Typography>
                  </Stack>
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create account'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminUsersPage() {
  const table = useServerTable({ filterKeys: ['status'] });
  const qc = useQueryClient();
  const toast = useToast();
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useAdminUsers(table.apiParams);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      apiClient.patch(`/admin/users/${id}/status`, { status }),
    onSuccess: (_, { status }) => {
      toast.success(`User ${status === 'ACTIVE' ? 'reactivated' : 'suspended'}`);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e: Error) => toast.error(e.message ?? 'Status update failed'),
  });

  const columns: Column<AdminUser>[] = [
    {
      field: 'full_name',
      header: 'Name',
      sortable: true,
      render: (r) => (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box>
            <Typography variant="body2" fontWeight={600}>{r.full_name ?? '—'}</Typography>
            <Typography variant="caption" color="text.secondary">{r.email}</Typography>
          </Box>
          {r.is_owner && (
            <Tooltip title="Owner — this account is permanently protected and cannot be suspended or removed">
              <Chip
                size="small"
                label="Owner"
                icon={<LockIcon sx={{ fontSize: '12px !important' }} />}
                color="primary"
                variant="outlined"
                sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
              />
            </Tooltip>
          )}
        </Stack>
      ),
    },
    {
      field: 'admin_role',
      header: 'Permission level',
      render: (r) => r.admin_role ? (
        <Chip size="small" label={ADMIN_ROLE_LABELS[r.admin_role]} variant="outlined" />
      ) : '—',
    },
    {
      field: 'status',
      header: 'Status',
      render: (r) => (
        <Chip size="small" label={r.status} color={STATUS_COLORS[r.status] ?? 'default'} />
      ),
    },
    {
      field: 'created_at',
      header: 'Joined',
      render: (r) => new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    {
      field: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => (
        <Stack direction="row" spacing={1} justifyContent="flex-end" onClick={(e) => e.stopPropagation()}>
          <Can permission={Permission.ManageRoles}>
            <Button size="small" variant="outlined" onClick={() => setRoleTarget(r)}>
              Role
            </Button>
          </Can>
          <Can permission={Permission.SuspendUsers}>
            {r.is_owner ? (
              <Tooltip title="Owner account — cannot be suspended">
                <span>
                  <Button size="small" disabled startIcon={<LockIcon />}>
                    Protected
                  </Button>
                </span>
              </Tooltip>
            ) : r.status === 'ACTIVE' ? (
              <Button
                size="small" color="warning" disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id: r.id, status: 'SUSPENDED' })}
              >
                Suspend
              </Button>
            ) : (
              <Button
                size="small" color="success" disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id: r.id, status: 'ACTIVE' })}
              >
                Reactivate
              </Button>
            )}
          </Can>
        </Stack>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Admin Users"
        subtitle="Manage admin accounts and permission levels"
        actions={
          <Can permission={Permission.ManageRoles}>
            <Button variant="contained" startIcon={<ShieldIcon />} onClick={() => setCreateOpen(true)}>
              Add admin
            </Button>
          </Can>
        }
      />
      <SearchFilterBar search={table.search} onSearch={table.setSearch} placeholder="Search by name or email…">
        <TextField
          select size="small" label="Status" sx={{ minWidth: 140 }}
          value={table.filters.status ?? ''}
          onChange={(e) => table.setFilter('status', e.target.value || undefined)}
        >
          <MenuItem value="">All</MenuItem>
          {(['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as UserStatus[]).map((s) => (
            <MenuItem key={s} value={s}>{s}</MenuItem>
          ))}
        </TextField>
      </SearchFilterBar>
      <DataTable<AdminUser>
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
        emptyMessage="No admin users found"
      />
      <RoleDialog user={roleTarget} onClose={() => setRoleTarget(null)} />
      <CreateAdminDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
