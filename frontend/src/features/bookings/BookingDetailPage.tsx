// src/features/bookings/BookingDetailPage.tsx
// Booking detail: summary, customer/address, status timeline, and admin actions
// (assign/reassign, reschedule, cancel) — each gated by permission. Reschedule uses a
// datetime-local pair; cancel goes through the confirm dialog.

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, Chip, Divider, Stack, TextField, Typography,
} from '@mui/material';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CancelIcon from '@mui/icons-material/Cancel';
import { PageHeader, StatusChip, Can, useConfirm } from '@/components/common';
import { LoadingScreen, ErrorState } from '@/components/feedback';
import { Permission } from '@/features/auth/permissions';
import { formatDateTime, formatMoney } from '@/utils/format';
import { paths } from '@/routes/paths';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { useToast } from '@/providers/ToastProvider';
import Grid from '@mui/material/Grid2';
import { useBooking, useBookingHistory, useBookingMutations } from './hooks';
import { AssignTechnicianDialog } from './AssignTechnicianDialog';

interface ServiceReport {
  id: string;
  status: string;
  summary: string | null;
  recommendations: string | null;
  findings: string[];
  services: string[];
  chemicals: { chemicalName: string; quantity: string | null }[];
  safety_notes: string[];
  has_signature: boolean;
  submitted_at: string | null;
}

function ServiceReportCard({ bookingId }: { bookingId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: reports, isLoading } = useQuery<{ data: ServiceReport[] }>({
    queryKey: ['service-reports', 'booking', bookingId],
    queryFn: async () => {
      const { data } = await apiClient.get('/service-reports', { params: { bookingId } });
      return data;
    },
  });

  const report = reports?.data?.[0];

  const approve = useMutation({
    mutationFn: () => apiClient.post(`/service-reports/${report!.id}/approve`),
    onSuccess: () => { toast.success('Report approved'); qc.invalidateQueries({ queryKey: ['service-reports', 'booking', bookingId] }); },
    onError: () => toast.error('Approve failed'),
  });

  const reject = useMutation({
    mutationFn: () => apiClient.post(`/service-reports/${report!.id}/reject`, { reason: 'Rejected by admin' }),
    onSuccess: () => { toast.success('Report rejected'); qc.invalidateQueries({ queryKey: ['service-reports', 'booking', bookingId] }); },
    onError: () => toast.error('Reject failed'),
  });

  if (isLoading) return null;
  if (!report) return null;

  const statusColor = report.status === 'APPROVED' ? 'success' : report.status === 'REJECTED' ? 'error' : report.status === 'SUBMITTED' ? 'info' : 'default';

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="h4">Service report</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" label={report.status} color={statusColor as 'success' | 'error' | 'info' | 'default'} />
            {report.status === 'SUBMITTED' && (
              <Can permission={Permission.ModifyBooking}>
                <Button size="small" color="success" onClick={() => approve.mutate()} disabled={approve.isPending}>Approve</Button>
                <Button size="small" color="error" onClick={() => reject.mutate()} disabled={reject.isPending}>Reject</Button>
              </Can>
            )}
          </Stack>
        </Stack>
        {report.summary && <Field label="Summary" value={report.summary} />}
        {report.recommendations && <Field label="Recommendations" value={report.recommendations} />}
        {report.findings.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Findings</Typography>
            <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>{report.findings.map((f, i) => <li key={i}><Typography variant="body2">{f}</Typography></li>)}</ul>
          </Box>
        )}
        {report.services.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Services performed</Typography>
            <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>{report.services.map((s, i) => <li key={i}><Typography variant="body2">{s}</Typography></li>)}</ul>
          </Box>
        )}
        {report.chemicals.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Chemicals used</Typography>
            <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>{report.chemicals.map((c, i) => <li key={i}><Typography variant="body2">{c.chemicalName}{c.quantity ? ` — ${c.quantity}` : ''}</Typography></li>)}</ul>
          </Box>
        )}
        <Field label="Technician signature" value={report.has_signature ? 'Captured' : 'Not captured'} />
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2">{value || '—'}</Typography>
    </Box>
  );
}

export function BookingDetailPage() {
  const { id = '' } = useParams();
  const confirm = useConfirm();
  const { data: booking, isLoading, error, refetch } = useBooking(id);
  const { data: history } = useBookingHistory(id);
  const { cancel, reschedule } = useBookingMutations(id);

  const [dialog, setDialog] = useState<'assign' | 'reassign' | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  if (isLoading) return <LoadingScreen />;
  if (error || !booking) return <ErrorState error={error} onRetry={refetch} />;

  const hasTech = Boolean(booking.technician?.id);
  const isTerminal = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(booking.status);

  const onCancel = async () => {
    const ok = await confirm({ title: 'Cancel booking?', message: 'This cancels the booking and notifies the customer. A cancellation fee may apply.', confirmText: 'Cancel booking', destructive: true });
    if (ok) await cancel.mutateAsync(undefined);
  };

  const onReschedule = async () => {
    if (!start || !end) return;
    await reschedule.mutateAsync({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
    setRescheduling(false);
  };

  return (
    <>
      <PageHeader
        title={`Booking ${booking.id.slice(0, 8)}`}
        crumbs={[{ label: 'Bookings', to: paths.bookings }, { label: 'Detail' }]}
        actions={
          !isTerminal ? (
            <>
              <Can permission={Permission.AssignTechnician}>
                {hasTech ? (
                  <Button startIcon={<SwapHorizIcon />} variant="outlined" onClick={() => setDialog('reassign')}>Reassign</Button>
                ) : (
                  <Button startIcon={<PersonAddIcon />} variant="contained" onClick={() => setDialog('assign')}>Assign</Button>
                )}
              </Can>
              <Can permission={Permission.ModifyBooking}>
                <Button startIcon={<EditCalendarIcon />} variant="outlined" onClick={() => setRescheduling((v) => !v)}>Reschedule</Button>
                <Button startIcon={<CancelIcon />} color="error" variant="outlined" onClick={onCancel}>Cancel</Button>
              </Can>
            </>
          ) : undefined
        }
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h4">{booking.service?.name ?? booking.service_name}</Typography>
                <StatusChip status={booking.status} />
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid size={6}><Field label="Scheduled start" value={formatDateTime(booking.scheduled_window_start)} /></Grid>
                <Grid size={6}><Field label="Scheduled end" value={formatDateTime(booking.scheduled_window_end)} /></Grid>
                <Grid size={6}><Field label="Technician" value={booking.technician?.full_name ?? 'Unassigned'} /></Grid>
                <Grid size={6}><Field label="Amount" value={formatMoney(booking.price, booking.currency)} /></Grid>
                <Grid size={12}>
                  <Field label="Address" value={[booking.address?.line1, booking.address?.city, booking.address?.state, booking.address?.postal_code].filter(Boolean).join(', ')} />
                </Grid>
                {booking.address?.access_notes && <Grid size={12}><Field label="Access notes" value={booking.address.access_notes} /></Grid>}
                {booking.notes && <Grid size={12}><Field label="Customer notes" value={booking.notes} /></Grid>}
              </Grid>

              {rescheduling && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>New window</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                    <TextField type="datetime-local" label="Start" InputLabelProps={{ shrink: true }} value={start} onChange={(e) => setStart(e.target.value)} />
                    <TextField type="datetime-local" label="End" InputLabelProps={{ shrink: true }} value={end} onChange={(e) => setEnd(e.target.value)} />
                    <Button variant="contained" onClick={onReschedule} disabled={!start || !end || reschedule.isPending}>Save</Button>
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h4" gutterBottom>Customer</Typography>
              <Field label="Name" value={booking.customer?.full_name} />
              <Field label="Phone" value={booking.customer?.phone} />
              <Field label="Email" value={booking.customer?.email} />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="h4" gutterBottom>Status history</Typography>
              {(history ?? []).length === 0 && <Typography color="text.secondary" variant="body2">No history yet.</Typography>}
              <Stack spacing={1.5}>
                {(history ?? []).map((h) => (
                  <Box key={h.id}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <StatusChip status={h.new_status} />
                      <Typography variant="caption" color="text.secondary">{formatDateTime(h.created_at)}</Typography>
                    </Stack>
                    {h.note && <Typography variant="body2" sx={{ mt: 0.5 }}>{h.note}</Typography>}
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
          <ServiceReportCard bookingId={id} />
        </Grid>
      </Grid>

      {dialog && <AssignTechnicianDialog bookingId={id} open onClose={() => setDialog(null)} mode={dialog} />}
    </>
  );
}
