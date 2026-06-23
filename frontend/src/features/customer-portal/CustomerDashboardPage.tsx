import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Divider, Stack, Typography,
} from '@mui/material';
import {
  Add as AddIcon, CalendarMonth as CalendarIcon, CheckCircle as DoneIcon,
  HourglassEmpty as ActiveIcon, Upcoming as UpcomingIcon,
} from '@mui/icons-material';
import { useServerTable } from '@/hooks/useServerTable';
import { formatMoney } from '@/utils/format';
import { paths } from '@/routes/paths';
import { useMyProfile, useMyBookings } from './hooks';
import type { CustomerBooking } from './types';

const BRAND = '#1565C0';

const STATUS_COLOR: Record<string, string> = {
  PENDING:     '#FF9800',
  CONFIRMED:   '#2196F3',
  EN_ROUTE:    '#9C27B0',
  ARRIVED:     '#9C27B0',
  IN_PROGRESS: '#1E8E5A',
  COMPLETED:   '#4CAF50',
  CANCELLED:   '#F44336',
  NO_SHOW:     '#9E9E9E',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING:     'Pending',
  CONFIRMED:   'Confirmed',
  EN_ROUTE:    'En route',
  ARRIVED:     'Arrived',
  IN_PROGRESS: 'In progress',
  COMPLETED:   'Completed',
  CANCELLED:   'Cancelled',
  NO_SHOW:     'No show',
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function fmt(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function isUpcoming(b: CustomerBooking) {
  const active = ['PENDING', 'CONFIRMED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'];
  return active.includes(b.status);
}

function BookingCard({ booking, onClick }: { booking: CustomerBooking; onClick: () => void }) {
  const color = STATUS_COLOR[booking.status] ?? '#9E9E9E';
  return (
    <Card
      variant="outlined"
      sx={{ mb: 1.5, overflow: 'hidden', cursor: 'pointer', '&:hover': { borderColor: color, boxShadow: 1 }, transition: 'all 0.15s' }}
      onClick={onClick}
    >
      <Box sx={{ display: 'flex' }}>
        <Box sx={{ width: 5, bgcolor: color, flexShrink: 0 }} />
        <Box sx={{ flex: 1, p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {booking.scheduled_window_start && (
                <Typography variant="caption" fontWeight={700} sx={{ color }}>
                  {fmt(booking.scheduled_window_start)} · {fmtTime(booking.scheduled_window_start)}
                </Typography>
              )}
              <Typography fontWeight={700} noWrap>{booking.service_name ?? 'Pest Control Service'}</Typography>
              {booking.technician_name && (
                <Typography variant="caption" sx={{ color, display: 'block', fontWeight: 600 }} noWrap>
                  Technician: {booking.technician_name}
                </Typography>
              )}
              {booking.address_line && (
                <Typography variant="caption" color="text.disabled" noWrap sx={{ display: 'block' }}>
                  {booking.address_line}
                </Typography>
              )}
            </Box>
            <Stack alignItems="flex-end" spacing={0.5} ml={1}>
              <Chip size="small" label={STATUS_LABEL[booking.status] ?? booking.status}
                sx={{ bgcolor: `${color}18`, color, fontWeight: 700, fontSize: 11 }} />
              <Typography variant="caption" fontWeight={700}>
                {formatMoney(booking.price, booking.currency)}
              </Typography>
            </Stack>
          </Stack>
        </Box>
      </Box>
    </Card>
  );
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

export function CustomerDashboardPage() {
  const navigate = useNavigate();
  const { data: profile, isLoading: loadingProfile } = useMyProfile();
  const table = useServerTable({ defaultLimit: 20 });
  const { data: bookingsData, isLoading: loadingBookings, error } = useMyBookings(table.apiParams);

  const bookings = bookingsData?.data ?? [];
  const upcoming = bookings.filter(isUpcoming);
  const completed = bookings.filter((b) => b.status === 'COMPLETED');
  const total = bookingsData?.meta.total ?? 0;

  return (
    <Box>
      {/* Hero */}
      <Card sx={{ mb: 3, background: `linear-gradient(135deg, ${BRAND} 0%, #0D47A1 100%)`, color: '#fff', overflow: 'hidden', position: 'relative' }}>
        <Box sx={{ position: 'absolute', top: -30, right: -30, width: 150, height: 150, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)' }} />
        <Box sx={{ p: 3, position: 'relative' }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{greeting()},</Typography>
          {loadingProfile ? (
            <CircularProgress size={20} sx={{ color: '#fff', my: 1 }} />
          ) : (
            <Typography variant="h5" fontWeight={800} mb={0.5}>{profile?.full_name ?? 'Customer'}</Typography>
          )}
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => navigate(paths.customerBook)}
            sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)', color: '#fff', fontWeight: 700, '&:hover': { bgcolor: 'rgba(255,255,255,0.28)' } }}
          >
            Book a Service
          </Button>
        </Box>
      </Card>

      {/* Stats */}
      <Stack direction="row" spacing={1.5} mb={3}>
        <StatCard label="Total" value={total} icon={<CalendarIcon />} color={BRAND} />
        <StatCard label="Active" value={upcoming.length} icon={<ActiveIcon />} color="#FF9800" />
        <StatCard label="Done" value={completed.length} icon={<DoneIcon />} color="#4CAF50" />
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>Could not load bookings.</Alert>}

      {loadingBookings ? (
        <Box textAlign="center" py={4}><CircularProgress /></Box>
      ) : (
        <>
          {/* Upcoming bookings */}
          {upcoming.length > 0 && (
            <Box mb={3}>
              <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                <UpcomingIcon sx={{ color: BRAND, fontSize: 20 }} />
                <Typography variant="h6" fontWeight={700}>Upcoming</Typography>
                <Chip size="small" label={upcoming.length} sx={{ bgcolor: `${BRAND}18`, color: BRAND, fontWeight: 700 }} />
              </Stack>
              {upcoming.map((b) => (
                <BookingCard key={b.id} booking={b} onClick={() => navigate(paths.customerBookingDetail.replace(':id', b.id))} />
              ))}
            </Box>
          )}

          {/* Recent completed */}
          {completed.length > 0 && (
            <Box mb={3}>
              <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                <DoneIcon sx={{ color: '#4CAF50', fontSize: 20 }} />
                <Typography variant="h6" fontWeight={700}>Recent</Typography>
              </Stack>
              {completed.slice(0, 3).map((b) => (
                <BookingCard key={b.id} booking={b} onClick={() => navigate(paths.customerBookingDetail.replace(':id', b.id))} />
              ))}
            </Box>
          )}

          {upcoming.length === 0 && completed.length === 0 && (
            <Card variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
              <CalendarIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">No bookings yet.</Typography>
            </Card>
          )}

          {total > 5 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Button fullWidth variant="outlined" onClick={() => navigate(paths.customerBookings)}>
                View all {total} bookings
              </Button>
            </>
          )}
        </>
      )}
    </Box>
  );
}
