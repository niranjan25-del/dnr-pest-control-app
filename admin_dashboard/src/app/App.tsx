// src/app/App.tsx
// App shell: providers wrap the router. Thin by design — composition lives in AppProviders,
// routing in router.tsx.

import { RouterProvider } from 'react-router-dom';
import { AppProviders } from '@/providers/AppProviders';
import { router } from '@/routes/router';

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
