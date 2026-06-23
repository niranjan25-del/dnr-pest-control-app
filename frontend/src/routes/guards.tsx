// src/routes/guards.tsx
// Route guards:
//   • ProtectedRoute — requires an authenticated session; holds on a loader while the
//     session restores, redirects to /login otherwise (preserving the attempted URL).
//   • PermissionRoute — additionally requires a permission; redirects to /403 if missing.

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { FullScreenLoader } from '@/components/feedback';
import { paths } from './paths';
import type { PermissionKey } from '@/features/auth/permissions';

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'unauthenticated') {
    return <Navigate to={paths.login} replace state={{ from: location }} />;
  }
  return <Outlet />;
}

export function PermissionRoute({ permission }: { permission: PermissionKey }) {
  const { can } = usePermissions();
  if (!can(permission)) return <Navigate to={paths.forbidden} replace />;
  return <Outlet />;
}

/** Allows only users with role TECHNICIAN; redirects others to their correct home. */
export function TechnicianRoute() {
  const { user, status } = useAuth();
  if (status === 'loading') return <FullScreenLoader />;
  if (!user) return <Navigate to={paths.login} replace />;
  if (user.role !== 'TECHNICIAN') return <Navigate to={paths.dashboard} replace />;
  return <Outlet />;
}

/** Allows only users with role CUSTOMER; redirects others to their correct home. */
export function CustomerRoute() {
  const { user, status } = useAuth();
  if (status === 'loading') return <FullScreenLoader />;
  if (!user) return <Navigate to={paths.login} replace />;
  if (user.role !== 'CUSTOMER') {
    if (user.role === 'TECHNICIAN') return <Navigate to={paths.technicianDashboard} replace />;
    return <Navigate to={paths.dashboard} replace />;
  }
  return <Outlet />;
}

/** Prevents technicians and customers from reaching the admin dashboard. */
export function AdminOnlyRoute() {
  const { user, status } = useAuth();
  if (status === 'loading') return <FullScreenLoader />;
  if (!user) return <Navigate to={paths.login} replace />;
  if (user.role === 'TECHNICIAN') return <Navigate to={paths.technicianDashboard} replace />;
  if (user.role === 'CUSTOMER') return <Navigate to={paths.customerDashboard} replace />;
  return <Outlet />;
}
