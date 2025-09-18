import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
};

export const RoleRoute = ({ roles }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user && roles.includes(user.role) ? <Outlet /> : <Navigate to="/" replace />;
};
