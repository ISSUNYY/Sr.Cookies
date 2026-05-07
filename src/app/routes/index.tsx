import { createBrowserRouter } from 'react-router';
import { lazy } from 'react';

const HomePage = lazy(() => import('@features/catalog/pages/HomePage'));

export const router = createBrowserRouter([
  {
    path: '/auth',
    lazy: async () => {
      const { default: AuthLayout } = await import('@features/auth/layouts/AuthLayout');
      return { Component: AuthLayout };
    },
    children: [
      {
        path: 'login',
        lazy: async () => {
          const { default: LoginPage } = await import('@features/auth/pages/LoginPage');
          return { Component: LoginPage };
        },
      },
      {
        path: 'signup',
        lazy: async () => {
          const { default: SignupPage } = await import('@features/auth/pages/SignupPage');
          return { Component: SignupPage };
        },
      },
    ],
  },
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
