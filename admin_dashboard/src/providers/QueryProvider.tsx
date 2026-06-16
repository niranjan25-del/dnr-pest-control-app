// src/providers/QueryProvider.tsx
// TanStack Query client. Server state lives here (caching, retries, background refetch);
// see GLOBAL STATE STRATEGY in the guide. Auth 401s are handled by the api client, so we
// don't retry those.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';
import { ApiError } from '@/types';
import { isProd } from '@/utils/env';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Don't retry auth/permission errors; retry transient ones up to twice.
              if (error instanceof ApiError && [400, 401, 403, 404].includes(error.status)) return false;
              return failureCount < 2;
            },
          },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      {!isProd && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
