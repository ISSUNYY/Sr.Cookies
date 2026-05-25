import { Navigate, useLocation, Outlet } from 'react-router';
import { useAuth } from '../providers/AuthProvider';

export function AdminRoute() {
  const { isAuthenticated, isLoading, user, profile } = useAuth();
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

  // Admin permission check:
  // 1. Primary: check if profile role is 'admin'
  // 2. Secondary/Fallback: check if user email is explicitly whitelisted in VITE_ADMIN_EMAILS
  const adminEmailsString = import.meta.env.VITE_ADMIN_EMAILS || '';
  const adminEmails = adminEmailsString
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean);
  
  const isAdmin = profile?.role === 'admin' || 
    (adminEmails.length > 0 && user?.email && adminEmails.includes(user.email.toLowerCase()));

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
