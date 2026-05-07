import { createBrowserRouter } from 'react-router';
import { lazy } from 'react';

const HomePage = lazy(() => import('@features/catalog/pages/HomePage'));

export const router = createBrowserRouter([
  {
    path: '/',
    lazy: async () => {
      const { default: RootLayout } = await import('@/app/layouts/RootLayout');
      return { Component: RootLayout };
    },
    children: [
      {
        index: true,
        element: <HomePage />,
      },
    ],
  },
]);
