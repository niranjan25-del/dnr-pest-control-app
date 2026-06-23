// src/features/technicians/TechniciansListPage.tsx
import { useState } from 'react';
import {
  Avatar, Box, Button, Card, CardActionArea, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid2 as Grid, InputAdornment, LinearProgress,
  MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import GridViewIcon from '@mui/icons-material/GridView';
import ListIcon from '@mui/icons-material/List';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Column } from '@/components/table/DataTable';
import { PageHeader, StatusChip } from '@/components/common';
import { useServerTable } from '@/hooks/useServerTable';
import { paths } from '@/routes/paths';
import { BRAND } from '@/theme/theme';
import { useTechnicians, useCreateTechnician } from './hooks';
import type { TechnicianRow } from './types';

function techInitials(name?: string) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function avatarColor(name?: string) {
  const colors = [BRAND[500], BRAND[600], BRAND[700], '#2F4B6E', '#7B3F9E', '#D4763B'];
  const idx = (name?.charCodeAt(0) ?? 0) % colors.length;
  return colors[idx];
}

function RatingDisplay({ value }: { value?: number }) {
  if (value == null) return <Typography variant="caption" color="text.disabled">No rating</Typography>;
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <StarRoundedIcon sx={{ fontSize: 16, color: '#F5A623' }} />
      <Typography variant="body2" fontWeight={600}>{value.toFixed(1)}</Typography>
    </Stack>
  );
}

function DutyDot({ onDuty }: { onDuty?: boolean }) {
  return (
    <Tooltip title={onDuty ? 'Currently on duty' : 'Not on duty today'}>
      <FiberManualRecordIcon
        sx={{ fontSize: 12, color: onDuty ? 'success.main' : 'text.disabled', verticalAlign: 'middle' }}
      />
    </Tooltip>
  );
}

function TechnicianCard({ tech, onClick }: { tech: TechnicianRow; onClick: () => void }) {
  const active = tech.active_jobs ?? 0;
  const total = Math.max(active, 5);
  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea onClick={onClick} sx={{ height: '100%', p: 2.5 }}>
        <Stack spacing={2} height="100%">
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Avatar sx={{ width: 52, height: 52, bgcolor: avatarColor(tech.full_name), fontSize: '1.1rem', fontWeight: 700 }}>
              {techInitials(tech.full_name)}
            </Avatar>
            <Stack alignItems="flex-end" spacing={0.5}>
              <StatusChip status={tech.status} />
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <DutyDot onDuty={tech.on_duty} />
                <Typography variant="caption" color="text.secondary">
                  {tech.on_duty ? 'On duty' : 'Off duty'}
                </Typography>
              </Stack>
            </Stack>
          </Stack>
          <Box>
            <Typography variant="h4" noWrap>{tech.full_name ?? '—'}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>{tech.email ?? '—'}</Typography>
            {tech.phone && <Typography variant="body2" color="text.secondary">{tech.phone}</Typography>}
          </Box>
          <RatingDisplay value={tech.rating} />
          <Box>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <WorkOutlineIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">Active jobs</Typography>
              </Stack>
              <Typography variant="caption" fontWeight={600}>{active}</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min((active / total) * 100, 100)}
              sx={{ borderRadius: 4, height: 5, bgcolor: 'divider', '& .MuiLinearProgress-bar': { borderRadius: 4 } }}
            />
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

const LIST_COLUMNS: Column<TechnicianRow>[] = [
  {
    field: 'full_name', header: 'Technician', sortable: true,
    render: (r) => (
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Avatar sx={{ width: 34, height: 34, fontSize: '0.8rem', bgcolor: avatarColor(r.full_name) }}>
          {techInitials(r.full_name)}
        </Avatar>
        <Box>
          <Typography variant="body2" fontWeight={600}>{r.full_name ?? '—'}</Typography>
          <Typography variant="caption" color="text.secondary">{r.email ?? ''}</Typography>
        </Box>
      </Stack>
    ),
  },
  { field: 'phone', header: 'Phone', render: (r) => r.phone ?? '—' },
  { field: 'rating', header: 'Rating', render: (r) => <RatingDisplay value={r.rating} /> },
  {
    field: 'on_duty', header: 'Duty status',
    render: (r) => (
      <Chip
        size="small"
        icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important' }} />}
        label={r.on_duty ? 'On duty' : 'Off duty'}
        color={r.on_duty ? 'success' : 'default'}
        variant="outlined"
      />
    ),
  },
  {
    field: 'active_jobs', header: 'Active Jobs',
    render: (r) => (
      <Chip size="small" label={r.active_jobs ?? 0} variant="filled"
        color={(r.active_jobs ?? 0) > 3 ? 'warning' : 'default'} />
    ),
  },
  { field: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
];

// ── Add Technician Dialog ─────────────────────────────────────────────────────

interface AddTechForm {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  licenseNumber: string;
  skills: string;
}

const EMPTY_FORM: AddTechForm = { fullName: '', email: '', password: '', phone: '', licenseNumber: '', skills: '' };

function AddTechnicianDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateTechnician();
  const [form, setForm] = useState<AddTechForm>(EMPTY_FORM);
  const [err, setErr] = useState('');

  const set = (k: keyof AddTechForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setErr('');
    if (!form.fullName || !form.email || !form.password) {
      setErr('Name, email, and password are required.');
      return;
    }
    try {
      await create.mutateAsync({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        licenseNumber: form.licenseNumber || undefined,
        skills: form.skills ? form.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
      });
      setForm(EMPTY_FORM);
      onClose();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message;
      setErr(msg ?? 'Failed to create technician. Try again.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Technician</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {err && <Typography color="error" variant="body2">{err}</Typography>}
          <TextField label="Full name *" value={form.fullName} onChange={set('fullName')} fullWidth />
          <TextField label="Email *" type="email" value={form.email} onChange={set('email')} fullWidth />
          <TextField label="Password *" type="password" value={form.password} onChange={set('password')} fullWidth helperText="Min 8 characters" />
          <TextField label="Phone" value={form.phone} onChange={set('phone')} fullWidth placeholder="+91XXXXXXXXXX" />
          <TextField label="License number" value={form.licenseNumber} onChange={set('licenseNumber')} fullWidth />
          <TextField label="Skills" value={form.skills} onChange={set('skills')} fullWidth placeholder="General Pest Control, Termite Treatment" helperText="Comma-separated" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create technician'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function TechniciansListPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [addOpen, setAddOpen] = useState(false);
  const table = useServerTable({ filterKeys: ['status', 'is_available'] });
  const { data, isLoading, isFetching, error, refetch } = useTechnicians(table.apiParams);
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Technicians"
        subtitle={`${data?.meta.total ?? 0} registered field technicians`}
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }} alignItems={{ sm: 'center' }} flexWrap="wrap">
        <TextField
          placeholder="Search name, email, phone…"
          size="small"
          value={table.search}
          onChange={(e) => table.setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ minWidth: 240 }}
        />
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
          select size="small" label="Duty status" sx={{ minWidth: 150 }}
          value={table.filters.is_available ?? ''}
          onChange={(e) => table.setFilter('is_available', e.target.value || undefined)}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="true">On duty</MenuItem>
          <MenuItem value="false">Off duty</MenuItem>
        </TextField>
        <Box sx={{ flex: 1 }} />
        <ToggleButtonGroup size="small" value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)}>
          <ToggleButton value="grid"><GridViewIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="list"><ListIcon fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
        <Button variant="contained" size="small" disableElevation onClick={() => setAddOpen(true)}>
          + Add technician
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 2.5 }} flexWrap="wrap">
        {[
          { label: 'Total', value: data?.meta.total ?? 0, color: 'default' as const },
          { label: 'On duty now', value: rows.filter((r) => r.on_duty).length, color: 'success' as const },
          { label: 'Active jobs', value: rows.reduce((s, r) => s + (r.active_jobs ?? 0), 0), color: 'info' as const },
        ].map((s) => (
          <Chip key={s.label} label={`${s.label}: ${s.value}`} size="small" color={s.color} variant="outlined" />
        ))}
      </Stack>

      {viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Grid key={i} size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
                  <Card sx={{ height: 220, bgcolor: 'action.hover' }} />
                </Grid>
              ))
            : rows.map((tech) => (
                <Grid key={tech.id} size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
                  <TechnicianCard tech={tech} onClick={() => navigate(`${paths.technicians}/${tech.id}`)} />
                </Grid>
              ))}
        </Grid>
      ) : (
        <DataTable<TechnicianRow>
          columns={LIST_COLUMNS}
          rows={rows}
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
          onRowClick={(r) => navigate(`${paths.technicians}/${r.id}`)}
          emptyMessage="No technicians found"
        />
      )}

      <AddTechnicianDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}