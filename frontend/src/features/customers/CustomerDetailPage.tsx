import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, IconButton, MenuItem, Stack, Tab, Tabs, TextField,
  Tooltip, Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import Business from '@mui/icons-material/Business';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import HomeIcon from '@mui/icons-material/Home';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { PageHeader, StatusChip, Can, useConfirm } from '@/components/common';
import { LoadingScreen, ErrorState } from '@/components/feedback';
import { DataTable, type Column } from '@/components/table/DataTable';
import { useServerTable } from '@/hooks/useServerTable';
import { Permission } from '@/features/auth/permissions';
import { formatDateTime, formatMoney } from '@/utils/format';
import { paths } from '@/routes/paths';
import {
  useCustomerProfile, useUpdateCustomerProfile,
  useCustomerAddresses, useCreateAddress, useUpdateAddress, useDeleteAddress,
  useCustomerBookings, useCustomerInvoices, useSetCustomerStatus,
  useCustomerStats, useCustomerReviews,
} from './hooks';
import type { AddressRow, CustomerProfile, CustomerReviewRow, InvoiceRow } from './types';
import type { BookingListItem } from '@/features/bookings/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={500}>{value || '—'}</Typography>
    </Box>
  );
}

function StarRating({ value }: { value?: number | null }) {
  const stars = Math.round(Number(value) || 0);
  return (
    <Stack direction="row" spacing={0.25}>
      {Array.from({ length: 5 }).map((_, i) =>
        i < stars
          ? <StarIcon key={i} sx={{ fontSize: 16, color: '#F5A623' }} />
          : <StarBorderIcon key={i} sx={{ fontSize: 16, color: 'text.disabled' }} />,
      )}
    </Stack>
  );
}

// ── Hero Stats ────────────────────────────────────────────────────────────────

function HeroStats({ userId }: { userId: string }) {
  const { data: stats, isLoading } = useCustomerStats(userId);

  const cards = [
    { label: 'Total Bookings', value: isLoading ? '…' : String(stats?.total_bookings ?? 0), icon: <CalendarMonthIcon />, color: '#1E8E5A' },
    { label: 'Completed', value: isLoading ? '…' : String(stats?.completed_bookings ?? 0), icon: <CheckCircleIcon />, color: '#4CAF50' },
    { label: 'Active', value: isLoading ? '…' : String(stats?.active_bookings ?? 0), icon: <TrendingUpIcon />, color: '#FF9800' },
    { label: 'Total Spend', value: isLoading ? '…' : formatMoney(stats?.total_spend ?? 0, 'INR'), icon: <ReceiptLongIcon />, color: '#9C27B0' },
  ];

  return (
    <Grid container spacing={1.5} sx={{ mb: 2 }}>
      {cards.map((c) => (
        <Grid key={c.label} size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined" sx={{ borderColor: `${c.color}30`, bgcolor: `${c.color}08` }}>
            <Box sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <Box sx={{ color: c.color, display: 'flex' }}>{c.icon}</Box>
                <Typography variant="caption" color="text.secondary">{c.label}</Typography>
              </Stack>
              <Typography variant="h5" fontWeight={800} sx={{ color: c.color }}>{c.value}</Typography>
            </Box>
          </Card>
        </Grid>
      ))}
      {stats && stats.reviews_count > 0 && (
        <Grid size={{ xs: 12 }}>
          <Card variant="outlined" sx={{ borderColor: '#F5A62330', bgcolor: '#F5A62308' }}>
            <Box sx={{ px: 2, py: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <StarRating value={Number(stats.avg_rating)} />
                <Typography variant="body2" fontWeight={700} sx={{ color: '#F5A623' }}>
                  {stats.avg_rating ?? '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  from {stats.reviews_count} review{stats.reviews_count !== 1 ? 's' : ''}
                </Typography>
              </Stack>
            </Box>
          </Card>
        </Grid>
      )}
    </Grid>
  );
}

// ── Edit Profile Dialog ───────────────────────────────────────────────────────

function EditProfileDialog({
  open, onClose, userId, profile,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  profile: CustomerProfile;
}) {
  const update = useUpdateCustomerProfile(userId);
  const [fullName, setFullName] = useState(profile.full_name ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [company, setCompany] = useState(profile.company_name ?? '');
  const [customerType, setCustomerType] = useState<string>(profile.customer_type ?? 'RESIDENTIAL');
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    try {
      await update.mutateAsync({
        ...(fullName.trim() !== profile.full_name ? { fullName: fullName.trim() } : {}),
        ...(phone.trim() !== (profile.phone ?? '') ? { phone: phone.trim() || undefined } : {}),
        ...(company.trim() !== (profile.company_name ?? '') ? { companyName: company.trim() || undefined } : {}),
        ...(customerType !== (profile.customer_type ?? 'RESIDENTIAL') ? { customerType } : {}),
      });
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save. Please try again.');
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
          <TextField select label="Customer type" fullWidth value={customerType} onChange={(e) => setCustomerType(e.target.value)}>
            <MenuItem value="RESIDENTIAL">Residential</MenuItem>
            <MenuItem value="COMMERCIAL">Commercial</MenuItem>
          </TextField>
          <TextField label="Company name" fullWidth value={company} onChange={(e) => setCompany(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={update.isPending}>Cancel</Button>
        <Button
          variant="contained" onClick={handleSave}
          disabled={update.isPending || !fullName.trim()}
          startIcon={update.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Address Form Dialog ───────────────────────────────────────────────────────

interface AddressFormState {
  label: string; line1: string; line2: string; city: string;
  state: string; postalCode: string; country: string; isDefault: boolean;
}

const emptyAddr = (): AddressFormState => ({
  label: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'IN', isDefault: false,
});

function AddressFormDialog({
  open, onClose, userId, existing,
}: {
  open: boolean; onClose: () => void; userId: string; existing?: AddressRow | null;
}) {
  const createAddr = useCreateAddress(userId);
  const updateAddr = useUpdateAddress(userId);
  const [form, setForm] = useState<AddressFormState>(() =>
    existing
      ? { label: existing.label ?? '', line1: existing.line1, line2: existing.line2 ?? '', city: existing.city, state: existing.state, postalCode: existing.postalCode, country: existing.country, isDefault: existing.isDefault }
      : emptyAddr(),
  );
  const [error, setError] = useState('');

  const set = (k: keyof AddressFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid = form.line1.trim() && form.city.trim() && form.state.trim() && form.postalCode.trim();

  const handleSave = async () => {
    setError('');
    try {
      const body = {
        ...(form.label.trim() ? { label: form.label.trim() } : {}),
        line1: form.line1.trim(),
        ...(form.line2.trim() ? { line2: form.line2.trim() } : {}),
        city: form.city.trim(), state: form.state.trim(),
        postalCode: form.postalCode.trim(), country: form.country.trim() || 'IN',
        isDefault: form.isDefault,
      };
      if (existing) { await updateAddr.mutateAsync({ addressId: existing.id, body }); }
      else { await createAddr.mutateAsync(body); }
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save address.');
    }
  };

  const isPending = createAddr.isPending || updateAddr.isPending;

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
            <TextField label="Postal code" fullWidth required value={form.postalCode} onChange={set('postalCode')} />
            <TextField label="Country" fullWidth value={form.country} onChange={set('country')} />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <input
              type="checkbox" id="isDefault" checked={form.isDefault}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <label htmlFor="isDefault" style={{ fontSize: 14, cursor: 'pointer' }}>Set as default address</label>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>Cancel</Button>
        <Button
          variant="contained" onClick={handleSave} disabled={!valid || isPending}
          startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────

function ProfileTab({ profile, userId }: { profile: CustomerProfile; userId: string }) {
  const [editOpen, setEditOpen] = useState(false);
  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">Account details</Typography>
        <Button size="small" startIcon={<EditIcon />} onClick={() => setEditOpen(true)}>Edit</Button>
      </Stack>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Status</Typography>
            <StatusChip status={profile.status ?? 'ACTIVE'} />
          </Stack>
          <Field label="Email" value={profile.email} />
          <Field label="Phone" value={profile.phone} />
          <Field label="Joined" value={profile.created_at ? formatDateTime(profile.created_at, 'dd MMM yyyy') : undefined} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Customer type</Typography>
            {profile.customer_type === 'COMMERCIAL' ? (
              <Chip size="small" icon={<Business sx={{ fontSize: '13px !important' }} />} label="Commercial" color="secondary" variant="outlined" />
            ) : (
              <Chip size="small" icon={<HomeIcon sx={{ fontSize: '13px !important' }} />} label="Residential" color="primary" variant="outlined" />
            )}
          </Stack>
          <Field label="Company" value={profile.company_name} />
          <Field label="Addresses" value={String(profile.address_count ?? 0)} />
          <Field label="Last updated" value={profile.updated_at ? formatDateTime(profile.updated_at, 'dd MMM yyyy') : undefined} />
        </Grid>
      </Grid>
      <EditProfileDialog open={editOpen} onClose={() => setEditOpen(false)} userId={userId} profile={profile} />
    </>
  );
}

// ── Addresses Tab ─────────────────────────────────────────────────────────────

function AddressesTab({ userId }: { userId: string }) {
  const { data: addresses = [], isLoading, error, refetch } = useCustomerAddresses(userId);
  const deleteAddr = useDeleteAddress(userId);
  const updateAddr = useUpdateAddress(userId);
  const confirm = useConfirm();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AddressRow | null>(null);

  const handleDelete = async (addr: AddressRow) => {
    const ok = await confirm({
      title: 'Delete address?',
      message: `This will remove "${addr.line1}, ${addr.city}" permanently.`,
      confirmText: 'Delete', destructive: true,
    });
    if (ok) await deleteAddr.mutateAsync(addr.id);
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
        {addresses.map((addr) => (
          <Card key={addr.id} variant="outlined">
            <CardContent sx={{ py: '12px !important', px: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    {addr.label && <Typography variant="body2" fontWeight={600}>{addr.label}</Typography>}
                    {addr.isDefault && (
                      <Chip
                        icon={<StarIcon sx={{ fontSize: '14px !important' }} />}
                        label="Default" size="small" color="primary"
                        sx={{ height: 20, fontSize: 11 }}
                      />
                    )}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {addr.city}, {addr.state} {addr.postalCode} — {addr.country}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.5}>
                  {!addr.isDefault && (
                    <Tooltip title="Set as default">
                      <IconButton size="small" onClick={() => updateAddr.mutateAsync({ addressId: addr.id, body: { isDefault: true } })} disabled={updateAddr.isPending}>
                        <StarIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => setEditTarget(addr)}><EditIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => handleDelete(addr)} disabled={deleteAddr.isPending}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <AddressFormDialog open={addOpen} onClose={() => setAddOpen(false)} userId={userId} />
      {editTarget && (
        <AddressFormDialog open={Boolean(editTarget)} onClose={() => setEditTarget(null)} userId={userId} existing={editTarget} />
      )}
    </>
  );
}

// ── Bookings Tab ──────────────────────────────────────────────────────────────

const BOOKING_STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function BookingsTab({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const table = useServerTable({ defaultLimit: 10, filterKeys: ['status'] });
  const { data, isLoading, isFetching, error, refetch } = useCustomerBookings(userId, table.apiParams);

  const columns: Column<BookingListItem>[] = [
    {
      field: 'booking_number', header: 'Booking #',
      render: (r) => (
        <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace', letterSpacing: 0.5 }}>
          {(r as BookingListItem & { booking_number?: string }).booking_number ?? r.id.slice(0, 8).toUpperCase()}
        </Typography>
      ),
    },
    { field: 'service_name', header: 'Service', render: (r) => r.service_name ?? '—' },
    {
      field: 'scheduled_window_start', header: 'Scheduled', sortable: true,
      render: (r) => r.scheduled_window_start ? formatDateTime(r.scheduled_window_start, 'dd MMM yyyy, HH:mm') : '—',
    },
    { field: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
    { field: 'price', header: 'Amount', align: 'right', render: (r) => formatMoney(r.price, r.currency) },
  ];

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {data?.meta.total ?? 0} booking{(data?.meta.total ?? 0) !== 1 ? 's' : ''}
        </Typography>
        <TextField
          select size="small" label="Status" sx={{ minWidth: 160 }}
          value={table.filters.status ?? ''}
          onChange={(e) => table.setFilter('status', e.target.value || undefined)}
        >
          {BOOKING_STATUSES.map((s) => (
            <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
          ))}
        </TextField>
      </Stack>
      <DataTable<BookingListItem>
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
        onRowClick={(r) => navigate(`${paths.bookings}/${r.id}`)}
        emptyMessage="No bookings yet"
      />
    </>
  );
}

// ── Reviews Tab ───────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  PENDING: 'warning',
  PUBLISHED: 'success',
  HIDDEN: 'default',
  FLAGGED: 'error',
};

function ReviewsTab({ userId }: { userId: string }) {
  const table = useServerTable({ defaultLimit: 10 });
  const { data, isLoading, isFetching, error, refetch } = useCustomerReviews(userId, table.apiParams);

  const columns: Column<CustomerReviewRow>[] = [
    {
      field: 'rating', header: 'Rating',
      render: (r) => <StarRating value={r.rating} />,
    },
    {
      field: 'comment', header: 'Comment',
      render: (r) => (
        <Typography variant="body2" color={r.comment ? 'text.primary' : 'text.disabled'}
          sx={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.comment ?? 'No comment'}
        </Typography>
      ),
    },
    {
      field: 'status', header: 'Status',
      render: (r) => <Chip size="small" label={r.status} color={STATUS_COLOR[r.status] ?? 'default'} />,
    },
    { field: 'technician_name', header: 'Technician', render: (r) => r.technician_name ?? '—' },
    {
      field: 'created_at', header: 'Date', sortable: true,
      render: (r) => formatDateTime(r.created_at, 'dd MMM yyyy'),
    },
  ];

  return (
    <DataTable<CustomerReviewRow>
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
      emptyMessage="No reviews yet"
    />
  );
}

// ── Invoices/Payments Tab ─────────────────────────────────────────────────────

function PaymentsTab({ userId }: { userId: string }) {
  const table = useServerTable({ defaultLimit: 10 });
  const { data, isLoading, isFetching, error, refetch } = useCustomerInvoices(userId, table.apiParams);

  const columns: Column<InvoiceRow>[] = [
    { field: 'invoice_number', header: 'Invoice', render: (r) => r.invoice_number ?? r.id.slice(0, 8) },
    {
      field: 'created_at', header: 'Date', sortable: true,
      render: (r) => r.created_at ? formatDateTime(r.created_at, 'dd MMM yyyy') : '—',
    },
    { field: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
    { field: 'total_amount', header: 'Total', align: 'right', render: (r) => formatMoney(r.total_amount, r.currency) },
  ];

  return (
    <DataTable<InvoiceRow>
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

const TABS = ['Profile', 'Addresses', 'Bookings', 'Reviews', 'Payments'] as const;

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const confirm = useConfirm();
  const [tab, setTab] = useState(0);

  const { data: profile, isLoading, error, refetch } = useCustomerProfile(id);
  const setStatus = useSetCustomerStatus();

  if (isLoading) return <LoadingScreen />;
  if (error || !profile) return <ErrorState error={error} onRetry={refetch} />;

  const isActive = (profile.status ?? 'ACTIVE') === 'ACTIVE';

  const toggleStatus = async () => {
    const next = isActive ? 'SUSPENDED' : 'ACTIVE';
    const ok = await confirm({
      title: isActive ? 'Suspend customer?' : 'Reactivate customer?',
      message: isActive
        ? 'Suspending blocks sign-in and revokes active sessions.'
        : 'Reactivating restores account access.',
      confirmText: isActive ? 'Suspend' : 'Reactivate',
      destructive: isActive,
    });
    if (ok) await setStatus.mutateAsync({ userId: id, status: next });
  };

  return (
    <>
      <PageHeader
        title={profile.full_name ?? 'Customer'}
        subtitle={profile.email}
        crumbs={[{ label: 'Customers', to: paths.customers }, { label: profile.full_name ?? 'Detail' }]}
        actions={
          <Stack direction="row" spacing={1}>
            <Can permission={Permission.SuspendUsers}>
              <Button
                variant="outlined"
                color={isActive ? 'error' : 'success'}
                startIcon={isActive ? <BlockIcon /> : <CheckCircleIcon />}
                onClick={toggleStatus}
                disabled={setStatus.isPending}
              >
                {isActive ? 'Suspend' : 'Reactivate'}
              </Button>
            </Can>
          </Stack>
        }
      />

      <HeroStats userId={id} />

      <Card>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
          variant="scrollable"
          scrollButtons="auto"
        >
          {TABS.map((label) => <Tab key={label} label={label} />)}
        </Tabs>

        <Divider />

        <CardContent sx={{ pt: 2.5 }}>
          {tab === 0 && <ProfileTab profile={profile} userId={id} />}
          {tab === 1 && <AddressesTab userId={id} />}
          {tab === 2 && <BookingsTab userId={id} />}
          {tab === 3 && <ReviewsTab userId={id} />}
          {tab === 4 && <PaymentsTab userId={id} />}
        </CardContent>
      </Card>
    </>
  );
}
