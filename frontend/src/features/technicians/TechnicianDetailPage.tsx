// src/features/technicians/TechnicianDetailPage.tsx
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Autocomplete, Avatar, Box, Button, Card, CardContent, Chip,
  Divider, Grid2 as Grid, LinearProgress, Stack, Tab, Tabs,
  TextField, Tooltip, Typography,
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import VerifiedIcon from '@mui/icons-material/Verified';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import BadgeIcon from '@mui/icons-material/Badge';
import PlaceIcon from '@mui/icons-material/Place';
import { PageHeader, Can, useConfirm } from '@/components/common';
import { LoadingScreen, ErrorState } from '@/components/feedback';
import { Permission } from '@/features/auth/permissions';
import { formatDateTime } from '@/utils/format';
import { paths } from '@/routes/paths';
import { BRAND } from '@/theme/theme';
import {
  useTechnicianProfile, useServiceAreas, useUpdateTechnician,
  useSetTechnicianStatus, useTechnicianJobs,
} from './hooks';
import { useTechnicianAttendance } from '@/features/attendance/hooks';
import type { ServiceArea, TechnicianJobRow } from './types';
import type { DutyLog } from '@/features/attendance/types';

// ── helpers ─────────────────────────────────────────────────────────────────

function techInitials(name?: string) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ py: 1 }}>
      <Box sx={{ color: 'text.secondary', mt: 0.1 }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
        <Typography variant="body2" fontWeight={500}>{value || '—'}</Typography>
      </Box>
    </Stack>
  );
}

function StatCard({ label, value, sub, color = 'primary.main' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent sx={{ py: 2 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h2" sx={{ color, mt: 0.5 }}>{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

function JobStatusChip({ status }: { status: string }) {
  const colorMap: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    COMPLETED: 'success', IN_PROGRESS: 'info', ARRIVED: 'info', EN_ROUTE: 'info',
    CONFIRMED: 'warning', PENDING: 'default', CANCELLED: 'error', NO_SHOW: 'error',
  };
  return <Chip size="small" label={status.replace(/_/g, ' ')} color={colorMap[status] ?? 'default'} variant="outlined" />;
}

// ── tabs ────────────────────────────────────────────────────────────────────

function OverviewTab({ id }: { id: string }) {
  const { data: tech } = useTechnicianProfile(id);
  const { data: allAreas } = useServiceAreas();
  const update = useUpdateTechnician(id);
  const [editingAreas, setEditingAreas] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<ServiceArea[]>([]);
  const assignedAreas = useMemo(() => tech?.service_areas ?? [], [tech]);

  const startEdit = () => { setSelectedAreas(assignedAreas); setEditingAreas(true); };
  const save = async () => { await update.mutateAsync({ service_area_ids: selectedAreas.map((a) => a.id) }); setEditingAreas(false); };

  if (!tech) return null;

  const licenseExpiry = tech.license_expiry ? new Date(tech.license_expiry) : null;
  const licenseWarn = licenseExpiry && licenseExpiry < new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  return (
    <Grid container spacing={2} sx={{ mt: 0 }}>
      {/* Contact */}
      <Grid size={{ xs: 12, md: 5 }}>
        <Card>
          <CardContent>
            <Typography variant="h4" gutterBottom>Contact & identity</Typography>
            <Divider sx={{ mb: 1.5 }} />
            <InfoRow icon={<EmailIcon fontSize="small" />} label="Email" value={tech.email} />
            <InfoRow icon={<PhoneIcon fontSize="small" />} label="Phone" value={tech.phone} />
            <InfoRow
              icon={<BadgeIcon fontSize="small" color={licenseWarn ? 'error' : undefined} />}
              label="License"
              value={[tech.license_number, licenseExpiry ? `Expires ${formatDateTime(licenseExpiry.toISOString(), 'dd MMM yyyy')}` : null].filter(Boolean).join('  ·  ')}
            />
            {tech.joined_at && (
              <InfoRow icon={<VerifiedIcon fontSize="small" />} label="Joined" value={formatDateTime(tech.joined_at, 'dd MMM yyyy')} />
            )}
            {licenseWarn && (
              <Chip size="small" color="warning" label="License expiring soon" sx={{ mt: 1 }} />
            )}
          </CardContent>
        </Card>

        {/* Skills */}
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h4" gutterBottom>Skills & certifications</Typography>
            <Divider sx={{ mb: 1.5 }} />
            <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap sx={{ mb: 2 }}>
              {(tech.skills ?? []).length === 0
                ? <Typography variant="body2" color="text.secondary">No skills listed</Typography>
                : tech.skills!.map((s) => <Chip key={s} label={s} size="small" variant="outlined" />)}
            </Stack>
            {(tech.certifications ?? []).map((c) => (
              <InfoRow
                key={c.name}
                icon={<VerifiedIcon fontSize="small" />}
                label={c.name}
                value={[c.number, c.expiry ? `exp ${formatDateTime(c.expiry, 'dd MMM yyyy')}` : null].filter(Boolean).join(' · ')}
              />
            ))}
          </CardContent>
        </Card>
      </Grid>

      {/* Service areas + performance */}
      <Grid size={{ xs: 12, md: 7 }}>
        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="h4">Service areas</Typography>
              <Can permission={Permission.ManageTechnicians}>
                {!editingAreas
                  ? <Button size="small" onClick={startEdit}>Edit areas</Button>
                  : <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => setEditingAreas(false)}>Cancel</Button>
                      <Button size="small" variant="contained" onClick={save} disabled={update.isPending}>Save</Button>
                    </Stack>}
              </Can>
            </Stack>
            <Divider sx={{ mb: 1.5 }} />
            {!editingAreas ? (
              <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
                {assignedAreas.length === 0
                  ? <Typography variant="body2" color="text.secondary">No service areas assigned</Typography>
                  : assignedAreas.map((a) => (
                      <Chip key={a.id} icon={<PlaceIcon sx={{ fontSize: '14px !important' }} />} label={a.name} size="small" />
                    ))}
              </Stack>
            ) : (
              <Autocomplete
                multiple options={allAreas ?? []}
                getOptionLabel={(o) => o.name}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={selectedAreas}
                onChange={(_, v) => setSelectedAreas(v)}
                renderInput={(params) => <TextField {...params} label="Assigned areas" placeholder="Add area…" />}
              />
            )}
          </CardContent>
        </Card>

        {/* Quick performance */}
        {(tech.rating != null || tech.completed_jobs != null || tech.on_time_rate != null) && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h4" gutterBottom>Performance snapshot</Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={1.5}>
                {tech.rating != null && (
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <StatCard label="Avg rating" value={tech.rating.toFixed(1)} sub="out of 5" color="warning.main" />
                  </Grid>
                )}
                {tech.completed_jobs != null && (
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <StatCard label="Jobs completed" value={String(tech.completed_jobs)} />
                  </Grid>
                )}
                {tech.on_time_rate != null && (
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <StatCard label="On-time rate" value={`${Math.round(tech.on_time_rate * 100)}%`} color="success.main" />
                  </Grid>
                )}
                {tech.active_jobs != null && (
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <StatCard label="Active now" value={String(tech.active_jobs)} color="info.main" />
                  </Grid>
                )}
              </Grid>
              {tech.on_time_rate != null && (
                <Box sx={{ mt: 2 }}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">On-time delivery</Typography>
                    <Typography variant="caption" fontWeight={700} color="success.main">
                      {Math.round(tech.on_time_rate * 100)}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={tech.on_time_rate * 100}
                    color="success"
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                Detailed analytics available in the Analytics module.
              </Typography>
            </CardContent>
          </Card>
        )}
      </Grid>
    </Grid>
  );
}

function JobsTab({ id }: { id: string }) {
  const [status, setStatus] = useState('');
  const { data, isLoading, isFetching } = useTechnicianJobs(id, status ? { status } : undefined);
  const jobs: TechnicianJobRow[] = data?.data ?? [];

  return (
    <Box sx={{ mt: 2 }}>
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} alignItems="center">
        {['', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => (
          <Chip
            key={s} size="small"
            label={s ? s.replace(/_/g, ' ') : 'All'}
            color={status === s ? 'primary' : 'default'}
            variant={status === s ? 'filled' : 'outlined'}
            onClick={() => setStatus(s)}
            clickable
          />
        ))}
      </Stack>

      {(isLoading || isFetching) && <LinearProgress sx={{ mb: 2 }} />}

      <Stack spacing={1.5}>
        {jobs.length === 0 && !isLoading && (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <WorkOutlineIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">No jobs found</Typography>
            </CardContent>
          </Card>
        )}
        {jobs.map((j) => (
          <Card key={j.id}>
            <CardContent sx={{ py: '12px !important' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <JobStatusChip status={j.status} />
                    <Typography variant="body2" fontWeight={600} noWrap>{j.service_name ?? 'Service'}</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" noWrap>{j.customer_name ?? '—'}</Typography>
                  {j.address_line && (
                    <Typography variant="caption" color="text.disabled" noWrap>{j.address_line}</Typography>
                  )}
                </Box>
                <Box sx={{ ml: 2, textAlign: 'right', flexShrink: 0 }}>
                  {j.scheduled_window_start && (
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(j.scheduled_window_start, 'dd MMM · HH:mm')}
                    </Typography>
                  )}
                  {j.total_amount != null && (
                    <Typography variant="body2" fontWeight={600}>₹{j.total_amount.toLocaleString()}</Typography>
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}

// ── attendance tab ────────────────────────────────────────────────────────────

function monthAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}
function todayStr() { return new Date().toISOString().slice(0, 10); }

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDuration(min: number | null) {
  if (min == null) return '—';
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function AttendanceTab({ userId }: { userId: string }) {
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo]     = useState(todayStr);
  const { data, isLoading } = useTechnicianAttendance(userId, { from, to });
  const logs: DutyLog[] = data?.data ?? [];

  const totalMin = logs.reduce((s, r) => s + (r.duration_minutes ?? 0), 0);
  const daysPresent = logs.length;

  return (
    <Box sx={{ mt: 2 }}>
      {/* Filters */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2} alignItems="center">
        <TextField label="From" type="date" size="small" InputLabelProps={{ shrink: true }}
          value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }} />
        <TextField label="To" type="date" size="small" InputLabelProps={{ shrink: true }}
          value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }} />
        <Box flex={1} />
        <Stack direction="row" spacing={2}>
          <Box textAlign="center">
            <Typography variant="h3" fontWeight={700} color="primary.main">{daysPresent}</Typography>
            <Typography variant="caption" color="text.secondary">Days present</Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="h3" fontWeight={700}>{fmtDuration(totalMin)}</Typography>
            <Typography variant="caption" color="text.secondary">Total hours</Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="h3" fontWeight={700} color="success.main">
              {daysPresent > 0 ? fmtDuration(Math.round(totalMin / daysPresent)) : '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary">Avg shift</Typography>
          </Box>
        </Stack>
      </Stack>

      {isLoading ? (
        <LinearProgress />
      ) : logs.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 5 }}>
            <WorkOutlineIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">No attendance records for this period</Typography>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Stack divider={<Divider />}>
            {logs.map((log) => (
              <Stack key={log.id} direction="row" alignItems="center" sx={{ px: 2.5, py: 1.5 }} spacing={2}>
                {/* Date */}
                <Box sx={{ minWidth: 160 }}>
                  <Typography variant="body2" fontWeight={600}>{fmtDate(log.date)}</Typography>
                </Box>

                {/* Punch in */}
                <Box sx={{ minWidth: 100 }}>
                  <Typography variant="caption" color="text.secondary" display="block">Punch In</Typography>
                  <Typography variant="body2" fontWeight={600} color="success.main">{fmtTime(log.punched_in_at)}</Typography>
                </Box>

                {/* Punch out */}
                <Box sx={{ minWidth: 100 }}>
                  <Typography variant="caption" color="text.secondary" display="block">Punch Out</Typography>
                  <Typography variant="body2" fontWeight={600} color={log.punched_out_at ? 'text.primary' : 'text.disabled'}>
                    {fmtTime(log.punched_out_at)}
                  </Typography>
                </Box>

                {/* Duration */}
                <Box sx={{ minWidth: 80 }}>
                  <Typography variant="caption" color="text.secondary" display="block">Duration</Typography>
                  <Typography variant="body2" fontWeight={600}>{fmtDuration(log.duration_minutes)}</Typography>
                </Box>

                {/* Status chip */}
                <Box flex={1} />
                {!log.punched_out_at
                  ? <Chip size="small" label="On duty" color="success" />
                  : <Chip size="small" label="Completed" variant="outlined" />}

                {/* Note */}
                {log.note && (
                  <Tooltip title={log.note}>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 120 }}>
                      {log.note}
                    </Typography>
                  </Tooltip>
                )}
              </Stack>
            ))}
          </Stack>
        </Card>
      )}
    </Box>
  );
}

// ── main page ────────────────────────────────────────────────────────────────

export function TechnicianDetailPage() {
  const { id = '' } = useParams();
  const confirm = useConfirm();
  const [tab, setTab] = useState(0);

  const { data: tech, isLoading, error, refetch } = useTechnicianProfile(id);
  const setStatus = useSetTechnicianStatus();

  if (isLoading) return <LoadingScreen />;
  if (error || !tech) return <ErrorState error={error} onRetry={refetch} />;

  const userId = tech.user_id ?? tech.id;
  const isActive = (tech.status ?? 'ACTIVE') === 'ACTIVE';

  const toggleStatus = async () => {
    const next = isActive ? 'SUSPENDED' : 'ACTIVE';
    const ok = await confirm({
      title: isActive ? 'Suspend technician?' : 'Reactivate technician?',
      message: isActive
        ? 'Suspending blocks this technician from signing in and removes them from dispatch.'
        : 'Reactivating restores full access.',
      confirmText: isActive ? 'Suspend' : 'Reactivate',
      destructive: isActive,
    });
    if (ok) await setStatus.mutateAsync({ userId, status: next });
  };

  return (
    <>
      {/* Page header */}
      <PageHeader
        crumbs={[{ label: 'Technicians', to: paths.technicians }, { label: tech.full_name ?? 'Detail' }]}
        title=""
        actions={
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
        }
      />

      {/* Hero card */}
      <Card sx={{ mb: 3, background: `linear-gradient(135deg, ${BRAND[700]} 0%, ${BRAND[500]} 100%)`, color: '#fff' }}>
        <CardContent sx={{ py: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ sm: 'center' }}>
            <Avatar
              sx={{ width: 72, height: 72, fontSize: '1.6rem', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.25)', color: '#fff' }}
            >
              {techInitials(tech.full_name)}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                <Typography variant="h2" sx={{ color: '#fff' }}>{tech.full_name ?? '—'}</Typography>
                <Chip
                  size="small"
                  label={tech.status ?? 'ACTIVE'}
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600 }}
                />
                <Chip
                  size="small"
                  label={tech.on_duty ? 'On duty' : 'Off duty'}
                  sx={{ bgcolor: tech.on_duty ? '#2BA84A' : 'rgba(255,255,255,0.15)', color: '#fff' }}
                />
              </Stack>
              <Typography sx={{ color: 'rgba(255,255,255,0.75)', mt: 0.5 }}>{tech.email}</Typography>
            </Box>

            {/* Quick stats in hero */}
            <Stack direction="row" spacing={3} sx={{ flexShrink: 0 }}>
              {tech.rating != null && (
                <Tooltip title="Average rating">
                  <Stack alignItems="center">
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <StarRoundedIcon sx={{ color: '#F5A623' }} />
                      <Typography variant="h3" sx={{ color: '#fff' }}>{tech.rating.toFixed(1)}</Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>Rating</Typography>
                  </Stack>
                </Tooltip>
              )}
              {tech.completed_jobs != null && (
                <Tooltip title="Total completed jobs">
                  <Stack alignItems="center">
                    <Typography variant="h3" sx={{ color: '#fff' }}>{tech.completed_jobs}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>Completed</Typography>
                  </Stack>
                </Tooltip>
              )}
              {tech.active_jobs != null && (
                <Tooltip title="Currently active jobs">
                  <Stack alignItems="center">
                    <Typography variant="h3" sx={{ color: '#fff' }}>{tech.active_jobs}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>Active</Typography>
                  </Stack>
                </Tooltip>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 1, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Overview" />
        <Tab label="Job history" />
        <Tab label="Attendance" />
      </Tabs>

      {tab === 0 && <OverviewTab id={id} />}
      {tab === 1 && <JobsTab id={id} />}
      {tab === 2 && <AttendanceTab userId={userId} />}
    </>
  );
}