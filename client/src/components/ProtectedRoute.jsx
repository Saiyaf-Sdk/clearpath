import { Navigate } from 'react-router-dom';
import { useIsPresent } from 'framer-motion';
import { homeFor, useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ role, children }) {
  const { user } = useAuth();
  // While a page is fading out (e.g. right after logout) don't redirect – let the new route win
  const isPresent = useIsPresent();
  if (!user) return isPresent ? <Navigate to="/login" replace /> : null;
  if (role && user.role !== role) return isPresent ? <Navigate to={homeFor(user.role)} replace /> : null;
  return children;
}
