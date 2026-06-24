import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, LinearProgress, Rating, Stack,
  Step, StepLabel, Stepper, TextField, Tooltip, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import HomeRepairServiceIcon from '@mui/icons-material/HomeRepairService';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PaymentIcon from '@mui/icons-material/Payment';
import PersonIcon from '@mui/icons-material/Person';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReplayIcon from '@mui/icons-material/Replay';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ShieldIcon from '@mui/icons-material/Shield';
import StarIcon from '@mui/icons-material/Star';
import { formatMoney } from '@/utils/format';
import { paths } from '@/routes/paths';
import {
  useMyBooking, useCancelMyBooking, useRescheduleMyBooking,
  useSubmitReview, useWarrantyForBooking,
  useCreateCashfreeOrder, useConfirmCashfreePayment,
  useValidateCoupon, useRedeemCoupon,
} from './hooks';
import type { CashfreeOrderResult, CouponPreview, CustomerBooking } from './types';

const BRAND = '#1565C0';

// ── Status config ─────────────────────────────────────────────────────────────

interface StatusMeta {
  label: string;
  color: string;
  bg: string;
  description: string;
  icon: React.ReactNode;
}

const STATUS_META: Record<string, StatusMeta> = {
  PENDING: {
    label: 'Pending confirmation',
    color: '#F57C00',
    bg: '#FFF3E0',
    description: 'Your booking is awaiting confirmation from our team.',
    icon: <ScheduleIcon />,
  },
  CONFIRMED: {
    label: 'Confirmed',
    color: '#1565C0',
    bg: '#E3F2FD',
    description: 'Your booking is confirmed! A technician will be assigned shortly.',
    icon: <CheckCircleIcon />,
  },
  EN_ROUTE: {
    label: 'Technician en route',
    color: '#6A1B9A',
    bg: '#F3E5F5',
    description: 'Your technician is on the way to your location.',
    icon: <DirectionsCarIcon />,
  },
  ARRIVED: {
    label: 'Technician arrived',
    color: '#2E7D32',
    bg: '#E8F5E9',
    description: 'Your technician has arrived at your location.',
    icon: <LocationOnIcon />,
  },
  IN_PROGRESS: {
    label: 'Service in progress',
    color: '#1B5E20',
    bg: '#E8F5E9',
    description: 'The service is currently being performed.',
    icon: <HomeRepairServiceIcon />,
  },
  COMPLETED: {
    label: 'Completed',
    color: '#2E7D32',
    bg: '#E8F5E9',
    description: 'Your service has been completed successfully.',
    icon: <CheckCircleIcon />,
  },
  CANCELLED: {
    label: 'Cancelled',
    color: '#C62828',
    bg: '#FFEBEE',
    description: 'This booking has been cancelled.',
    icon: <CancelIcon />,
  },
  NO_SHOW: {
    label: 'No show',
    color: '#757575',
    bg: '#F5F5F5',
    description: 'The technician arrived but was unable to complete the service.',
    icon: <CancelIcon />,
  },
};

const STATUS_STEPS = ['PENDING', 'CONFIRMED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'];
const STEP_LABELS  = ['Pending', 'Confirmed', 'En route', 'Arrived', 'In progress', 'Completed'];

const CANCELLABLE    = new Set(['PENDING', 'CONFIRMED']);
const RESCHEDULABLE  = new Set(['PENDING', 'CONFIRMED']);
const PAYABLE        = new Set(['PENDING', 'CONFIRMED', 'COMPLETED']);
const NON_TERMINAL   = new Set(['PENDING', 'CONFIRMED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED']);

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: '#FF9800',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtTime(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDateTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function activeStep(status: string): number {
  const idx = STATUS_STEPS.indexOf(status);
  return idx === -1 ? 0 : idx;
}

// ── Cashfree SDK loader ───────────────────────────────────────────────────────

function loadCashfreeScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ('Cashfree' in window) { resolve(true); return; }
    const s = document.createElement('script');
    s.src     = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

declare global {
  interface Window {
    Cashfree: (config: { mode: string }) => {
      checkout: (opts: { paymentSessionId: string; redirectTarget: string }) => Promise<{
        error?: { message: string; code?: string } | null;
        redirect?: boolean;
        paymentDetails?: { paymentMessage: string } | null;
      }>;
    };
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LiveStatusBanner({ booking }: { booking: CustomerBooking }) {
  const meta = STATUS_META[booking.status] ?? STATUS_META.PENDING;
  const isActive = ['EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(booking.status);

  return (
    <Card
      sx={{
        mb: 3, bgcolor: meta.bg, border: `2px solid ${meta.color}30`,
        position: 'relative', overflow: 'hidden',
      }}
    >
      {isActive && (
        <Box
          sx={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 4,
            background: `linear-gradient(90deg, ${meta.color}, ${meta.color}60, ${meta.color})`,
            backgroundSize: '200% 100%',
            animation: 'pulse-bar 2s ease-in-out infinite',
            '@keyframes pulse-bar': {
              '0%': { backgroundPosition: '0% 0%' },
              '100%': { backgroundPosition: '200% 0%' },
            },
          }}
        />
      )}
      <CardContent sx={{ pt: isActive ? 2.5 : 2 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box sx={{ color: meta.color, mt: 0.25, fontSize: 32 }}>{meta.icon}</Box>
          <Box flex={1}>
            <Typography fontWeight={800} sx={{ color: meta.color, fontSize: 18 }}>
              {meta.label}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {meta.description}
            </Typography>
            {booking.technician_name && (
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1 }}>
                <PersonIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                <Typography variant="body2" fontWeight={600}>
                  {booking.technician_name}
                </Typography>
                <Typography variant="body2" color="text.secondary">assigned</Typography>
              </Stack>
            )}
          </Box>
          {isActive && (
            <Chip
              size="small" label="Live"
              sx={{
                bgcolor: meta.color, color: '#fff', fontWeight: 700, fontSize: 11,
                animation: 'blink 1.5s ease-in-out infinite',
                '@keyframes blink': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
              }}
            />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function ProgressStepper({ status }: { status: string }) {
  const cancelled = status === 'CANCELLED' || status === 'NO_SHOW';
  const step = activeStep(status);

  if (cancelled) {
    const meta = STATUS_META[status];
    return (
      <Card variant="outlined" sx={{ mb: 3, bgcolor: meta.bg, borderColor: `${meta.color}40` }}>
        <CardContent>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CancelIcon sx={{ color: meta.color }} />
            <Typography fontWeight={700} sx={{ color: meta.color }}>{meta.label}</Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
          Service progress
        </Typography>
        <Stepper activeStep={step} alternativeLabel>
          {STEP_LABELS.map((label, i) => (
            <Step key={label} completed={i < step}>
              <StepLabel
                sx={{
                  '& .MuiStepLabel-label': {
                    fontSize: 11,
                    fontWeight: i === step ? 700 : 400,
                    color: i === step ? BRAND : undefined,
                  },
                }}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </CardContent>
    </Card>
  );
}

function TechnicianCard({ booking }: { booking: CustomerBooking }) {
  if (!booking.technician_name) return null;

  return (
    <Card variant="outlined" sx={{ mb: 2, borderColor: `${BRAND}30` }}>
      <CardContent sx={{ py: '14px !important' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 44, height: 44, borderRadius: '50%', bgcolor: `${BRAND}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <PersonIcon sx={{ color: BRAND }} />
          </Box>
          <Box flex={1}>
            <Typography variant="caption" color="text.secondary">Assigned technician</Typography>
            <Typography fontWeight={700}>{booking.technician_name}</Typography>
          </Box>
          <Chip size="small" label="Assigned" sx={{ bgcolor: `${BRAND}14`, color: BRAND, fontWeight: 600 }} />
        </Stack>
      </CardContent>
    </Card>
  );
}

function StatusTimeline({ booking }: { booking: CustomerBooking }) {
  const history = booking.status_history;
  if (!history?.length) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
        Status history
      </Typography>
      <Stack spacing={0}>
        {history.map((entry, i) => {
          const meta = STATUS_META[entry.new_status];
          const isLast = i === history.length - 1;
          return (
            <Box key={entry.id} sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                <Box
                  sx={{
                    width: 10, height: 10, borderRadius: '50%', mt: 0.5, flexShrink: 0,
                    bgcolor: meta?.color ?? '#9E9E9E',
                    boxShadow: isLast ? `0 0 0 3px ${(meta?.color ?? '#9E9E9E')}30` : 'none',
                  }}
                />
                {!isLast && <Box sx={{ width: 2, flex: 1, bgcolor: 'divider', my: 0.25 }} />}
              </Box>
              <Box pb={isLast ? 0 : 1.5}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body2" fontWeight={700} sx={{ color: meta?.color ?? 'text.primary' }}>
                    {meta?.label ?? entry.new_status}
                  </Typography>
                  {isLast && (
                    <Chip
                      size="small" label="Current"
                      sx={{
                        height: 16, fontSize: 10,
                        bgcolor: `${meta?.color ?? '#9E9E9E'}14`,
                        color: meta?.color ?? 'text.secondary',
                      }}
                    />
                  )}
                </Stack>
                <Typography variant="caption" color="text.disabled">{fmtDateTime(entry.created_at)}</Typography>
                {entry.note && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, fontStyle: 'italic' }}>
                    "{entry.note}"
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Stack
      direction="row" spacing={1.5} alignItems="flex-start"
      sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Box sx={{ color: 'text.disabled', mt: 0.2, flexShrink: 0 }}>{icon}</Box>
      <Box flex={1}>
        <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
        <Typography variant="body2" fontWeight={500}>{value}</Typography>
      </Box>
    </Stack>
  );
}

// ── WarrantyBanner ────────────────────────────────────────────────────────────

function WarrantyBanner({ bookingId }: { bookingId: string }) {
  const { data: warranty } = useWarrantyForBooking(bookingId);
  if (!warranty) return null;

  const pct      = Math.round((warranty.days_remaining / warranty.warranty_days) * 100);
  const barColor = pct > 50 ? '#4CAF50' : pct > 20 ? '#FF9800' : '#F44336';
  const expired  = !warranty.is_active || warranty.days_remaining === 0;
  const expiryDate = new Date(warranty.expires_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <Card variant="outlined" sx={{ mb: 3, borderColor: expired ? 'divider' : `${barColor}50` }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: expired ? 0 : 1.5 }}>
          <ShieldIcon sx={{ color: expired ? 'text.disabled' : barColor }} />
          <Box flex={1}>
            <Typography variant="subtitle2" fontWeight={700}>Service Warranty</Typography>
            <Typography variant="caption" color="text.secondary">
              {warranty.warranty_days}-day guarantee ·{' '}
              {expired ? `Expired ${expiryDate}` : `Expires ${expiryDate}`}
            </Typography>
          </Box>
          <Chip
            label={expired ? 'Expired' : `${warranty.days_remaining}d left`}
            size="small"
            sx={{
              bgcolor: expired ? '#9E9E9E18' : `${barColor}18`,
              color: expired ? '#9E9E9E' : barColor,
              fontWeight: 700,
            }}
          />
        </Stack>
        {!expired && (
          <LinearProgress
            variant="determinate"
            value={Math.min(pct, 100)}
            sx={{
              height: 6, borderRadius: 3,
              bgcolor: `${barColor}20`,
              '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 3 },
            }}
          />
        )}
        {!expired && warranty.days_remaining <= 7 && (
          <Alert severity="warning" sx={{ mt: 1.5, py: 0.5 }}>
            Warranty expires soon! Contact us if pests return — we'll re-treat at no charge.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// ── PayNowButton ──────────────────────────────────────────────────────────────

function PayNowButton({ bookingId, amount, currency }: {
  bookingId: string; amount: string | number; currency: string;
}) {
  const createOrder = useCreateCashfreeOrder();
  const confirm     = useConfirmCashfreePayment();
  const [err, setErr]   = useState('');
  const [paid, setPaid] = useState(false);

  if (paid) {
    return (
      <Chip
        icon={<CheckCircleIcon sx={{ fontSize: '16px !important', color: '#4CAF50 !important' }} />}
        label="Payment received"
        sx={{ bgcolor: '#4CAF5018', color: '#4CAF50', fontWeight: 700 }}
      />
    );
  }

  const handlePay = async () => {
    setErr('');
    const loaded = await loadCashfreeScript();
    if (!loaded) { setErr('Could not load payment processor. Please try again.'); return; }
    try {
      const order: CashfreeOrderResult = await createOrder.mutateAsync(bookingId);
      const mode     = (import.meta.env.VITE_CASHFREE_MODE as string | undefined) ?? 'sandbox';
      const cashfree = window.Cashfree({ mode });

      const result = await cashfree.checkout({
        paymentSessionId: order.payment_session_id,
        redirectTarget: '_modal',
      });

      if (result.paymentDetails) {
        const payment = await confirm.mutateAsync(order.order_id);
        if (payment.status === 'SUCCEEDED') {
          setPaid(true);
        } else if (payment.status === 'FAILED') {
          setErr('Payment failed. Please try again.');
        } else {
          // Still processing — backend will reconcile via webhook or next page load.
          setErr('Payment is being verified. Please refresh in a moment if your status does not update.');
        }
      } else if (result.error) {
        setErr(result.error.message ?? 'Payment failed or was cancelled.');
      }
    } catch (e: unknown) {
      setErr((e as { message?: string })?.message ?? 'Could not initiate payment. Please try again.');
    }
  };

  const busy = createOrder.isPending || confirm.isPending;

  return (
    <Box>
      {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}
      <Button
        variant="contained"
        startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <PaymentIcon />}
        disabled={busy}
        onClick={handlePay}
        sx={{ bgcolor: '#2E7D32', '&:hover': { bgcolor: '#1B5E20' } }}
      >
        {busy ? 'Processing…' : `Pay ${formatMoney(amount, currency)}`}
      </Button>
    </Box>
  );
}

// ── RescheduleDialog ──────────────────────────────────────────────────────────

function RescheduleDialog({ open, onClose, bookingId }: {
  open: boolean; onClose: () => void; bookingId: string;
}) {
  const reschedule = useRescheduleMyBooking();
  const [datetime, setDatetime] = useState('');
  const [reason,   setReason]   = useState('');
  const [err,      setErr]      = useState('');

  const minDate = new Date();
  minDate.setHours(minDate.getHours() + 2);
  const minISO = minDate.toISOString().slice(0, 16);

  const handleSubmit = async () => {
    if (!datetime) { setErr('Please select a date and time.'); return; }
    setErr('');
    try {
      await reschedule.mutateAsync({
        id: bookingId,
        scheduledStart: new Date(datetime).toISOString(),
        reason: reason || undefined,
      });
      setDatetime('');
      setReason('');
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error).message ?? 'Could not reschedule.';
      setErr(Array.isArray(msg) ? msg.join('. ') : String(msg));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>Reschedule Booking</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose a new date and time. Our team will confirm the change within a few hours.
        </Typography>
        <TextField
          label="New date & time"
          type="datetime-local"
          fullWidth
          InputLabelProps={{ shrink: true }}
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          inputProps={{ min: minISO }}
          sx={{ mb: 2 }}
        />
        <TextField
          label="Reason (optional)"
          multiline rows={2} fullWidth
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="E.g. Travel, schedule conflict…"
        />
        {err && <Alert severity="error" sx={{ mt: 1.5 }}>{err}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={reschedule.isPending}>Back</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={reschedule.isPending || !datetime}
          startIcon={
            reschedule.isPending
              ? <CircularProgress size={14} color="inherit" />
              : <CalendarMonthIcon />
          }
        >
          {reschedule.isPending ? 'Rescheduling…' : 'Confirm reschedule'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── CouponSection ─────────────────────────────────────────────────────────────

function CouponSection({ bookingId, currency }: { bookingId: string; currency: string }) {
  const [couponInput,   setCouponInput]   = useState('');
  const [preview,       setPreview]       = useState<CouponPreview | null>(null);
  const [couponError,   setCouponError]   = useState('');
  const validateCoupon = useValidateCoupon();
  const redeemCoupon   = useRedeemCoupon();

  const handleValidate = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponError('');
    try {
      const result = await validateCoupon.mutateAsync({ code, bookingId });
      if (result.valid) {
        setPreview(result);
      } else {
        setPreview(null);
        setCouponError(result.reason ?? 'Invalid or expired coupon code.');
      }
    } catch {
      setCouponError('Could not validate coupon. Please try again.');
    }
  };

  const handleRedeem = async () => {
    if (!preview) return;
    try {
      await redeemCoupon.mutateAsync({ code: couponInput.trim().toUpperCase(), bookingId });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error).message ?? 'Could not apply coupon.';
      setCouponError(Array.isArray(msg) ? msg.join('. ') : String(msg));
      setPreview(null);
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 3, borderStyle: 'dashed', borderColor: 'primary.light' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <LocalOfferIcon sx={{ color: '#1565C0', fontSize: 20 }} />
          <Typography variant="subtitle2" fontWeight={700}>Have a coupon code?</Typography>
        </Stack>

        {!preview ? (
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <TextField
              size="small"
              placeholder="E.g. SAVE20"
              value={couponInput}
              onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleValidate(); } }}
              error={Boolean(couponError)}
              helperText={couponError || ' '}
              sx={{ flex: 1 }}
              inputProps={{ style: { textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: 1 } }}
            />
            <Button
              variant="outlined"
              onClick={() => void handleValidate()}
              disabled={!couponInput.trim() || validateCoupon.isPending}
              sx={{ whiteSpace: 'nowrap', mt: 0.25 }}
            >
              {validateCoupon.isPending ? <CircularProgress size={18} /> : 'Check'}
            </Button>
          </Stack>
        ) : (
          <Box>
            <Alert
              severity="success"
              sx={{ mb: 1.5 }}
              action={
                <Button size="small" color="inherit" onClick={() => { setPreview(null); setCouponError(''); }}>
                  Change
                </Button>
              }
            >
              <b>{preview.code}</b> saves you {formatMoney(preview.discount_amount, currency)}
              {' '}— you pay {formatMoney(preview.final_amount, currency)}
            </Alert>
            {couponError && <Alert severity="error" sx={{ mb: 1.5 }}>{couponError}</Alert>}
            <Stack direction="row" justifyContent="flex-end">
              <Button
                variant="contained"
                sx={{ bgcolor: '#1E8E5A' }}
                onClick={() => void handleRedeem()}
                disabled={redeemCoupon.isPending}
                startIcon={redeemCoupon.isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
              >
                {redeemCoupon.isPending ? 'Applying…' : 'Apply discount'}
              </Button>
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ── ReviewDialog ──────────────────────────────────────────────────────────────

function ReviewDialog({ open, onClose, bookingId, onReviewed }: {
  open: boolean; onClose: () => void; bookingId: string; onReviewed: () => void;
}) {
  const submitReview = useSubmitReview();
  const [rating,  setRating]  = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [err,     setErr]     = useState('');
  const [done,    setDone]    = useState(false);

  const handleSubmit = async () => {
    if (!rating) { setErr('Please select a star rating.'); return; }
    setErr('');
    try {
      await submitReview.mutateAsync({ bookingId, rating, comment: comment || undefined });
      setDone(true);
      onReviewed();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error).message ?? 'Could not submit review.';
      setErr(Array.isArray(msg) ? msg.join('. ') : String(msg));
    }
  };

  const handleClose = () => {
    setDone(false);
    setRating(null);
    setComment('');
    setErr('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>Rate This Service</DialogTitle>
      <DialogContent>
        {done ? (
          <Box textAlign="center" py={3}>
            <CheckCircleIcon sx={{ fontSize: 52, color: '#4CAF50', mb: 1.5 }} />
            <Typography variant="h6" fontWeight={700}>Thank you!</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Your feedback helps us serve you better.
            </Typography>
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              How satisfied were you with your pest control service?
            </Typography>
            <Box textAlign="center" sx={{ mb: 2.5 }}>
              <Rating
                value={rating}
                onChange={(_, v) => setRating(v)}
                size="large"
                precision={1}
                icon={<StarIcon fontSize="inherit" />}
              />
              {rating && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  {['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][rating]}
                </Typography>
              )}
            </Box>
            <TextField
              label="Additional comments (optional)"
              multiline rows={3} fullWidth
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us more about your experience…"
            />
            {err && <Alert severity="error" sx={{ mt: 1.5 }}>{err}</Alert>}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {done ? (
          <Button onClick={handleClose} variant="contained">Close</Button>
        ) : (
          <>
            <Button onClick={handleClose} disabled={submitReview.isPending}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitReview.isPending || !rating}
              startIcon={
                submitReview.isPending
                  ? <CircularProgress size={14} color="inherit" />
                  : <StarIcon />
              }
            >
              {submitReview.isPending ? 'Submitting…' : 'Submit review'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ── Cancel dialog ─────────────────────────────────────────────────────────────

function CancelDialog({
  open, onClose, onConfirm, loading,
}: {
  open: boolean; onClose: () => void;
  onConfirm: (reason: string) => void; loading: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Cancel booking?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Please let us know why you're cancelling. This helps us improve our service.
        </Typography>
        <TextField
          label="Reason (optional)"
          multiline rows={3} fullWidth
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="E.g. Schedule changed, no longer needed…"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>Keep booking</Button>
        <Button
          variant="contained" color="error"
          onClick={() => onConfirm(reason)}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {loading ? 'Cancelling…' : 'Yes, cancel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CustomerBookingDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const { data: booking, isLoading, error, refetch, isFetching } = useMyBooking(id!);
  const cancelMutation = useCancelMyBooking();

  const [cancelOpen,    setCancelOpen]    = useState(false);
  const [cancelError,   setCancelError]   = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [reviewOpen,    setReviewOpen]    = useState(false);
  const [hasReviewed,   setHasReviewed]   = useState(false);

  const handleCancel = async (reason: string) => {
    setCancelError('');
    try {
      await cancelMutation.mutateAsync({ id: id!, reason: reason || undefined });
      setCancelOpen(false);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error).message ?? 'Could not cancel booking.';
      setCancelError(Array.isArray(msg) ? msg.join('. ') : String(msg));
    }
  };

  if (isLoading) {
    return <Box textAlign="center" py={6}><CircularProgress /></Box>;
  }

  if (error || !booking) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(paths.customerBookings)} sx={{ mb: 2 }}>
          Back to bookings
        </Button>
        <Alert severity="error">Could not load booking. Please try again.</Alert>
      </Box>
    );
  }

  const canCancel     = CANCELLABLE.has(booking.status);
  const canReschedule = RESCHEDULABLE.has(booking.status);
  const canPay        = PAYABLE.has(booking.status) && NON_TERMINAL.has(booking.status);
  const isCompleted   = booking.status === 'COMPLETED';
  const isTerminal    = !NON_TERMINAL.has(booking.status);

  const addr = booking.address;
  const addressLine = addr
    ? [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ')
    : booking.address_line ?? '—';

  const priority = booking.priority;
  const priorityColor = priority && priority !== 'NORMAL' ? PRIORITY_COLOR[priority] : null;

  return (
    <Box sx={{ maxWidth: 680, mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={() => navigate(paths.customerBookings)} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h6" fontWeight={800}>Booking detail</Typography>
            {booking.booking_number && (
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                #{booking.booking_number}
              </Typography>
            )}
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          {priorityColor && (
            <Chip
              icon={<PriorityHighIcon sx={{ fontSize: '14px !important', color: `${priorityColor} !important` }} />}
              label={priority}
              size="small"
              sx={{ bgcolor: `${priorityColor}18`, color: priorityColor, fontWeight: 700 }}
            />
          )}
          <Tooltip title="Refresh status">
            <IconButton onClick={() => refetch()} disabled={isFetching}>
              <RefreshIcon
                sx={{
                  animation: isFetching ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
                }}
              />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {cancelError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setCancelError('')}>
          {cancelError}
        </Alert>
      )}

      {/* Live status banner */}
      <LiveStatusBanner booking={booking} />

      {/* Progress stepper */}
      <ProgressStepper status={booking.status} />

      {/* Technician assigned */}
      <TechnicianCard booking={booking} />

      {/* Warranty card (COMPLETED only) */}
      {isCompleted && <WarrantyBanner bookingId={booking.id} />}

      {/* Booking info */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent sx={{ pb: '16px !important' }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
            Booking details
          </Typography>
          <InfoRow
            icon={<HomeRepairServiceIcon fontSize="small" />}
            label="Service"
            value={booking.service?.name ?? booking.service_name ?? '—'}
          />
          <InfoRow
            icon={<ScheduleIcon fontSize="small" />}
            label="Scheduled"
            value={booking.scheduled_window_start
              ? `${fmt(booking.scheduled_window_start)} · ${fmtTime(booking.scheduled_window_start)}`
              : '—'}
          />
          <InfoRow
            icon={<LocationOnIcon fontSize="small" />}
            label="Address"
            value={
              <Box>
                {addressLine}
                {addr?.access_notes && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Access: {addr.access_notes}
                  </Typography>
                )}
              </Box>
            }
          />
          {(booking.discount_amount ?? 0) > 0 ? (
            <InfoRow
              icon={<CheckCircleIcon fontSize="small" />}
              label="Amount"
              value={
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Base: {formatMoney(booking.price, booking.currency)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#2E7D32', fontWeight: 600 }}>
                    Coupon: -{formatMoney(booking.discount_amount!, booking.currency)}
                  </Typography>
                  <Typography variant="body2" fontWeight={700}>
                    Subtotal: {formatMoney(Number(booking.price) - Number(booking.discount_amount), booking.currency)} + taxes
                  </Typography>
                </Box>
              }
            />
          ) : (
            <InfoRow
              icon={<CheckCircleIcon fontSize="small" />}
              label="Amount"
              value={formatMoney(booking.price, booking.currency)}
            />
          )}
          {booking.notes && (
            <InfoRow
              icon={<ScheduleIcon fontSize="small" />}
              label="Notes"
              value={booking.notes}
            />
          )}
          {booking.cancellation_reason && (
            <InfoRow
              icon={<CancelIcon fontSize="small" />}
              label="Cancellation reason"
              value={booking.cancellation_reason}
            />
          )}
        </CardContent>
      </Card>

      {/* Status timeline */}
      {(booking.status_history?.length ?? 0) > 0 && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <StatusTimeline booking={booking} />
          </CardContent>
        </Card>
      )}

      {/* Coupon — only for PENDING bookings that don't have one yet */}
      {booking.status === 'PENDING' && Number(booking.discount_amount ?? 0) === 0 && (
        <CouponSection bookingId={booking.id} currency={booking.currency} />
      )}

      <Divider sx={{ mb: 2 }} />

      {/* Actions */}
      <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1.5} justifyContent="flex-end">
        {/* Pay now */}
        {canPay && (
          <PayNowButton
            bookingId={booking.id}
            amount={booking.price}
            currency={booking.currency}
          />
        )}

        {/* Reschedule */}
        {canReschedule && (
          <Button
            variant="outlined"
            startIcon={<CalendarMonthIcon />}
            onClick={() => setRescheduleOpen(true)}
          >
            Reschedule
          </Button>
        )}

        {/* Leave review / reviewed */}
        {isCompleted && (hasReviewed || booking.has_review) && (
          <Chip
            icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
            label="Review submitted"
            sx={{ color: '#2E7D32', borderColor: '#2E7D32', bgcolor: '#E8F5E9', fontWeight: 600 }}
            variant="outlined"
          />
        )}
        {isCompleted && !hasReviewed && !booking.has_review && (
          <Button
            variant="outlined"
            startIcon={<StarIcon />}
            onClick={() => setReviewOpen(true)}
            sx={{ borderColor: '#FF9800', color: '#FF9800', '&:hover': { borderColor: '#E65100', color: '#E65100', bgcolor: '#FFF3E0' } }}
          >
            Leave a review
          </Button>
        )}

        {/* Book again */}
        {(isCompleted || isTerminal) && (
          <Button
            variant="outlined"
            startIcon={<ReplayIcon />}
            onClick={() => navigate(paths.customerBook, {
              state: {
                prefillServiceId: booking.service?.id,
                prefillPackageId: booking.package?.id,
              },
            })}
          >
            Book again
          </Button>
        )}

        {/* Cancel */}
        {canCancel && (
          <Button
            variant="outlined" color="error"
            startIcon={<CancelIcon />}
            onClick={() => setCancelOpen(true)}
          >
            Cancel booking
          </Button>
        )}

        <Button variant="outlined" onClick={() => navigate(paths.customerBookings)}>
          Back to bookings
        </Button>
      </Stack>

      {/* Dialogs */}
      <CancelDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        loading={cancelMutation.isPending}
      />
      <RescheduleDialog
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        bookingId={booking.id}
      />
      <ReviewDialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        bookingId={booking.id}
        onReviewed={() => setHasReviewed(true)}
      />
    </Box>
  );
}
