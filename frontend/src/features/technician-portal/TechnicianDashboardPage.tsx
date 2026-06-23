import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardActionArea, Chip, CircularProgress, Divider,
  Stack, Typography,
} from '@mui/material';
import {
  CheckCircle as DoneIcon, Schedule as ClockIcon, Today as TodayIcon,
  Upcoming as UpcomingIcon,
  Login as PunchInIcon, Logout as PunchOutIcon,
} from '@mui/icons-material';
import { paths } from '@/routes/paths';
import { useTechJobs, useTechProfile, useAcceptJob, useDeclineJob } from './hooks';
import { useDutyStatus, usePunchIn, usePunchOut } from '../attendance/hooks';
import { ACTIVE_STATUSES, STATUS_COLOR, STATUS_LABEL, type TechJob } from './types';

const BRAND = '#1E8E5A';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function isToday(iso?: string) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function fmt(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, borderColor: `${color}30`, bgcolor: `${color}08` }}>
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Box sx={{ color, mb: 0.5 }}>{icon}</Box>
        <Typography variant="h4" fontWeight={800} sx={{ color }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
      </Box>
    </Card>
  );
}

function JobCard({ job }: { job: TechJob }) {
  const navigate = useNavigate();
  const accept = useAcceptJob();
  const decline = useDeclineJob();
  const color = STATUS_COLOR[job.status] ?? '#9E9E9E';

  return (
    <Card variant="outlined" sx={{ mb: 1.5, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex' }}>
        <Box sx={{ width: 5, bgcolor: color, flexShrink: 0 }} />
        <Box sx={{ flex: 1 }}>
          <CardActionArea onClick={() => navigate(`${paths.technicianJobs}/${job.id}`)} sx={{ p: 2 }}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {job.scheduled_window_start && (
                  <Typography variant="caption" fontWeight={700} sx={{ color }}>
                    {fmt(job.scheduled_window_start)}
                  </Typography>
                )}
                <Typography fontWeight={700} noWrap>{job.service_name ?? 'Service'}</Typography>
                {job.customer_name && <Typography variant="body2" color="text.secondary" noWrap>{job.customer_name}</Typography>}
                {job.address_line && <Typography variant="caption" color="text.disabled" noWrap sx={{ display: 'block' }}>{job.address_line}</Typography>}
              </Box>
              <Stack alignItems="flex-end" spacing={0.5} ml={1}>
                <Chip size="small" label={STATUS_LABEL[job.status]} sx={{ bgcolor: `${color}18`, color, fontWeight: 700, fontSize: 11 }} />
                {job.needs_acceptance && <Chip size="small" label="NEW" color="warning" sx={{ fontWeight: 800, fontSize: 10 }} />}
              </Stack>
            </Stack>
          </CardActionArea>
          {job.needs_acceptance && (
            <>
              <Divider />
              <Stack direction="row" spacing={1} sx={{ p: 1.5 }}>
                <Button size="small" variant="outlined" color="error" fullWidth disabled={decline.isPending}
                  onClick={() => decline.mutate(job.id)}>Decline</Button>
                <Button size="small" variant="contained" fullWidth disabled={accept.isPending}
                  sx={{ bgcolor: BRAND }} onClick={() => accept.mutate(job.id)}>Accept</Button>
              </Stack>
            </>
          )}
        </Box>
      </Box>
    </Card>
  );
}

function PunchCard() {
  const { data, isLoading } = useDutyStatus();
  const punchIn  = usePunchIn();
  const punchOut = usePunchOut();

  if (isLoading) return null;

  const status   = data?.status ?? 'NOT_PUNCHED_IN';
  const sessions = data?.sessions ?? [];

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const totalMin = sessions.reduce((s, r) => s + (r.duration_minutes ?? 0), 0);

  return (
    <Card variant="outlined" sx={{ mb: 3, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
        <ClockIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
        <Typography variant="subtitle2" fontWeight={700} flex={1}>Today's Duty</Typography>
        {status === 'ON_DUTY' && <Chip size="small" label="On duty" color="success" sx={{ fontWeight: 700 }} />}
        {status === 'PUNCHED_OUT' && <Chip size="small" label="Off duty" color="default" />}
        {status === 'NOT_PUNCHED_IN' && <Chip size="small" label="Not started" variant="outlined" />}
      </Stack>
      <Divider />
      <Box sx={{ p: 2 }}>
        {/* Session list */}
        {sessions.length > 0 && (
          <Box mb={2}>
            {sessions.map((s, i) => (
              <Stack key={s.id} direction="row" alignItems="center" spacing={2}
                sx={{ py: 0.75, borderBottom: i < sessions.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.disabled" sx={{ minWidth: 20 }}>#{i + 1}</Typography>
                <Box>
                  <Typography variant="caption" color="text.secondary">In</Typography>
                  <Typography variant="body2" fontWeight={700} color="success.main">{fmt(s.punched_in_at)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Out</Typography>
                  <Typography variant="body2" fontWeight={700} color={s.punched_out_at ? 'text.primary' : 'text.disabled'}>
                    {s.punched_out_at ? fmt(s.punched_out_at) : '—'}
                  </Typography>
                </Box>
                {s.duration_minutes != null && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Duration</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {Math.floor(s.duration_minutes / 60)}h {s.duration_minutes % 60}m
                    </Typography>
                  </Box>
                )}
                <Box flex={1} />
                {!s.punched_out_at && <Chip size="small" label="Active" color="success" />}
              </Stack>
            ))}
            {sessions.length > 1 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Total today: {Math.floor(totalMin / 60)}h {totalMin % 60}m across {sessions.length} sessions
              </Typography>
            )}
          </Box>
        )}

        {/* Action button */}
        {status !== 'ON_DUTY' ? (
          <Button variant="contained" fullWidth startIcon={<PunchInIcon />}
            disabled={punchIn.isPending} sx={{ bgcolor: BRAND }}
            onClick={() => punchIn.mutate(undefined)}>
            {punchIn.isPending ? 'Punching in…' : 'Punch In'}
          </Button>
        ) : (
          <Button variant="outlined" fullWidth startIcon={<PunchOutIcon />}
            color="error" disabled={punchOut.isPending}
            onClick={() => punchOut.mutate(undefined)}>
            {punchOut.isPending ? 'Punching out…' : 'Punch Out'}
          </Button>
        )}
      </Box>
    </Card>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <Box mb={3}>
      <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
        <Typography variant="h6" fontWeight={700}>{title}</Typography>
        <Chip size="small" label={count} sx={{ bgcolor: `${BRAND}18`, color: BRAND, fontWeight: 700 }} />
      </Stack>
      {children}
    </Box>
  );
}

export function TechnicianDashboardPage() {
  const { data: profile, isLoading: loadingProfile } = useTechProfile();
  const { data: jobs = [], isLoading: loadingJobs, error } = useTechJobs();

  const todayJobs    = jobs.filter((j) => isToday(j.scheduled_window_start) && j.status !== 'COMPLETED' && j.status !== 'CANCELLED');
  const upcomingJobs = jobs.filter((j) => !isToday(j.scheduled_window_start) && ACTIVE_STATUSES.includes(j.status));
  const doneCount    = jobs.filter((j) => j.status === 'COMPLETED').length;

  return (
    <Box>
      {/* Hero header */}
      <Card sx={{ mb: 3, background: `linear-gradient(135deg, ${BRAND} 0%, #145e3a 100%)`, color: '#fff', overflow: 'hidden', position: 'relative' }}>
        <Box sx={{ position: 'absolute', top: -30, right: -30, width: 150, height: 150, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)' }} />
        <Box sx={{ position: 'absolute', bottom: -20, right: 60, width: 100, height: 100, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)' }} />
        <Box sx={{ p: 3, position: 'relative' }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{greeting()},</Typography>
          {loadingProfile ? (
            <CircularProgress size={20} sx={{ color: '#fff', my: 1 }} />
          ) : (
            <Typography variant="h5" fontWeight={800} mb={0.5}>{profile?.full_name ?? 'Technician'}</Typography>
          )}
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Typography>
        </Box>
      </Card>

      {/* Punch in/out */}
      <PunchCard />

      {/* Stats */}
      <Stack direction="row" spacing={1.5} mb={3}>
        <StatCard label="Today" value={todayJobs.length} icon={<TodayIcon />} color={BRAND} />
        <StatCard label="Upcoming" value={upcomingJobs.length} icon={<UpcomingIcon />} color="#FF9800" />
        <StatCard label="Done" value={doneCount} icon={<DoneIcon />} color="#4CAF50" />
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>Could not load jobs. Pull to refresh.</Alert>}

      {loadingJobs ? (
        <Box textAlign="center" py={4}><CircularProgress /></Box>
      ) : (
        <>
          <Section title="Today's jobs" count={todayJobs.length}>
            {todayJobs.length === 0
              ? <Card variant="outlined" sx={{ p: 3, textAlign: 'center', bgcolor: 'action.hover' }}>
                  <ClockIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">No jobs scheduled for today</Typography>
                </Card>
              : todayJobs.map((j) => <JobCard key={j.id} job={j} />)
            }
          </Section>

          {upcomingJobs.length > 0 && (
            <Section title="Upcoming" count={upcomingJobs.length}>
              {upcomingJobs.map((j) => <JobCard key={j.id} job={j} />)}
            </Section>
          )}
        </>
      )}
    </Box>
  );
}
