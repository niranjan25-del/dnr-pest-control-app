import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar, Avatar, Box, Drawer, IconButton, List, ListItemButton, ListItemIcon,
  ListItemText, Stack, Toolbar, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Work as JobsIcon,
  CalendarMonth as ScheduleIcon,
  Person as ProfileIcon,
  Menu as MenuIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { paths } from '@/routes/paths';
import { useAuth } from '@/hooks/useAuth';
import { useTechProfile } from './hooks';

const BRAND = '#1E8E5A';
const NAV_WIDTH = 220;

const NAV_ITEMS = [
  { label: 'Dashboard',  icon: <DashboardIcon />, to: paths.technicianDashboard },
  { label: 'My Jobs',    icon: <JobsIcon />,       to: paths.technicianJobs },
  { label: 'Schedule',   icon: <ScheduleIcon />,   to: paths.technicianSchedule },
  { label: 'Profile',    icon: <ProfileIcon />,    to: paths.technicianProfile },
];

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

export function TechnicianLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { data: profile } = useTechProfile();

  const handleLogout = async () => {
    await logout();
    navigate(paths.login, { replace: true });
  };

  const navContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <Box sx={{ px: 2.5, py: 3, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>D</Typography>
          </Box>
          <Box>
            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>DNR Pest Control</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Technician Portal</Typography>
          </Box>
        </Stack>
      </Box>

      {/* Nav items */}
      <List sx={{ flex: 1, px: 1.5, pt: 2 }}>
        {NAV_ITEMS.map((item) => (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            onClick={() => setDrawerOpen(false)}
            sx={{
              borderRadius: 2, mb: 0.5, color: 'rgba(255,255,255,0.7)',
              '&.active': { bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', '& .MuiListItemIcon-root': { color: '#fff' } },
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: '#fff' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} />
          </ListItemButton>
        ))}
      </List>

      {/* User + logout */}
      <Box sx={{ px: 2, py: 2, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(255,255,255,0.2)', fontSize: 13, fontWeight: 700 }}>
            {initials(profile?.full_name)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 600 }} noWrap>
              {profile?.full_name ?? 'Technician'}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }} noWrap>
              {profile?.email ?? ''}
            </Typography>
          </Box>
          <Tooltip title="Log out">
            <IconButton size="small" onClick={handleLogout} sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff' } }}>
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Sidebar — desktop */}
      {!isMobile && (
        <Box sx={{ width: NAV_WIDTH, flexShrink: 0, bgcolor: BRAND, position: 'fixed', top: 0, left: 0, bottom: 0 }}>
          {navContent}
        </Box>
      )}

      {/* Sidebar — mobile drawer */}
      {isMobile && (
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ sx: { width: NAV_WIDTH, bgcolor: BRAND } }}>
          {navContent}
        </Drawer>
      )}

      {/* Main area */}
      <Box sx={{ flex: 1, ml: isMobile ? 0 : `${NAV_WIDTH}px`, display: 'flex', flexDirection: 'column' }}>
        {/* Mobile top bar */}
        {isMobile && (
          <AppBar position="sticky" elevation={0} sx={{ bgcolor: BRAND }}>
            <Toolbar>
              <IconButton edge="start" color="inherit" onClick={() => setDrawerOpen(true)} sx={{ mr: 1 }}>
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>DNR Technician</Typography>
            </Toolbar>
          </AppBar>
        )}
        <Box sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
