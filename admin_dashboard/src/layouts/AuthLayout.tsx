// src/layouts/AuthLayout.tsx
// Centered shell for unauthenticated pages (login). If already authenticated, bounce to the
// dashboard so the login page isn't reachable with a live session.

import { Box, Paper } from '@mui/material';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { FullScreenLoader } from '@/components/feedback';
import { paths } from '@/routes/paths';

export function AuthLayout() {
  const { status } = useAuth();
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'authenticated') return <Navigate to={paths.dashboard} replace />;

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 2 }}>
      <Paper variant="outlined" sx={{ width: '100%', maxWidth: 420, p: { xs: 3, sm: 4 } }}>
        <Outlet />
      </Paper>
    </Box>
  );
}
