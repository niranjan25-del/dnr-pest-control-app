// src/providers/AppProviders.tsx
// Composition root for cross-cutting providers. Order matters:
//   ThemeMode (theme + CssBaseline) → Query (server state) → Auth (session) → children.
// The router is rendered by children (App) so it sits inside Auth and can read it in guards.

import type { ReactNode } from 'react';
import { ThemeModeProvider } from './ThemeModeProvider';
import { QueryProvider } from './QueryProvider';
import { AuthProvider } from './AuthProvider';
import { ToastProvider } from './ToastProvider';
import { ErrorBoundary } from '@/components/feedback';
import { ConfirmProvider } from '@/components/common';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeModeProvider>
        <QueryProvider>
          <AuthProvider>
            <ToastProvider>
              <ConfirmProvider>{children}</ConfirmProvider>
            </ToastProvider>
          </AuthProvider>
        </QueryProvider>
      </ThemeModeProvider>
    </ErrorBoundary>
  );
}
