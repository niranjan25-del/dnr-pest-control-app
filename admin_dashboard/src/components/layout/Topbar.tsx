// src/components/layout/Topbar.tsx
// App bar: mobile drawer toggle, page title, notifications menu, theme toggle, and user
// menu (name/role + logout). NotificationsMenu shows an empty state in the foundation;
// the notifications module will feed it real data later.

import { useState, type MouseEvent } from 'react';
import {
  AppBar, Avatar, Badge, Box, Divider, IconButton, ListItemIcon, Menu, MenuItem,
  Toolbar, Tooltip, Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions, useColorMode } from '@/hooks/usePermissions';
import { roleLabel } from '@/features/auth/permissions';
import { initials } from '@/utils/format';
import { SIDEBAR_WIDTH } from './Sidebar';

function NotificationsMenu() {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  return (
    <>
      <Tooltip title="Notifications">
        <IconButton onClick={(e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)} color="inherit">
          <Badge color="error" variant="dot" invisible>
            <NotificationsNoneIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { width: 320 } } }}>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2">Notifications</Typography>
        </Box>
        <Divider />
        <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">You’re all caught up.</Typography>
        </Box>
      </Menu>
    </>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const { role } = usePermissions();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  return (
    <>
      <Tooltip title="Account">
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} sx={{ ml: 0.5 }}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 14 }}>
            {initials(user?.full_name ?? user?.email)}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { width: 240 } } }}>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" noWrap>{user?.full_name ?? user?.email}</Typography>
          <Typography variant="caption" color="text.secondary">{roleLabel(role)}</Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => { setAnchor(null); void logout(); }}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          Log out
        </MenuItem>
      </Menu>
    </>
  );
}

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { mode, toggle } = useColorMode();
  return (
    <AppBar
      position="fixed"
      color="default"
      elevation={0}
      sx={{
        width: { lg: `calc(100% - ${SIDEBAR_WIDTH}px)` },
        ml: { lg: `${SIDEBAR_WIDTH}px` },
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Toolbar>
        <IconButton edge="start" onClick={onMenuClick} sx={{ mr: 1, display: { lg: 'none' } }}>
          <MenuIcon />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        <Tooltip title={mode === 'light' ? 'Dark mode' : 'Light mode'}>
          <IconButton onClick={toggle} color="inherit">{mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}</IconButton>
        </Tooltip>
        <NotificationsMenu />
        <UserMenu />
      </Toolbar>
    </AppBar>
  );
}
