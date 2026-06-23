import { useState } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, InputAdornment, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { Add as AddIcon, Business, Home, Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { PageHeader, StatusChip } from '@/components/common';
import { DataTable, type Column } from '@/components/table/DataTable';
import { SearchFilterBar } from '@/components/table/SearchFilterBar';
import { useServerTable } from '@/hooks/useServerTable';
import { formatDateTime } from '@/utils/format';
import { paths } from '@/routes/paths';
import { useCustomers, useCreateCustomer } from './hooks';
import type { CustomerType, UserRow } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const TYPE_COLORS: Record<CustomerType, string> = {
  RESIDENTIAL: '#1565C0',
  COMMERCIAL:  '#6A1B9A',
};

function CustomerTypeChip({ type }: { type?: CustomerType | null }) {
  if (!type) return <Typography variant="caption" color="text.disabled">—</Typography>;
  const color = TYPE_COLORS[type];
  return (
    <Chip
      size="small"
      icon={type === 'COMMERCIAL' ? <Business sx={{ fontSize: '13px !important' }} /> : <Home sx={{ fontSize: '13px !important' }} />}
      label={type === 'COMMERCIAL' ? 'Commercial' : 'Residential'}
      sx={{ bgcolor: `${color}14`, color, borderColor: `${color}40`, fontWeight: 600, fontSize: 11 }}
      variant="outlined"
    />
  );
}

// ── Add Customer Dialog ───────────────────────────────────────────────────────

function AddCustomerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateCustomer();

  const [fullName, setFullName]     = useState('');
  const [email, setEmail]           = useState('');
  const [phone, setPhone]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [error, setError]           = useState('');

  const valid = fullName.trim().length > 0 && email.trim().length > 0 && password.length >= 8;

  const handleSubmit = async () => {
    setError('');
    try {
      await create.mutateAsync({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      handleClose();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to create customer. Please try again.');
    }
  };

  const handleClose = () => {
    if (create.isPending) return;
    setFullName(''); setEmail(''); setPhone(''); setPassword('');
    setShowPwd(false); setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add Customer</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Full name" fullWidth required autoFocus
            value={fullName} onChange={(e) => setFullName(e.target.value)}
          />
          <TextField
            label="Email address" type="email" fullWidth required
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Phone (optional)" fullWidth placeholder="+91 98765 43210"
            value={phone} onChange={(e) => setPhone(e.target.value)}
          />
          <TextField
            label="Password" fullWidth required
            type={showPwd ? 'text' : 'password'}
            value={password} onChange={(e) => setPassword(e.target.value)}
            helperText="Minimum 8 characters"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowPwd((v) => !v)} edge="end">
                    {showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Alert severity="info" sx={{ py: 0.5 }}>
            <Typography variant="caption">
              The account is created as <b>Active</b> with a verified email.
              Share the credentials with the customer so they can log in.
            </Typography>
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={create.isPending}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!valid || create.isPending}
          startIcon={create.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {create.isPending ? 'Creating…' : 'Create Customer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function CustomersListPage() {
  const navigate = useNavigate();
  const table = useServerTable({ filterKeys: ['status', 'customer_type'] });
  const { data, isLoading, isFetching, error, refetch } = useCustomers(table.apiParams);
  const [addOpen, setAddOpen] = useState(false);
  const rows = data?.data ?? [];

  const columns: Column<UserRow>[] = [
    {
      field: 'full_name', header: 'Customer', sortable: true,
      render: (r) => (
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ width: 34, height: 34, fontSize: '0.8rem', bgcolor: '#1E8E5A' }}>
            {initials(r.full_name)}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={600}>{r.full_name ?? '—'}</Typography>
            <Typography variant="caption" color="text.secondary">{r.email ?? ''}</Typography>
          </Box>
        </Stack>
      ),
    },
    { field: 'phone', header: 'Phone', render: (r) => r.phone ?? '—' },
    {
      field: 'customer_type', header: 'Type',
      render: (r) => <CustomerTypeChip type={r.customer_type} />,
    },
    { field: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
    {
      field: 'created_at', header: 'Joined', sortable: true,
      render: (r) => r.created_at ? formatDateTime(r.created_at, 'dd MMM yyyy') : '—',
    },
  ];

  const total = data?.meta.total ?? 0;
  const activeCount = rows.filter((r) => r.status === 'ACTIVE').length;
  const commercialCount = rows.filter((r) => r.customer_type === 'COMMERCIAL').length;
  const residentialCount = rows.filter((r) => r.customer_type === 'RESIDENTIAL').length;

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`${total} registered customers`}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
            Add Customer
          </Button>
        }
      />

      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap">
        {[
          { label: 'Total', value: total, color: 'default' as const },
          { label: 'Active', value: activeCount, color: 'success' as const },
          { label: 'Residential', value: residentialCount, color: 'info' as const },
          { label: 'Commercial', value: commercialCount, color: 'secondary' as const },
        ].map((s) => (
          <Chip key={s.label} label={`${s.label}: ${s.value}`} size="small" color={s.color} variant="outlined" />
        ))}
      </Stack>

      <SearchFilterBar search={table.search} onSearch={table.setSearch} placeholder="Search name, email, phone…">
        <TextField
          select size="small" label="Status" sx={{ minWidth: 140 }}
          value={table.filters.status ?? ''}
          onChange={(e) => table.setFilter('status', e.target.value || undefined)}
        >
          <MenuItem value="">All statuses</MenuItem>
          <MenuItem value="ACTIVE">Active</MenuItem>
          <MenuItem value="SUSPENDED">Suspended</MenuItem>
          <MenuItem value="DEACTIVATED">Deactivated</MenuItem>
        </TextField>
        <TextField
          select size="small" label="Type" sx={{ minWidth: 140 }}
          value={table.filters.customer_type ?? ''}
          onChange={(e) => table.setFilter('customer_type', e.target.value || undefined)}
        >
          <MenuItem value="">All types</MenuItem>
          <MenuItem value="RESIDENTIAL">Residential</MenuItem>
          <MenuItem value="COMMERCIAL">Commercial</MenuItem>
        </TextField>
      </SearchFilterBar>

      <DataTable<UserRow>
        columns={columns}
        rows={rows}
        total={total}
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
        onRowClick={(r) => navigate(`${paths.customers}/${r.id}`)}
        emptyMessage="No customers found"
      />

      <AddCustomerDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
