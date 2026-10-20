import { Link, NavLink, useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to={user ? homeFor(user.role) : '/'} className="brand">
          <span className="brand-mark">✓</span> ClearPath
        </Link>
        <nav className="nav-links">
          <NavLink to="/verify">Verify certificate</NavLink>
          {user ? (
            <>
              <NavLink to={homeFor(user.role)}>Dashboard</NavLink>
              <span className="nav-user">
                {user.name} <small className="role-tag">{user.role}</small>
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <Link to="/register" className="btn btn-primary btn-sm">Register</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
