// src/layouts/AuthLayout.tsx
// Centered shell for unauthenticated pages (login, register). If already authenticated,
// bounce each role to its own portal so the auth pages aren't reachable with a live session.

import { Box, Paper } from '@mui/material';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { FullScreenLoader } from '@/components/feedback';
import { paths } from '@/routes/paths';

export function AuthLayout() {
  const { status, user } = useAuth();
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'authenticated') {
    if (user?.role === 'CUSTOMER') return <Navigate to={paths.customerDashboard} replace />;
    if (user?.role === 'TECHNICIAN') return <Navigate to={paths.technicianDashboard} replace />;
    return <Navigate to={paths.dashboard} replace />;
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 2 }}>
      <Paper variant="outlined" sx={{ width: '100%', maxWidth: 420, p: { xs: 3, sm: 4 } }}>
        <Outlet />
      </Paper>
    </Box>
  );
}
