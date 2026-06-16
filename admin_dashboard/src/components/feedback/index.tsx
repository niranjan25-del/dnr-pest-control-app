// src/components/feedback/index.tsx
// Loading + error + empty primitives used app-wide, plus the top-level ErrorBoundary.
// These give every screen consistent states (see LOADING / ERROR FRAMEWORK in the guide).

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InboxIcon from '@mui/icons-material/Inbox';
import { ApiError } from '@/types';

export function LoadingScreen({ label }: { label?: string }) {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '40vh', gap: 2 }}>
      <CircularProgress />
      {label && <Typography color="text.secondary">{label}</Typography>}
    </Box>
  );
}

export function FullScreenLoader() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <CircularProgress />
    </Box>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof ApiError ? error.message : 'Something went wrong.';
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <Stack alignItems="center" spacing={2} sx={{ py: 6, textAlign: 'center' }}>
      <ErrorOutlineIcon color="error" sx={{ fontSize: 48 }} />
      <Typography variant="h4">Couldn’t load this</Typography>
      <Typography color="text.secondary">{message}</Typography>
      {requestId && <Typography variant="caption" color="text.secondary">Ref: {requestId}</Typography>}
      {onRetry && <Button variant="outlined" onClick={onRetry}>Retry</Button>}
    </Stack>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 6, textAlign: 'center' }}>
      <InboxIcon sx={{ fontSize: 56, color: 'text.disabled' }} />
      <Typography variant="h4">{title}</Typography>
      {description && <Typography color="text.secondary">{description}</Typography>}
      {action}
    </Stack>
  );
}

interface EBState { hasError: boolean; error?: unknown }

export class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(error: unknown): EBState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    // Integration point for a crash reporter (Sentry, etc.).
    console.error('Uncaught UI error:', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ display: 'grid', placeItems: 'center', height: '100vh', p: 3 }}>
          <Stack alignItems="center" spacing={2} textAlign="center">
            <ErrorOutlineIcon color="error" sx={{ fontSize: 56 }} />
            <Typography variant="h2">Something broke</Typography>
            <Typography color="text.secondary">An unexpected error occurred. Try reloading.</Typography>
            <Button variant="contained" onClick={() => window.location.reload()}>Reload</Button>
          </Stack>
        </Box>
      );
    }
    return this.props.children;
  }
}
