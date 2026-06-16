// src/features/analytics/AnalyticsLayout.tsx
// Shell for the analytics section: a tab bar that routes between domain views and the
// shared filter bar (date range / granularity / scope). Sub-pages read the same URL filters
// via useAnalyticsFilters, so switching tabs preserves the active range.

import { Tab, Tabs } from '@mui/material';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common';
import { paths } from '@/routes/paths';
import { AnalyticsFiltersBar } from './filters';

const TABS = [
  { label: 'Executive', path: paths.analytics },
  { label: 'Revenue', path: `${paths.analytics}/revenue` },
  { label: 'Bookings', path: `${paths.analytics}/bookings` },
  { label: 'Customers', path: `${paths.analytics}/customers` },
  { label: 'Technicians', path: `${paths.analytics}/technicians` },
  { label: 'Subscriptions', path: `${paths.analytics}/subscriptions` },
  { label: 'Reviews', path: `${paths.analytics}/reviews` },
  { label: 'Services', path: `${paths.analytics}/services` },
];

export function AnalyticsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const search = location.search; // preserve filters across tabs
  const current = TABS.findIndex((t) => t.path === location.pathname);

  return (
    <>
      <PageHeader title="Analytics" subtitle="Business intelligence across the platform" />
      <Tabs
        value={current === -1 ? 0 : current}
        onChange={(_, i) => navigate(`${TABS[i].path}${search}`)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {TABS.map((t) => <Tab key={t.path} label={t.label} />)}
      </Tabs>
      <AnalyticsFiltersBar />
      <Outlet />
    </>
  );
}
