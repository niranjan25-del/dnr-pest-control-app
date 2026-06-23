// src/hooks/usePermissions.ts
// Derives the effective permission set + admin role from the current user, and exposes a
// `can()` checker for gating nav items, routes, and action buttons.

import { useContext, useMemo } from 'react';
import { useAuth } from './useAuth';
import { resolveAdminRole, resolvePermissions, type PermissionKey } from '@/features/auth/permissions';
import { ColorModeContext } from '@/providers/ThemeModeProvider';

export function usePermissions() {
  const { user } = useAuth();
  return useMemo(() => {
    const permissions = resolvePermissions(user);
    const role = resolveAdminRole(user);
    return {
      role,
      permissions,
      can: (perm: PermissionKey) => permissions.has(perm),
      canAny: (perms: PermissionKey[]) => perms.some((p) => permissions.has(p)),
    };
  }, [user]);
}

export function useColorMode() {
  const ctx = useContext(ColorModeContext);
  if (!ctx) throw new Error('useColorMode must be used within <ThemeModeProvider>');
  return ctx;
}
