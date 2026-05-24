import { Navigate, useLocation, Outlet } from 'react-router';
import { useAuth } from '../providers/AuthProvider';

export function AdminRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg font-medium text-gray-600">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Basic admin check based on VITE_ADMIN_EMAILS env var
  const adminEmailsString = import.meta.env.VITE_ADMIN_EMAILS || '';
  const adminEmails = adminEmailsString
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean);
  
  // Since this is a private project, if VITE_ADMIN_EMAILS is not set, we allow the authenticated user.
  // Otherwise, we strictly check against the list.
  const isAdmin = adminEmails.length === 0 || (user?.email && adminEmails.includes(user.email.toLowerCase()));

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
