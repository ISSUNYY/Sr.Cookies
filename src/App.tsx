import { Suspense } from 'react';
import { RouterProvider } from 'react-router';
import { router } from '@/app/routes';
import { AppProviders } from '@/app/providers/AppProviders';

export function App() {
  return (
    <AppProviders>
      <Suspense fallback={<div>Loading...</div>}>
        <RouterProvider router={router} />
      </Suspense>
    </AppProviders>
  );
}
