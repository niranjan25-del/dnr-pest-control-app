// src/pages/DashboardHomePage.tsx
// Executive KPI overview. Pulls from GET /analytics/dashboard (admin-only).

import { Box, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/PeopleOutline';
import EventNoteIcon from '@mui/icons-material/EventNoteOutlined';
import EngineeringIcon from '@mui/icons-material/EngineeringOutlined';
import SubscriptionsIcon from '@mui/icons-material/Subscriptions';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { useAuth } from '@/hooks/useAuth';

interface DashboardKpis {
  total_revenue: number;
  monthly_revenue: number;
  total_customers: number;
  active_customers: number;
  total_bookings: number;
  completed_bookings: number;
  active_technicians: number;
  active_subscriptions: number;
  generated_at: string;
}

function useDashboardKpis() {
  return useQuery<DashboardKpis>({
    queryKey: ['analytics', 'dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardKpis>('/analytics/dashboard');
      return data;
    },
    staleTime: 60_000,
  });
}

function fmt(n: number | undefined, currency?: string): string {
  if (n == null) return '—';
  if (currency) return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  return n.toLocaleString('en-IN');
}

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color?: string;
}

function KpiCard({ label, value, sub, icon, color }: KpiCardProps) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {label}
            </Typography>
            <Typography variant="h3" sx={{ mt: 0.5, fontWeight: 700 }}>{value}</Typography>
            {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
          </Box>
          <Box sx={{ color: color ?? 'primary.main', opacity: 0.8, mt: 0.5 }}>{icon}</Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function DashboardHomePage() {
  const { user } = useAuth();
  const { data: kpis, isLoading, error } = useDashboardKpis();

  const firstName = user?.full_name?.split(' ')[0] ?? '';

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h2">Welcome{firstName ? `, ${firstName}` : ''}</Typography>
        <Typography color="text.secondary">
          {kpis ? `Last updated ${new Date(kpis.generated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Loading KPIs…'}
        </Typography>
      </Box>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Card sx={{ bgcolor: 'error.lighter' }}>
          <CardContent>
            <Typography color="error">Could not load dashboard KPIs. Check that the backend is running.</Typography>
          </CardContent>
        </Card>
      )}

      {kpis && (
        <>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <KpiCard
                label="Total revenue"
                value={fmt(kpis.total_revenue, 'INR')}
                sub={`This month: ${fmt(kpis.monthly_revenue, 'INR')}`}
                icon={<TrendingUpIcon fontSize="large" />}
                color="success.main"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <KpiCard
                label="Customers"
                value={fmt(kpis.total_customers)}
                sub={`${fmt(kpis.active_customers)} active (30 d)`}
                icon={<PeopleIcon fontSize="large" />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <KpiCard
                label="Bookings"
                value={fmt(kpis.total_bookings)}
                sub={`${fmt(kpis.completed_bookings)} completed`}
                icon={<EventNoteIcon fontSize="large" />}
                color="info.main"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <KpiCard
                label="Technicians"
                value={fmt(kpis.active_technicians)}
                sub="available now"
                icon={<EngineeringIcon fontSize="large" />}
                color="warning.main"
              />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <KpiCard
                label="Active subscriptions"
                value={fmt(kpis.active_subscriptions)}
                sub="recurring plans"
                icon={<SubscriptionsIcon fontSize="large" />}
                color="secondary.main"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <KpiCard
                label="Completion rate"
                value={kpis.total_bookings > 0 ? `${Math.round((kpis.completed_bookings / kpis.total_bookings) * 100)}%` : '—'}
                sub={`${fmt(kpis.completed_bookings)} of ${fmt(kpis.total_bookings)} bookings`}
                icon={<CheckCircleIcon fontSize="large" />}
                color="success.main"
              />
            </Grid>
          </Grid>
        </>
      )}
    </Stack>
  );
}
