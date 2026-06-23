import { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Stack, TextField, Typography,
} from '@mui/material';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { formatMoney } from '@/utils/format';
import {
  useMySubscriptions, usePauseSubscription, useResumeSubscription, useCancelSubscription,
} from './hooks';
import type { CustomerSubscription } from './types';

const BRAND = '#1565C0';

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING:   { label: 'Pending',   color: '#FF9800' },
  ACTIVE:    { label: 'Active',    color: '#4CAF50' },
  PAUSED:    { label: 'Paused',    color: '#2196F3' },
  CANCELLED: { label: 'Cancelled', color: '#9E9E9E' },
  EXPIRED:   { label: 'Expired',   color: '#F44336' },
};

const CYCLE_LABEL: Record<string, string> = {
  WEEKLY:    'Weekly',
  MONTHLY:   'Monthly',
  QUARTERLY: 'Every 3 months',
  YEARLY:    'Yearly',
};

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function CancelDialog({ open, onClose, onConfirm, busy }: {
  open: boolean; onClose: () => void;
  onConfirm: (reason: string) => void; busy: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>Cancel Subscription</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Cancelling your subscription will stop future scheduled visits.
        </Alert>
        <TextField
          label="Reason (optional)"
          multiline rows={3} fullWidth
          value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Why are you cancelling?"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Keep it</Button>
        <Button
          color="error" variant="contained" disabled={busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <CancelIcon />}
          onClick={() => onConfirm(reason)}
        >
          {busy ? 'Cancelling…' : 'Cancel subscription'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SubscriptionCard({ sub }: { sub: CustomerSubscription }) {
  const pause  = usePauseSubscription();
  const resume = useResumeSubscription();
  const cancel = useCancelSubscription();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [err, setErr] = useState('');

  const meta   = STATUS_META[sub.status] ?? { label: sub.status, color: '#9E9E9E' };
  const plan   = sub.plan;
  const isActive = sub.status === 'ACTIVE';
  const isPaused = sub.status === 'PAUSED';

  const handleAction = async (action: () => Promise<unknown>) => {
    setErr('');
    try { await action(); }
    catch (e: unknown) { setErr((e as { message?: string })?.message ?? 'Action failed'); }
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <AutorenewIcon sx={{ color: BRAND, fontSize: 28 }} />
            <Box>
              <Typography fontWeight={700}>{plan?.name ?? 'Subscription Plan'}</Typography>
              {plan && (
                <Typography variant="caption" color="text.secondary">
                  {formatMoney(plan.price, plan.currency)} / {CYCLE_LABEL[plan.billing_cycle] ?? plan.billing_cycle}
                  {' · '}{plan.visits_per_cycle} visit{plan.visits_per_cycle !== 1 ? 's' : ''} per cycle
                </Typography>
              )}
            </Box>
          </Stack>
          <Chip label={meta.label} size="small"
            sx={{ bgcolor: `${meta.color}18`, color: meta.color, fontWeight: 700 }} />
        </Stack>

        <Stack spacing={0.75} sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary">Started</Typography>
            <Typography variant="caption" fontWeight={600}>{fmtDate(sub.start_date)}</Typography>
          </Stack>
          {sub.next_billing_date && (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">Next billing</Typography>
              <Typography variant="caption" fontWeight={600}>{fmtDate(sub.next_billing_date)}</Typography>
            </Stack>
          )}
          {sub.next_service_date && (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">Next service</Typography>
              <Typography variant="caption" fontWeight={600}>{fmtDate(sub.next_service_date)}</Typography>
            </Stack>
          )}
          {sub.paused_at && (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">Paused on</Typography>
              <Typography variant="caption" fontWeight={600}>{fmtDate(sub.paused_at)}</Typography>
            </Stack>
          )}
        </Stack>

        {err && <Alert severity="error" sx={{ mb: 1.5 }}>{err}</Alert>}

        {(isActive || isPaused) && (
          <Stack direction="row" spacing={1}>
            {isActive && (
              <Button
                size="small" variant="outlined" startIcon={<PauseCircleIcon />}
                disabled={pause.isPending}
                onClick={() => handleAction(() => pause.mutateAsync(sub.id))}
              >
                {pause.isPending ? 'Pausing…' : 'Pause'}
              </Button>
            )}
            {isPaused && (
              <Button
                size="small" variant="contained" startIcon={<PlayCircleIcon />}
                sx={{ bgcolor: '#4CAF50' }} disabled={resume.isPending}
                onClick={() => handleAction(() => resume.mutateAsync(sub.id))}
              >
                {resume.isPending ? 'Resuming…' : 'Resume'}
              </Button>
            )}
            <Button
              size="small" color="error" variant="outlined"
              startIcon={<CancelIcon />}
              onClick={() => setCancelOpen(true)}
            >
              Cancel
            </Button>
          </Stack>
        )}
      </CardContent>

      <CancelDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        busy={cancel.isPending}
        onConfirm={(reason) =>
          handleAction(async () => {
            await cancel.mutateAsync({ id: sub.id, reason });
            setCancelOpen(false);
          })
        }
      />
    </Card>
  );
}

export function CustomerSubscriptionsPage() {
  const { data: subscriptions = [], isLoading, error } = useMySubscriptions();

  const active    = subscriptions.filter((s) => ['ACTIVE', 'PAUSED', 'PENDING'].includes(s.status));
  const inactive  = subscriptions.filter((s) => ['CANCELLED', 'EXPIRED'].includes(s.status));

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 1 }}>My Subscriptions</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage your recurring pest control plans.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>Could not load subscriptions.</Alert>}

      {isLoading ? (
        <Box textAlign="center" py={6}><CircularProgress /></Box>
      ) : subscriptions.length === 0 ? (
        <Card variant="outlined" sx={{ p: 5, textAlign: 'center', bgcolor: 'action.hover' }}>
          <AutorenewIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            No active subscriptions. Ask our team about subscription plans for regular pest control.
          </Typography>
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" fontWeight={700} sx={{ mb: 1.5 }}>
                Active Plans
              </Typography>
              {active.map((s) => <SubscriptionCard key={s.id} sub={s} />)}
            </Box>
          )}

          {inactive.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" fontWeight={700} sx={{ mb: 1.5 }}>
                Past Plans
              </Typography>
              {inactive.map((s) => <SubscriptionCard key={s.id} sub={s} />)}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
