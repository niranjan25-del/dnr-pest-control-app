// src/layouts/DashboardLayout.tsx
// The authenticated shell: a permanent sidebar on desktop, a temporary drawer on mobile, a
// fixed top bar, and the routed content in <Outlet>. Responsive by MUI breakpoints (lg).

import { useState } from 'react';
import { Box, Drawer, Toolbar } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { Topbar } from '@/components/layout/Topbar';
import { SidebarContent, SIDEBAR_WIDTH } from '@/components/layout/Sidebar';

export function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Topbar onMenuClick={() => setMobileOpen(true)} />

      {/* Desktop: permanent drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', lg: 'block' },
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH, boxSizing: 'border-box', borderRight: 1, borderColor: 'divider' },
        }}
        open
      >
        <SidebarContent />
      </Drawer>

      {/* Mobile: temporary drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', lg: 'none' }, '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH } }}
      >
        <SidebarContent />
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, width: { lg: `calc(100% - ${SIDEBAR_WIDTH}px)` } }}>
        <Toolbar />
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
