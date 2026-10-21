import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ChevronDown, House, LifeBuoy, LogOut, Menu, Moon, Settings, ShieldCheck, Sun, X } from 'lucide-react';
import { homeFor, useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import ErrorBoundary from '../ErrorBoundary';
import { PageSkeleton, UniLogo, initials } from '../ui';
import { NAV, titleFor } from './nav';
import { ShellProvider, useShell } from './ShellContext';
import NotificationBell from './NotificationBell';
import TopoBackground from './TopoBackground';

const ROLE_LABEL = { student: 'Student', officer: 'Department officer', admin: 'University admin', superadmin: 'Platform admin' };

// The signed-in area: sidebar with every page of your role, top bar, and the page itself.
// Every page has its own address, so refresh and the browser's back button always work.
export default function AppShell() {
  return (
    <ShellProvider>
      <Shell />
    </ShellProvider>
  );
}

function Shell() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const { section, title } = titleFor(user.role, pathname);

  // Close the mobile sidebar after navigating
  useEffect(() => setOpen(false), [pathname]);

  // Browser tab title
  useEffect(() => {
    document.title = title ? `${title} · ClearPath` : 'ClearPath';
  }, [title]);

  return (
    <div className="shell">
      <TopoBackground />
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className={`shell-scrim ${open ? 'show' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="shell-main">
        <header className="topbar">
          <button className="icon-btn only-mobile" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="topbar-title">
            {section && <span className="crumb">{section}</span>}
            <strong>{title || 'ClearPath'}</strong>
          </div>
          <div className="topbar-right">
            <ThemeButton />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main className="shell-content" id="content">
          <ErrorBoundary resetKey={pathname}>
            <Suspense fallback={<PageSkeleton />}>
              <div className="page-enter" key={pathname}>
                <Outlet />
              </div>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const { badges } = useShell();
  const groups = NAV[user.role] || [];
  const roleLabel = user.role === 'officer' ? user.department?.name || ROLE_LABEL.officer : ROLE_LABEL[user.role];

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
      <div className="sb-top">
        <Link to="/" className="brand" aria-label="ClearPath home page">
          <span className="brand-mark">✓</span>
          <span>ClearPath</span>
        </Link>
        <button className="icon-btn only-mobile" onClick={onClose} aria-label="Close menu"><X size={18} /></button>
      </div>

      <div className="sb-uni">
        {user.university ? <UniLogo university={user.university} size={38} /> : <span className="uni-logo sb-platform"><ShieldCheck size={18} /></span>}
        <div>
          <strong title={user.university?.name}>{user.university?.shortName || 'ClearPath platform'}</strong>
          <small>{roleLabel}</small>
        </div>
      </div>

      <nav className="sb-nav">
        {groups.map((g) => (
          <div className="sb-group" key={g.label}>
            <div className="sb-label">{g.label}</div>
            {g.items.map((it) => {
              const count = it.badge ? badges[it.badge] || 0 : 0;
              return (
                <NavLink key={it.to} to={it.to} end={it.end} className="sb-link">
                  <it.icon size={18} />
                  <span>{it.label}</span>
                  {count > 0 && <span className={`sb-badge ${it.tone === 'warn' ? 'warn' : ''}`}>{count > 99 ? '99+' : count}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sb-foot">
        <Link to="/" className="sb-link small"><House size={16} /><span>Home page</span></Link>
        <Link to="/verify" className="sb-link small"><ShieldCheck size={16} /><span>Verify a certificate</span></Link>
        <Link to="/help" className="sb-link small"><LifeBuoy size={16} /><span>Help centre</span></Link>
      </div>
    </aside>
  );
}

function ThemeButton() {
  const { theme, toggle } = useTheme();
  return (
    <button className="icon-btn" onClick={toggle} aria-label="Toggle dark mode" title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const doLogout = () => {
    setOpen(false);
    logout();
    toast.success('You have been logged out');
    navigate('/', { replace: true });
  };

  return (
    <div className="user-menu-wrap" ref={ref}>
      <button className="user-chip" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <span className="avatar">{initials(user.name)}</span>
        <span className="user-meta">
          <strong>{user.name}</strong>
          <small>{user.role === 'officer' ? user.department?.name : ROLE_LABEL[user.role]}</small>
        </span>
        <ChevronDown size={16} className={`chev ${open ? 'up' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="menu" role="menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
            <div className="menu-head">
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
            <Link to={homeFor(user.role)} className="menu-item" onClick={() => setOpen(false)}><House size={16} /> My dashboard</Link>
            <Link to="/account" className="menu-item" onClick={() => setOpen(false)}><Settings size={16} /> Account settings</Link>
            <Link to="/help" className="menu-item" onClick={() => setOpen(false)}><LifeBuoy size={16} /> Help centre</Link>
            <div className="menu-sep" />
            <button className="menu-item danger" onClick={doLogout}><LogOut size={16} /> Log out</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
