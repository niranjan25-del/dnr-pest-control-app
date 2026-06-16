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
