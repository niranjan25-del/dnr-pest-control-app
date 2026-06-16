// src/features/auth/permissions.ts
// RBAC for the admin dashboard. Permissions mirror the PRD capability matrix for the four
// admin sub-roles. The backend is the source of truth (it enforces via role_permissions);
// this client matrix drives UI gating (hiding nav/actions the user can't use).
//
// RESOLUTION ORDER (see usePermissions): if the authenticated user carries an explicit
// `permissions` array from the backend, that wins. Otherwise we fall back to this static
// matrix keyed by the resolved AdminRole.
//
// FLAG: the PRD marks several cells "◐ (limited/conditional)" — exact boundaries are a
// confirm item and are ultimately enforced server-side. Here ◐ is granted (present but
// limited) so the UI shows the entry; the backend constrains the specifics.

import type { AdminRole, AuthUser } from '@/types';

export const Permission = {
  ViewDashboard: 'view_dashboard',
  ManageRoles: 'manage_roles',
  SuspendUsers: 'suspend_users',
  ManageCustomers: 'manage_customers',
  ManageTechnicians: 'manage_technicians',
  CreateBooking: 'create_booking',
  ModifyBooking: 'modify_booking',
  AssignTechnician: 'assign_technician',
  ManageCatalog: 'manage_catalog',
  ManagePricing: 'manage_pricing',
  ManageCoupons: 'manage_coupons',
  ProcessRefunds: 'process_refunds',
  ViewPayments: 'view_payments',
  ModerateReviews: 'moderate_reviews',
  SendBroadcasts: 'send_broadcasts',
  ComplianceExport: 'compliance_export',
  ViewAuditLogs: 'view_audit_logs',
} as const;

export type PermissionKey = (typeof Permission)[keyof typeof Permission];

const P = Permission;

export const ROLE_PERMISSIONS: Record<AdminRole, PermissionKey[]> = {
  SUPER_ADMIN: Object.values(P), // full control
  OPERATIONS_MANAGER: [
    P.ViewDashboard, P.SuspendUsers, P.ManageCustomers, P.ManageTechnicians,
    P.CreateBooking, P.ModifyBooking, P.AssignTechnician, P.ManageCatalog,
    P.ManagePricing, P.ManageCoupons, P.ProcessRefunds, P.ViewPayments,
    P.ModerateReviews, P.SendBroadcasts, P.ComplianceExport, P.ViewAuditLogs,
  ],
  DISPATCHER: [
    P.ViewDashboard, P.ManageCustomers, P.CreateBooking, P.ModifyBooking,
    P.AssignTechnician, P.ViewPayments,
  ],
  CUSTOMER_SUPPORT: [
    P.ViewDashboard, P.ManageCustomers, P.CreateBooking, P.ModifyBooking,
    P.ViewPayments, P.ModerateReviews, P.SendBroadcasts,
  ],
};

const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  OPERATIONS_MANAGER: 'Operations Manager',
  DISPATCHER: 'Dispatcher',
  CUSTOMER_SUPPORT: 'Customer Support',
};

export function roleLabel(role: AdminRole | null): string {
  return role ? ROLE_LABELS[role] : 'Unknown';
}

/** Normalize whatever the backend sends into one of the four AdminRoles (or null). */
export function resolveAdminRole(user: AuthUser | null): AdminRole | null {
  if (!user) return null;
  const candidates = [user.admin_role, user.role].filter(Boolean) as string[];
  for (const c of candidates) {
    const norm = c.toUpperCase().replace(/\s+/g, '_');
    if (norm in ROLE_PERMISSIONS) return norm as AdminRole;
  }
  return null;
}

/** Effective permission set: backend-provided list wins, else the role matrix. */
export function resolvePermissions(user: AuthUser | null): Set<string> {
  if (!user) return new Set();
  if (user.permissions && user.permissions.length > 0) return new Set(user.permissions);
  const role = resolveAdminRole(user);
  return new Set(role ? ROLE_PERMISSIONS[role] : []);
}
