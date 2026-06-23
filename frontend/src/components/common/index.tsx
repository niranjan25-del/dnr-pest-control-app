// src/components/common/index.tsx
// Small cross-module building blocks:
//   • Can — render children only if the role holds a permission (UI-level RBAC).
//   • ConfirmDialog + useConfirm — promise-based confirmation for destructive/sensitive ops.
//   • PageHeader — title + breadcrumb-ish subtitle + actions.
//   • StatusChip — consistent colored status pill.

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box, Breadcrumbs, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Link as MuiLink, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionKey } from '@/features/auth/permissions';

// ---- RBAC gate ----
export function Can({ permission, children, fallback = null }: { permission: PermissionKey; children: ReactNode; fallback?: ReactNode }) {
  const { can } = usePermissions();
  return <>{can(permission) ? children : fallback}</>;
}

// ---- PageHeader ----
export function PageHeader({ title, subtitle, crumbs, actions }: { title: string; subtitle?: ReactNode; crumbs?: { label: string; to?: string }[]; actions?: ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
      <Box>
        {crumbs && (
          <Breadcrumbs sx={{ mb: 0.5 }}>
            {crumbs.map((c) =>
              c.to ? (
                <MuiLink key={c.label} component={Link} to={c.to} underline="hover" color="inherit" variant="body2">{c.label}</MuiLink>
              ) : (
                <Typography key={c.label} variant="body2" color="text.secondary">{c.label}</Typography>
              ),
            )}
          </Breadcrumbs>
        )}
        <Typography variant="h2">{title}</Typography>
        {subtitle && <Typography color="text.secondary">{subtitle}</Typography>}
      </Box>
      {actions && <Stack direction="row" spacing={1}>{actions}</Stack>}
    </Stack>
  );
}

// ---- StatusChip ----
const STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary'> = {
  ACTIVE: 'success', COMPLETED: 'success', ACCEPTED: 'success', CONFIRMED: 'info', PAID: 'success',
  PENDING: 'warning', EN_ROUTE: 'info', ARRIVED: 'info', IN_PROGRESS: 'info', ASSIGNED: 'warning',
  SUSPENDED: 'error', DEACTIVATED: 'default', CANCELLED: 'error', DECLINED: 'error', FAILED: 'error', OVERDUE: 'error',
  PAUSED: 'warning', ISSUED: 'info',
};
export function StatusChip({ status }: { status?: string | null }) {
  if (!status) return <Chip label="—" size="small" />;
  const key = status.toUpperCase();
  return <Chip label={status.replace(/_/g, ' ')} size="small" color={STATUS_COLORS[key] ?? 'default'} variant="outlined" />;
}

// ---- useConfirm (promise-based) ----
interface ConfirmOptions { title: string; message: string; confirmText?: string; destructive?: boolean }
const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(() => Promise.resolve(false));

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>();

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const close = (result: boolean) => {
    setOpen(false);
    resolver.current?.(result);
  };

  const value = useMemo(() => confirm, [confirm]);
  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog open={open} onClose={() => close(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{opts?.title}</DialogTitle>
        <DialogContent><DialogContentText>{opts?.message}</DialogContentText></DialogContent>
        <DialogActions>
          <Button onClick={() => close(false)}>Cancel</Button>
          <Button onClick={() => close(true)} color={opts?.destructive ? 'error' : 'primary'} variant="contained">
            {opts?.confirmText ?? 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
