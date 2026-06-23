// src/pages/StatusPages.tsx
// 403 (insufficient permission) and 404 (unknown route). Kept together — both are simple,
// centered messages with a way back.

import { Box, Button, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { paths } from '@/routes/paths';

function StatusShell({ code, title, description }: { code: string; title: string; description: string }) {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh', p: 3 }}>
      <Stack spacing={1.5} alignItems="center" textAlign="center">
        <Typography variant="h1" color="primary">{code}</Typography>
        <Typography variant="h3">{title}</Typography>
        <Typography color="text.secondary">{description}</Typography>
        <Button component={Link} to={paths.dashboard} variant="contained" sx={{ mt: 1 }}>Back to dashboard</Button>
      </Stack>
    </Box>
  );
}

export function ForbiddenPage() {
  return <StatusShell code="403" title="No access" description="Your role doesn’t have permission to view this page." />;
}

export function NotFoundPage() {
  return <StatusShell code="404" title="Page not found" description="The page you’re looking for doesn’t exist." />;
}
