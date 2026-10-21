import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { homeFor, useAuth } from '../context/AuthContext';
import { loginPath } from '../utils/portal';

// Only signed-in users; others go to the login page and come back here afterwards
export default function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  // Not signed in: go to the university portal (or the chooser), then come back here
  if (!user) return <Navigate to={loginPath()} replace state={{ from: `${location.pathname}${location.search}` }} />;
  return children;
}

// Only one role (e.g. officers) – anyone else is sent to their own dashboard
export function RoleGate({ role }) {
  const { user } = useAuth();
  if (user?.role !== role) return <Navigate to={homeFor(user?.role)} replace />;
  return <Outlet />;
}
