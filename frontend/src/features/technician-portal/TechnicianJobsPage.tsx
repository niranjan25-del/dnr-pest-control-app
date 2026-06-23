import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardActionArea, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, IconButton, Link, Stack, TextField, Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon, CameraAlt as CameraIcon, CheckCircle as DoneIcon,
  LocationOn as LocationIcon, Map as MapIcon, Notes as NotesIcon,
  OpenInNew as OpenInNewIcon, Phone as PhoneIcon, Schedule as ClockIcon,
  UploadFile as UploadIcon,
} from '@mui/icons-material';
import { paths } from '@/routes/paths';
import { useTechJobs, useAcceptJob, useDeclineJob, useAdvanceStatus, useCompleteJob } from './hooks';
import {
  ACTIVE_STATUSES, STATUS_COLOR, STATUS_LABEL, WORKFLOW_NEXT, WORKFLOW_NEXT_LABEL, type TechJob,
} from './types';

const BRAND = '#1E8E5A';

type Filter = 'ALL' | 'NEW' | 'ACTIVE' | 'COMPLETED';
const FILTERS: { key: Filter; label: string; color?: string }[] = [
  { key: 'ALL',       label: 'All' },
  { key: 'NEW',       label: 'New',       color: '#FF9800' },
  { key: 'ACTIVE',    label: 'Active',    color: '#2196F3' },
  { key: 'COMPLETED', label: 'Completed', color: '#4CAF50' },
];

function fmt(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}

const LOCATION_PREFIX = '📍 Location: ';

function parseNotes(notes: string | null | undefined): { locationLink: string | null; text: string } {
  if (!notes) return { locationLink: null, text: '' };
  if (notes.startsWith(LOCATION_PREFIX)) {
    const rest = notes.slice(LOCATION_PREFIX.length);
    const sep = rest.indexOf('\n\n');
    if (sep !== -1) return { locationLink: rest.slice(0, sep).trim(), text: rest.slice(sep + 2).trim() };
    return { locationLink: rest.trim(), text: '' };
  }
  return { locationLink: null, text: notes };
}

function JobCard({ job }: { job: TechJob }) {
  const navigate = useNavigate();
  const accept  = useAcceptJob();
  const decline = useDeclineJob();
  const color   = STATUS_COLOR[job.status] ?? '#9E9E9E';

  return (
    <Card variant="outlined" sx={{ mb: 1.5, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex' }}>
        <Box sx={{ width: 5, bgcolor: color, flexShrink: 0 }} />
        <Box sx={{ flex: 1 }}>
          <CardActionArea onClick={() => navigate(`${paths.technicianJobs}/${job.id}`)} sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={700} noWrap>{job.service_name ?? 'Service'}</Typography>
                {job.customer_name && <Typography variant="body2" color="text.secondary">{job.customer_name}</Typography>}
                {job.address_line && (
                  <Stack direction="row" alignItems="center" spacing={0.5} mt={0.5}>
                    <LocationIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                    <Typography variant="caption" color="text.disabled" noWrap>{job.address_line}</Typography>
                  </Stack>
                )}
                {job.scheduled_window_start && (
                  <Stack direction="row" alignItems="center" spacing={0.5} mt={0.5}>
                    <ClockIcon sx={{ fontSize: 13, color }} />
                    <Typography variant="caption" fontWeight={600} sx={{ color }}>{fmt(job.scheduled_window_start)}</Typography>
                  </Stack>
                )}
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

export function TechnicianJobsPage() {
  const { data: jobs = [], isLoading, error, refetch } = useTechJobs();
  const [filter, setFilter] = useState<Filter>('ALL');

  const filtered = jobs.filter((j) => {
    if (filter === 'NEW')       return j.needs_acceptance;
    if (filter === 'ACTIVE')    return ACTIVE_STATUSES.includes(j.status) && !j.needs_acceptance;
    if (filter === 'COMPLETED') return j.status === 'COMPLETED';
    return true;
  });

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} mb={2}>My Jobs</Typography>

      <Stack direction="row" spacing={1} mb={2} sx={{ overflowX: 'auto', pb: 0.5 }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const color  = f.color ?? BRAND;
          return (
            <Chip key={f.key} label={f.label} clickable onClick={() => setFilter(f.key)}
              sx={{ fontWeight: active ? 700 : 500, bgcolor: active ? `${color}18` : undefined,
                color: active ? color : 'text.secondary', border: `1px solid ${active ? `${color}60` : 'transparent'}` }} />
          );
        })}
      </Stack>

      {error && (
        <Alert severity="error" action={<Button onClick={() => refetch()} size="small">Retry</Button>} sx={{ mb: 2 }}>
          Could not load jobs
        </Alert>
      )}

      {isLoading ? (
        <Box textAlign="center" py={6}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: 'center', bgcolor: 'action.hover' }}>
          <Typography color="text.secondary">No {filter !== 'ALL' ? filter.toLowerCase() + ' ' : ''}jobs</Typography>
        </Card>
      ) : (
        filtered.map((j) => <JobCard key={j.id} job={j} />)
      )}
    </Box>
  );
}

// ── Completion photo dialog ───────────────────────────────────────────────────

function CompletionDialog({ job, open, onClose }: { job: TechJob; open: boolean; onClose: () => void }) {
  const complete   = useCompleteJob();
  const fileRef    = useRef<HTMLInputElement>(null);
  const [photo, setPhoto]   = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes]   = useState('');
  const [err, setErr]       = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
    setErr('');
  };

  const handleSubmit = async () => {
    if (!photo) { setErr('Please attach a photo before submitting.'); return; }
    setErr('');
    try {
      await complete.mutateAsync({ id: job.id, photo, notes });
      onClose();
    } catch (e: unknown) {
      setErr((e as { message?: string })?.message ?? 'Upload failed. Please try again.');
    }
  };

  const handleClose = () => {
    if (complete.isPending) return;
    setPhoto(null); setPreview(null); setNotes(''); setErr('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Submit Completion</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Take or upload a photo showing the completed work. This is required before marking the job as done.
        </Typography>

        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

        {/* Photo picker */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />

        {preview ? (
          <Box sx={{ position: 'relative', mb: 2 }}>
            <Box component="img" src={preview} alt="completion photo"
              sx={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 2, display: 'block' }} />
            <Button size="small" variant="outlined" sx={{ mt: 1 }} onClick={() => fileRef.current?.click()}>
              Change photo
            </Button>
          </Box>
        ) : (
          <Card variant="outlined" sx={{ mb: 2, cursor: 'pointer', bgcolor: 'action.hover' }}
            onClick={() => fileRef.current?.click()}>
            <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ py: 5 }}>
              <CameraIcon sx={{ fontSize: 48, color: BRAND }} />
              <Typography fontWeight={600}>Tap to take / upload photo</Typography>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <UploadIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.disabled">JPG, PNG or WebP · max 10 MB</Typography>
              </Stack>
            </Stack>
          </Card>
        )}

        <TextField
          label="Notes (optional)"
          placeholder="e.g. treated 3 rooms, recommend follow-up in 30 days"
          multiline rows={3} fullWidth
          value={notes} onChange={(e) => setNotes(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={complete.isPending}>Cancel</Button>
        <Button
          variant="contained" onClick={handleSubmit} disabled={!photo || complete.isPending}
          startIcon={complete.isPending ? <CircularProgress size={16} color="inherit" /> : <DoneIcon />}
          sx={{ bgcolor: BRAND }}
        >
          {complete.isPending ? 'Submitting…' : 'Mark as complete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Job Detail ────────────────────────────────────────────────────────────────

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Stack direction="row" alignItems="flex-start" spacing={1.5} py={1.5} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ color: BRAND, mt: 0.2 }}>{icon}</Box>
      <Box>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="body2" fontWeight={500}>{value}</Typography>
      </Box>
    </Stack>
  );
}

export function TechnicianJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: jobs = [], isLoading } = useTechJobs();
  const accept  = useAcceptJob();
  const decline = useDeclineJob();
  const advance = useAdvanceStatus();
  const [completionOpen, setCompletionOpen] = useState(false);

  const job = jobs.find((j) => j.id === id) as TechJob | undefined;
  const color      = job ? STATUS_COLOR[job.status] : BRAND;
  const nextStatus = job ? WORKFLOW_NEXT[job.status] : undefined;
  const nextLabel  = job ? WORKFLOW_NEXT_LABEL[job.status] : undefined;
  const { locationLink, text: extraNotes } = parseNotes(job?.notes);

  if (isLoading) return <Box textAlign="center" py={6}><CircularProgress /></Box>;
  if (!job) return (
    <Box>
      <Button startIcon={<BackIcon />} onClick={() => navigate(paths.technicianJobs)}>Back</Button>
      <Alert severity="error" sx={{ mt: 2 }}>Job not found</Alert>
    </Box>
  );

  // "Complete job" requires a photo — intercept the last workflow step
  const isLastStep = job.status === 'IN_PROGRESS';

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <IconButton onClick={() => navigate(paths.technicianJobs)}><BackIcon /></IconButton>
        <Typography variant="h6" fontWeight={700}>Job Details</Typography>
      </Stack>

      {/* Status hero */}
      <Card sx={{ mb: 2, background: `linear-gradient(135deg, ${color} 0%, ${color}aa 100%)`, color: '#fff' }}>
        <Box sx={{ p: 3 }}>
          <Chip label={STATUS_LABEL[job.status]} size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700, mb: 1 }} />
          <Typography variant="h6" fontWeight={700}>{job.service_name ?? 'Service Job'}</Typography>
          {job.customer_name && <Typography sx={{ color: 'rgba(255,255,255,0.8)', mt: 0.5 }}>{job.customer_name}</Typography>}
        </Box>
      </Card>

      {/* Location pin — shown prominently if customer shared a Maps link */}
      {locationLink && (
        <Card sx={{ mb: 2, borderRadius: 2, overflow: 'hidden', border: '2px solid #2196F3' }}>
          <Box sx={{ bgcolor: '#2196F3', px: 2, py: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <MapIcon sx={{ color: '#fff', fontSize: 18 }} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#fff' }}>
                Customer location pin
              </Typography>
            </Stack>
          </Box>
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              The customer has shared their exact location. Tap to open in Google Maps.
            </Typography>
            <Button
              component={Link}
              href={locationLink}
              target="_blank"
              rel="noopener noreferrer"
              variant="contained"
              fullWidth
              size="large"
              startIcon={<MapIcon />}
              endIcon={<OpenInNewIcon fontSize="small" />}
              sx={{ bgcolor: '#2196F3', fontWeight: 700, py: 1.2, borderRadius: 2 }}
            >
              Open in Google Maps
            </Button>
          </Box>
        </Card>
      )}

      {/* Details */}
      <Card variant="outlined" sx={{ mb: 2, px: 2 }}>
        {job.customer_name    && <DetailRow icon={<PhoneIcon fontSize="small" />}   label="Customer"     value={job.customer_name} />}
        {job.customer_phone   && <DetailRow icon={<PhoneIcon fontSize="small" />}   label="Phone"        value={job.customer_phone} />}
        {job.address_line     && <DetailRow icon={<LocationIcon fontSize="small" />} label="Address"      value={job.address_line} />}
        {job.scheduled_window_start && <DetailRow icon={<ClockIcon fontSize="small" />} label="Scheduled" value={fmt(job.scheduled_window_start)} />}
        {job.access_notes     && <DetailRow icon={<LocationIcon fontSize="small" />} label="Access / gate" value={job.access_notes} />}
        {extraNotes           && <DetailRow icon={<NotesIcon fontSize="small" />}   label="Notes"        value={extraNotes} />}
      </Card>

      {/* Actions */}
      {job.needs_acceptance ? (
        <Stack spacing={1}>
          <Button variant="outlined" color="error" size="large" fullWidth disabled={decline.isPending}
            onClick={() => decline.mutate(job.id, { onSuccess: () => navigate(paths.technicianJobs) })}>
            Decline job
          </Button>
          <Button variant="contained" size="large" fullWidth disabled={accept.isPending}
            sx={{ bgcolor: BRAND, py: 1.5 }} onClick={() => accept.mutate(job.id)}>
            Accept job
          </Button>
        </Stack>
      ) : isLastStep ? (
        // Last step: require photo before completing
        <Button
          variant="contained" size="large" fullWidth
          sx={{ bgcolor: color, py: 1.5 }}
          startIcon={<CameraIcon />}
          onClick={() => setCompletionOpen(true)}
        >
          Submit completion photo
        </Button>
      ) : nextStatus && nextLabel ? (
        <Button variant="contained" size="large" fullWidth
          sx={{ bgcolor: color, py: 1.5 }} disabled={advance.isPending}
          onClick={() => advance.mutate({ id: job.id, status: nextStatus })}>
          {advance.isPending ? <CircularProgress size={20} color="inherit" /> : nextLabel}
        </Button>
      ) : job.status === 'COMPLETED' ? (
        <Alert severity="success" icon={<DoneIcon />}>This job is complete.</Alert>
      ) : null}

      {job && (
        <CompletionDialog job={job} open={completionOpen} onClose={() => setCompletionOpen(false)} />
      )}
    </Box>
  );
}