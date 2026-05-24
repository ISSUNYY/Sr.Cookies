import { createBrowserRouter } from 'react-router';

export const router = createBrowserRouter([
  {
    path: '/auth',
    lazy: async () => {
      const { default: AuthLayout } = await import('@features/auth/layouts/AuthLayout');
      return { Component: AuthLayout };
    },
    children: [
      {
        index: true,
        lazy: async () => {
          const { Navigate } = await import('react-router');
          return { Component: () => <Navigate to="login" replace /> };
        },
      },
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
    path: '/admin',
    lazy: async () => {
      const { AdminRoute } = await import('@features/auth/components/AdminRoute');
      return { Component: AdminRoute };
    },
    children: [
      {
        lazy: async () => {
          const { default: AdminLayout } = await import('@features/admin/layouts/AdminLayout');
          return { Component: AdminLayout };
        },
        children: [
          {
            index: true,
            lazy: async () => {
              const { default: DashboardOverview } = await import('@features/admin/pages/DashboardOverview');
              return { Component: DashboardOverview };
            },
          },
          {
            path: 'products',
            lazy: async () => {
              const { default: AdminDashboard } = await import('@features/admin/pages/AdminDashboard');
              return { Component: AdminDashboard };
            },
          },
          {
            path: 'orders',
            lazy: async () => {
              const { default: OrdersManagement } = await import('@features/admin/pages/OrdersManagement');
              return { Component: OrdersManagement };
            },
          },
          {
            path: 'products/new',
            lazy: async () => {
              const { default: ProductEditor } = await import('@features/admin/pages/ProductEditor');
              return { Component: ProductEditor };
            },
          },
          {
            path: 'products/:id/edit',
            lazy: async () => {
              const { default: ProductEditor } = await import('@features/admin/pages/ProductEditor');
              return { Component: ProductEditor };
            },
          },
        ],
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
        lazy: async () => {
          const { default: HomePage } = await import('@features/catalog/pages/HomePage');
          return { Component: HomePage };
        },
      },
      {
        path: 'cart',
        lazy: async () => {
          const { default: CartPage } = await import('@features/catalog/pages/CartPage');
          return { Component: CartPage };
        },
      },
      {
        path: 'checkout',
        lazy: async () => {
          const { default: CheckoutPage } = await import('@features/catalog/pages/CheckoutPage');
          return { Component: CheckoutPage };
        },
      },
      {
        path: 'track/:orderId',
        lazy: async () => {
          const { default: OrderTrackingPage } = await import('@features/orders/pages/OrderTrackingPage');
          return { Component: OrderTrackingPage };
        },
      },
    ],
  },
]);
