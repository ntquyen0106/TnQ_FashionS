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
