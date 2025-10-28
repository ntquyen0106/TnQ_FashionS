import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div />; // tránh render route con khi chưa biết phiên
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
};

export const RoleRoute = ({ roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div />;
  return user && roles.includes(user.role) ? <Outlet /> : <Navigate to="/" replace />;
};

// If user.mustChangePassword is true, redirect them to first-time change page
export const MustChangePasswordGuard = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div />;
  if (user?.mustChangePassword && location.pathname !== '/first-change-password') {
    return <Navigate to="/first-change-password" replace />;
  }
  return <Outlet />;
};
