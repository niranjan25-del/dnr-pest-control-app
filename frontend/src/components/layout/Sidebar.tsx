// src/components/layout/Sidebar.tsx
// Permission-aware navigation. NAV_ITEMS declares each section with the permission required
// to see it; items the current role can't access are hidden. Management routes don't exist
// yet (foundation), so non-dashboard items are marked "soon" and disabled — this
// demonstrates the gating pattern the modules will plug into.

import { List, ListItemButton, ListItemIcon, ListItemText, Chip, Toolbar, Box, Typography, Divider } from '@mui/material';
import { NavLink, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/SpaceDashboard';
import InsightsIcon from '@mui/icons-material/Insights';
import EventNoteIcon from '@mui/icons-material/EventNote';
import PeopleIcon from '@mui/icons-material/People';
import EngineeringIcon from '@mui/icons-material/Engineering';
import RouteIcon from '@mui/icons-material/AltRoute';
import InventoryIcon from '@mui/icons-material/Inventory2';
import PaymentsIcon from '@mui/icons-material/Payments';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import StarIcon from '@mui/icons-material/StarOutline';
import CampaignIcon from '@mui/icons-material/Campaign';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HistoryIcon from '@mui/icons-material/History';
import SellIcon from '@mui/icons-material/Sell';
import LayersIcon from '@mui/icons-material/Layers';
import SubscriptionsIcon from '@mui/icons-material/Subscriptions';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import { paths } from '@/routes/paths';
import { Permission, type PermissionKey } from '@/features/auth/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import type { ReactNode } from 'react';

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  permission: PermissionKey;
  ready?: boolean; // foundation: only dashboard is wired
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: paths.dashboard, icon: <DashboardIcon />, permission: Permission.ViewDashboard, ready: true },
  { label: 'Analytics', to: paths.analytics, icon: <InsightsIcon />, permission: Permission.ViewDashboard, ready: true },
  { label: 'Bookings', to: paths.bookings, icon: <EventNoteIcon />, permission: Permission.ModifyBooking, ready: true },
  { label: 'Customers', to: paths.customers, icon: <PeopleIcon />, permission: Permission.ManageCustomers, ready: true },
  { label: 'Technicians', to: paths.technicians, icon: <EngineeringIcon />, permission: Permission.ManageTechnicians, ready: true },
  { label: 'Dispatch', to: paths.dispatch, icon: <RouteIcon />, permission: Permission.AssignTechnician, ready: true },
  { label: 'Catalog', to: paths.catalog, icon: <InventoryIcon />, permission: Permission.ManageCatalog, ready: true },
  { label: 'Pricing', to: paths.pricing, icon: <SellIcon />, permission: Permission.ManagePricing, ready: true },
  { label: 'Plans', to: paths.plans, icon: <LayersIcon />, permission: Permission.ManagePricing, ready: true },
  { label: 'Subscriptions', to: paths.subscriptions, icon: <SubscriptionsIcon />, permission: Permission.ManageCustomers, ready: true },
  { label: 'Payments', to: paths.payments, icon: <PaymentsIcon />, permission: Permission.ViewPayments, ready: true },
  { label: 'Coupons', to: paths.coupons, icon: <LocalOfferIcon />, permission: Permission.ManageCoupons, ready: true },
  { label: 'Reviews', to: paths.reviews, icon: <StarIcon />, permission: Permission.ModerateReviews, ready: true },
  { label: 'Broadcasts', to: paths.broadcasts, icon: <CampaignIcon />, permission: Permission.SendBroadcasts, ready: true },
  { label: 'Reports', to: paths.reports, icon: <AssessmentIcon />, permission: Permission.ComplianceExport, ready: true },
  { label: 'Audit Log', to: paths.audit, icon: <HistoryIcon />, permission: Permission.ViewAuditLogs, ready: true },
  { label: 'Admin Users', to: paths.adminUsers, icon: <ManageAccountsIcon />, permission: Permission.ManageRoles, ready: true },
];

export const SIDEBAR_WIDTH = 264;

export function SidebarContent() {
  const { can } = usePermissions();
  const location = useLocation();
  const visible = NAV_ITEMS.filter((item) => can(item.permission));

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ px: 2.5 }}>
        <Box sx={{ width: 28, height: 28, borderRadius: 1.5, bgcolor: 'primary.main', mr: 1.5 }} />
        <Typography variant="h4" sx={{ fontWeight: 700 }}>DNR Admin</Typography>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1.5, py: 1, flex: 1, overflowY: 'auto' }}>
        {visible.map((item) => {
          const selected = location.pathname.startsWith(item.to);
          const disabled = !item.ready;
          return (
            <ListItemButton
              key={item.to}
              component={disabled ? 'div' : NavLink}
              to={disabled ? undefined : item.to}
              selected={selected && item.ready}
              disabled={disabled}
              sx={{ borderRadius: 2, mb: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
              {disabled && <Chip label="soon" size="small" variant="outlined" />}
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}
