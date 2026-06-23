// src/features/attendance/AttendancePage.tsx
// Admin view: all technician punch-in / punch-out records, filterable by date range
// and technician. Shows on-duty status badge, duration, and daily summary.

import { useState } from 'react';
import {
  Alert, Box, Card, Chip, CircularProgress, Divider, IconButton,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from '@mui/material';
import {
  AccessTime as ClockIcon,
  CalendarToday as CalIcon,
  CheckCircle as InIcon,
  ExitToApp as OutIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';
import { useAttendanceList } from './hooks';
import type { DutyLog } from './types';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDuration(minutes: number | null) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function StatusChip({ log }: { log: DutyLog }) {
  if (!log.punched_out_at) {
    return <Chip size="small" icon={<InIcon sx={{ fontSize: '14px !important' }} />} label="On duty" color="success" />;
  }
  return <Chip size="small" icon={<OutIcon sx={{ fontSize: '14px !important' }} />} label="Done" color="default" />;
}

export function AttendancePage() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch } = useAttendanceList({ from, to, limit: 200 });

  const rows = (data?.data ?? []).filter((r) =>
    !search || r.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  // Summary stats
  const onDuty     = rows.filter((r) => !r.punched_out_at).length;
  const punchedOut = rows.filter((r) => !!r.punched_out_at).length;
  const avgDur     = rows.filter((r) => r.duration_minutes != null).reduce((s, r) => s + (r.duration_minutes ?? 0), 0);
  const avgDurCount = rows.filter((r) => r.duration_minutes != null).length;

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Technician Attendance</Typography>
          <Typography variant="body2" color="text.secondary">Daily punch-in / punch-out records</Typography>
        </Box>
        <IconButton onClick={() => refetch()} disabled={isLoading}>
          <RefreshIcon />
        </IconButton>
      </Stack>

      {/* Filters */}
      <Card variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            label="From" type="date" size="small"
            InputLabelProps={{ shrink: true }} value={from}
            onChange={(e) => setFrom(e.target.value)}
            sx={{ minWidth: 160 }}
          />
          <TextField
            label="To" type="date" size="small"
            InputLabelProps={{ shrink: true }} value={to}
            onChange={(e) => setTo(e.target.value)}
            sx={{ minWidth: 160 }}
          />
          <TextField
            label="Search technician" size="small" value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1, minWidth: 200 }}
          />
        </Stack>
      </Card>

      {/* Summary cards */}
      <Stack direction="row" spacing={2} mb={3} flexWrap="wrap">
        <Card variant="outlined" sx={{ px: 3, py: 2, flex: 1, minWidth: 140 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <InIcon sx={{ color: 'success.main' }} />
            <Box>
              <Typography variant="h5" fontWeight={700} color="success.main">{onDuty}</Typography>
              <Typography variant="caption" color="text.secondary">Currently on duty</Typography>
            </Box>
          </Stack>
        </Card>
        <Card variant="outlined" sx={{ px: 3, py: 2, flex: 1, minWidth: 140 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <OutIcon sx={{ color: 'text.secondary' }} />
            <Box>
              <Typography variant="h5" fontWeight={700}>{punchedOut}</Typography>
              <Typography variant="caption" color="text.secondary">Punched out</Typography>
            </Box>
          </Stack>
        </Card>
        <Card variant="outlined" sx={{ px: 3, py: 2, flex: 1, minWidth: 140 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <TimerIcon sx={{ color: 'primary.main' }} />
            <Box>
              <Typography variant="h5" fontWeight={700} color="primary.main">
                {avgDurCount > 0 ? fmtDuration(Math.round(avgDur / avgDurCount)) : '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">Avg shift duration</Typography>
            </Box>
          </Stack>
        </Card>
        <Card variant="outlined" sx={{ px: 3, py: 2, flex: 1, minWidth: 140 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <PersonIcon sx={{ color: 'info.main' }} />
            <Box>
              <Typography variant="h5" fontWeight={700} color="info.main">{rows.length}</Typography>
              <Typography variant="caption" color="text.secondary">Total punches</Typography>
            </Box>
          </Stack>
        </Card>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>Failed to load attendance data.</Alert>
      )}

      {isLoading ? (
        <Box textAlign="center" py={6}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Card variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
          <CalIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">No attendance records for the selected period.</Typography>
        </Card>
      ) : (
        <Card variant="outlined">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Technician</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <InIcon sx={{ fontSize: 14, color: 'success.main' }} />
                      <span>Punch In</span>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <OutIcon sx={{ fontSize: 14, color: 'error.main' }} />
                      <span>Punch Out</span>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <ClockIcon sx={{ fontSize: 14 }} />
                      <span>Duration</span>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Note</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{row.full_name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{fmtDate(row.date)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} color="success.main">
                        {fmtTime(row.punched_in_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} color={row.punched_out_at ? 'text.primary' : 'text.disabled'}>
                        {fmtTime(row.punched_out_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{fmtDuration(row.duration_minutes)}</Typography>
                    </TableCell>
                    <TableCell><StatusChip log={row} /></TableCell>
                    <TableCell>
                      {row.note ? (
                        <Tooltip title={row.note}>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 160, display: 'block' }}>
                            {row.note}
                          </Typography>
                        </Tooltip>
                      ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Divider />
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {rows.length} record{rows.length !== 1 ? 's' : ''} · {data?.total ?? rows.length} total
            </Typography>
          </Box>
        </Card>
      )}
    </Box>
  );
}
