import { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, IconButton, Stack, Tab, Tabs, TextField,
  Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import HomeIcon from '@mui/icons-material/Home';
import PersonIcon from '@mui/icons-material/Person';
import ReceiptIcon from '@mui/icons-material/Receipt';
import StarIcon from '@mui/icons-material/Star';
import { DataTable, type Column } from '@/components/table/DataTable';
import { StatusChip, useConfirm } from '@/components/common';
import { LoadingScreen, ErrorState } from '@/components/feedback';
import { useServerTable } from '@/hooks/useServerTable';
import { formatDateTime, formatMoney } from '@/utils/format';
import {
  useMyProfile, useUpdateMyProfile,
  useMyAddresses, useCreateMyAddress, useUpdateMyAddress, useDeleteMyAddress,
  useMyInvoices,
} from './hooks';
import type { CustomerAddress, CustomerInvoice } from './types';

// ── Edit Profile Dialog ───────────────────────────────────────────────────────

function EditProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: profile } = useMyProfile();
  const update = useUpdateMyProfile();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [company, setCompany] = useState(profile?.company_name ?? '');
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    try {
      await update.mutateAsync({
        ...(fullName.trim() !== profile?.full_name ? { full_name: fullName.trim() } : {}),
        ...(phone.trim() !== (profile?.phone ?? '') ? { phone: phone.trim() || undefined } : {}),
        ...(company.trim() !== (profile?.company_name ?? '') ? { company_name: company.trim() || undefined } : {}),
      });
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Edit Profile</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Full name" fullWidth value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <TextField label="Phone" fullWidth value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
          <TextField label="Company name" fullWidth value={company} onChange={(e) => setCompany(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={update.isPending}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={update.isPending || !fullName.trim()}
          startIcon={update.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}>
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Address Dialog ────────────────────────────────────────────────────────────

interface AddrForm {
  label: string; line1: string; line2: string; city: string;
  state: string; postal_code: string; country: string; is_default: boolean;
}
const emptyForm = (): AddrForm => ({ label: '', line1: '', line2: '', city: '', state: '', postal_code: '', country: 'IN', is_default: false });

function AddressDialog({ open, onClose, existing }: { open: boolean; onClose: () => void; existing?: CustomerAddress | null }) {
  const create = useCreateMyAddress();
  const update = useUpdateMyAddress();
  const [form, setForm] = useState<AddrForm>(() =>
    existing ? {
      label: existing.label ?? '', line1: existing.line1, line2: existing.line2 ?? '',
      city: existing.city, state: existing.state,
      postal_code: existing.postalCode ?? existing.postal_code ?? '',
      country: existing.country, is_default: existing.isDefault ?? existing.is_default ?? false,
    } : emptyForm()
  );
  const [error, setError] = useState('');

  const set = (k: keyof AddrForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid = form.line1.trim() && form.city.trim() && form.state.trim() && form.postal_code.trim();

  const handleSave = async () => {
    setError('');
    try {
      const body = {
        ...(form.label.trim() ? { label: form.label.trim() } : {}),
        line1: form.line1.trim(),
        ...(form.line2.trim() ? { line2: form.line2.trim() } : {}),
        city: form.city.trim(), state: form.state.trim(),
        postal_code: form.postal_code.trim(), country: form.country || 'IN',
        is_default: form.is_default,
      };
      if (existing) { await update.mutateAsync({ id: existing.id, body }); }
      else { await create.mutateAsync(body as Parameters<typeof create.mutateAsync>[0]); }
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save address.');
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{existing ? 'Edit Address' : 'Add Address'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Label (optional)" placeholder="Home, Office…" fullWidth value={form.label} onChange={set('label')} />
          <TextField label="Line 1" fullWidth required value={form.line1} onChange={set('line1')} />
          <TextField label="Line 2 (optional)" fullWidth value={form.line2} onChange={set('line2')} />
          <Stack direction="row" spacing={1.5}>
            <TextField label="City" fullWidth required value={form.city} onChange={set('city')} />
            <TextField label="State" fullWidth required value={form.state} onChange={set('state')} />
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <TextField label="Postal code" fullWidth required value={form.postal_code} onChange={set('postal_code')} />
            <TextField label="Country" fullWidth value={form.country} onChange={set('country')} />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <input type="checkbox" id="isDef" checked={form.is_default}
              onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <label htmlFor="isDef" style={{ fontSize: 14, cursor: 'pointer' }}>Set as default address</label>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!valid || isPending}
          startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────

function ProfileTab() {
  const { data: profile, isLoading, error, refetch } = useMyProfile();
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) return <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={24} /></Box>;
  if (error || !profile) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">Personal details</Typography>
        <Button size="small" startIcon={<EditIcon />} onClick={() => setEditOpen(true)}>Edit</Button>
      </Stack>

      <Stack spacing={1.5}>
        {[
          { label: 'Full name', value: profile.full_name },
          { label: 'Email', value: profile.email },
          { label: 'Phone', value: profile.phone },
          ...(profile.customer_type === 'COMMERCIAL' || profile.company_name
            ? [{ label: 'Company', value: profile.company_name }]
            : []),
        ].map((f) => (
          <Box key={f.label}>
            <Typography variant="caption" color="text.secondary">{f.label}</Typography>
            <Typography variant="body2" fontWeight={500}>{f.value || '—'}</Typography>
          </Box>
        ))}
        <Box>
          <Typography variant="caption" color="text.secondary">Status</Typography>
          <Box mt={0.5}><StatusChip status={profile.status ?? 'ACTIVE'} /></Box>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Member since</Typography>
          <Typography variant="body2" fontWeight={500}>
            {profile.created_at ? formatDateTime(profile.created_at, 'dd MMM yyyy') : '—'}
          </Typography>
        </Box>
      </Stack>

      <EditProfileDialog open={editOpen} onClose={() => setEditOpen(false)} />
    </>
  );
}

// ── Addresses Tab ─────────────────────────────────────────────────────────────

function AddressesTab() {
  const { data: addresses = [], isLoading, error, refetch } = useMyAddresses();
  const del = useDeleteMyAddress();
  const upd = useUpdateMyAddress();
  const confirm = useConfirm();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomerAddress | null>(null);

  const handleDelete = async (a: CustomerAddress) => {
    const ok = await confirm({ title: 'Delete address?', message: `Remove "${a.line1}, ${a.city}"?`, confirmText: 'Delete', destructive: true });
    if (ok) await del.mutateAsync(a.id);
  };

  if (isLoading) return <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={24} /></Box>;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {addresses.length} address{addresses.length !== 1 ? 'es' : ''}
        </Typography>
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Add Address
        </Button>
      </Stack>

      {addresses.length === 0 && (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <HomeIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">No addresses saved yet.</Typography>
        </Box>
      )}

      <Stack spacing={1.5}>
        {addresses.map((addr) => {
          const isDefault = addr.isDefault ?? addr.is_default ?? false;
          const postalCode = addr.postalCode ?? addr.postal_code ?? '';
          return (
            <Card key={addr.id} variant="outlined">
              <CardContent sx={{ py: '12px !important', px: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      {addr.label && <Typography variant="body2" fontWeight={600}>{addr.label}</Typography>}
                      {isDefault && (
                        <Chip icon={<StarIcon sx={{ fontSize: '14px !important' }} />} label="Default"
                          size="small" color="primary" sx={{ height: 20, fontSize: 11 }} />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {addr.city}, {addr.state} {postalCode} — {addr.country}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    {!isDefault && (
                      <Tooltip title="Set as default">
                        <IconButton size="small"
                          onClick={() => upd.mutateAsync({ id: addr.id, body: { is_default: true } })}
                          disabled={upd.isPending}>
                          <StarIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => setEditTarget(addr)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDelete(addr)} disabled={del.isPending}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <AddressDialog open={addOpen} onClose={() => setAddOpen(false)} />
      {editTarget && (
        <AddressDialog open={Boolean(editTarget)} onClose={() => setEditTarget(null)} existing={editTarget} />
      )}
    </>
  );
}

// ── Invoices Tab ──────────────────────────────────────────────────────────────

function InvoicesTab() {
  const table = useServerTable({ defaultLimit: 10 });
  const { data, isLoading, isFetching, error, refetch } = useMyInvoices(table.apiParams);

  const columns: Column<CustomerInvoice>[] = [
    { field: 'invoice_number', header: 'Invoice', render: (r) => r.invoice_number ?? r.id.slice(0, 8) },
    {
      field: 'created_at', header: 'Date', sortable: true,
      render: (r) => r.created_at ? formatDateTime(r.created_at, 'dd MMM yyyy') : '—',
    },
    { field: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
    { field: 'total_amount', header: 'Total', align: 'right', render: (r) => formatMoney(r.total_amount, r.currency) },
  ];

  return (
    <DataTable<CustomerInvoice>
      columns={columns}
      rows={data?.data ?? []}
      total={data?.meta.total ?? 0}
      loading={isLoading || isFetching}
      error={error}
      onRetry={refetch}
      page={table.page}
      limit={table.limit}
      order={table.order}
      onSort={table.setSort}
      onPageChange={table.setPage}
      onLimitChange={table.setLimit}
      getRowId={(r) => r.id}
      emptyMessage="No invoices yet"
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { label: 'Profile', icon: <PersonIcon sx={{ fontSize: 18 }} /> },
  { label: 'Addresses', icon: <HomeIcon sx={{ fontSize: 18 }} /> },
  { label: 'Invoices', icon: <ReceiptIcon sx={{ fontSize: 18 }} /> },
] as const;

export function CustomerProfilePage() {
  const [tab, setTab] = useState(0);
  const { isLoading, error, refetch } = useMyProfile();

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 3 }}>My Profile</Typography>

      <Card>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          {TABS.map((t) => (
            <Tab key={t.label} label={t.label} icon={t.icon} iconPosition="start" />
          ))}
        </Tabs>

        <Divider />

        <CardContent sx={{ pt: 2.5 }}>
          {tab === 0 && <ProfileTab />}
          {tab === 1 && <AddressesTab />}
          {tab === 2 && <InvoicesTab />}
        </CardContent>
      </Card>
    </Box>
  );
}
