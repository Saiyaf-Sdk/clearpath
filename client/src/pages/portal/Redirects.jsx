import { Navigate, useLocation } from 'react-router-dom';
import { loginPath, registerPath } from '../../utils/portal';

// Old addresses (/login, /register) and "please log in" redirects go to the right university portal,
// or to the university chooser for first-time visitors. The page the user wanted is passed along.
export function LoginRedirect() {
  const location = useLocation();
  return <Navigate to={loginPath()} replace state={location.state} />;
}

export function RegisterRedirect() {
  return <Navigate to={registerPath()} replace />;
}
