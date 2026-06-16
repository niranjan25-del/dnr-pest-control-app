// src/features/admin-users/AdminUsersPage.tsx
// Admin user directory. Lists all ADMIN-role accounts; Super Admins can change sub-roles;
// Operations Managers can suspend/reactivate. Role changes require ManageRoles permission.

import { useState } from 'react';
import {
  Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, TextField,
} from '@mui/material';
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
}

const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  OPERATIONS_MANAGER: 'Operations Manager',
  DISPATCHER: 'Dispatcher',
  CUSTOMER_SUPPORT: 'Customer Support',
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
      <DialogTitle>Change admin role — {user.full_name ?? user.email}</DialogTitle>
      <DialogContent>
        <TextField
          select fullWidth label="Sub-role" value={adminRole}
          onChange={(e) => setAdminRole(e.target.value as AdminRole)}
          sx={{ mt: 1 }}
        >
          {(Object.keys(ADMIN_ROLE_LABELS) as AdminRole[]).map((r) => (
            <MenuItem key={r} value={r}>{ADMIN_ROLE_LABELS[r]}</MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function AdminUsersPage() {
  const table = useServerTable({ filterKeys: ['status'] });
  const qc = useQueryClient();
  const toast = useToast();
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useAdminUsers(table.apiParams);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      apiClient.patch(`/admin/users/${id}/status`, { status }),
    onSuccess: (_, { status }) => {
      toast.success(`User ${status === 'ACTIVE' ? 'reactivated' : 'suspended'}`);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: () => toast.error('Status update failed'),
  });

  const columns: Column<AdminUser>[] = [
    {
      field: 'full_name',
      header: 'Name',
      sortable: true,
      render: (r) => r.full_name ?? '—',
    },
    { field: 'email', header: 'Email', sortable: true },
    {
      field: 'admin_role',
      header: 'Sub-role',
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
            {r.status === 'ACTIVE' ? (
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
      <PageHeader title="Admin Users" subtitle="Manage admin accounts and sub-roles" />
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
    </>
  );
}
