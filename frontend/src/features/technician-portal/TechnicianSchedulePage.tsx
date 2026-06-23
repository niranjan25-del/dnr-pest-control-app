import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardActionArea, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { CalendarToday as CalIcon } from '@mui/icons-material';
import { paths } from '@/routes/paths';
import { useTechJobs } from './hooks';
import { STATUS_COLOR, STATUS_LABEL } from './types';

const BRAND = '#1E8E5A';

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function TechnicianSchedulePage() {
  const { data: jobs = [], isLoading } = useTechJobs();
  const navigate = useNavigate();

  const now    = new Date();
  const today  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days   = Array.from({ length: 14 }, (_, i) => new Date(today.getTime() + i * 86400000));

  const [selected, setSelected] = useState<Date>(today);

  const scheduled = jobs.filter((j) => j.scheduled_window_start);

  function jobsForDay(day: Date) {
    return scheduled
      .filter((j) => sameDay(new Date(j.scheduled_window_start!), day))
      .sort((a, b) => new Date(a.scheduled_window_start!).getTime() - new Date(b.scheduled_window_start!).getTime());
  }

  function hasJobs(day: Date) {
    return scheduled.some((j) => sameDay(new Date(j.scheduled_window_start!), day));
  }

  const dayLabel = () => {
    if (sameDay(selected, today)) return `Today · ${selected.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    const tomorrow = new Date(today.getTime() + 86400000);
    if (sameDay(selected, tomorrow)) return `Tomorrow · ${selected.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    return selected.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const dayJobs = jobsForDay(selected);

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} mb={2}>Schedule</Typography>

      {/* Day picker */}
      <Box sx={{ overflowX: 'auto', pb: 1, mb: 0 }}>
        <Stack direction="row" spacing={1} sx={{ width: 'max-content', px: 0.5 }}>
          {days.map((day) => {
            const isToday = sameDay(day, today);
            const isSel   = sameDay(day, selected);
            const has     = hasJobs(day);
            return (
              <Box key={day.toISOString()} onClick={() => setSelected(day)}
                sx={{
                  width: 52, py: 1.5, borderRadius: 2, textAlign: 'center', cursor: 'pointer',
                  bgcolor: isSel ? BRAND : isToday ? `${BRAND}18` : 'background.paper',
                  border: `1px solid ${isSel ? BRAND : isToday ? `${BRAND}40` : 'divider'}`,
                  transition: 'all 0.15s',
                }}>
                <Typography variant="caption" sx={{ color: isSel ? 'rgba(255,255,255,0.7)' : 'text.secondary', display: 'block' }}>
                  {day.toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 1)}
                </Typography>
                <Typography fontWeight={800} sx={{ color: isSel ? '#fff' : 'text.primary' }}>{day.getDate()}</Typography>
                <Box sx={{ width: 5, height: 5, borderRadius: '50%', mx: 'auto', mt: 0.5,
                  bgcolor: has ? (isSel ? 'rgba(255,255,255,0.7)' : BRAND) : 'transparent' }} />
              </Box>
            );
          })}
        </Stack>
      </Box>

      {/* Day label */}
      <Box sx={{ bgcolor: 'action.hover', px: 2, py: 1.5, borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Typography fontWeight={700}>{dayLabel()}</Typography>
      </Box>

      {isLoading ? (
        <Box textAlign="center" py={4}><CircularProgress /></Box>
      ) : dayJobs.length === 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: 'center', bgcolor: 'action.hover' }}>
          <CalIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">No jobs scheduled</Typography>
          <Typography variant="caption" color="text.disabled">Select another day to see your schedule</Typography>
        </Card>
      ) : (
        <Stack spacing={0}>
          {dayJobs.map((job, i) => {
            const color = STATUS_COLOR[job.status] ?? '#9E9E9E';
            return (
              <Box key={job.id} sx={{ display: 'flex', alignItems: 'stretch' }}>
                {/* Time column */}
                <Box sx={{ width: 60, pt: 1.5, pr: 1.5, textAlign: 'right', flexShrink: 0 }}>
                  <Typography variant="caption" fontWeight={700} sx={{ color }}>{fmt(job.scheduled_window_start!)}</Typography>
                </Box>
                {/* Timeline dot + line */}
                <Stack alignItems="center" sx={{ width: 20, flexShrink: 0 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color, border: '2px solid white', boxShadow: `0 0 0 2px ${color}`, flexShrink: 0, mt: 1.5 }} />
                  {i < dayJobs.length - 1 && <Box sx={{ flex: 1, width: 2, bgcolor: 'divider', my: 0.5 }} />}
                </Stack>
                {/* Card */}
                <Box sx={{ flex: 1, pl: 1.5, pb: 1.5 }}>
                  <Card variant="outlined" sx={{ overflow: 'hidden' }}>
                    <CardActionArea onClick={() => navigate(`${paths.technicianJobs}/${job.id}`)} sx={{ p: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontWeight={700} noWrap>{job.service_name ?? 'Service'}</Typography>
                          {job.customer_name && <Typography variant="caption" color="text.secondary">{job.customer_name}</Typography>}
                          {job.address_line  && <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }} noWrap>{job.address_line}</Typography>}
                        </Box>
                        <Chip size="small" label={STATUS_LABEL[job.status]} sx={{ bgcolor: `${color}18`, color, fontWeight: 700, fontSize: 11, ml: 1 }} />
                      </Stack>
                    </CardActionArea>
                  </Card>
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
