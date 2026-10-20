import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useSpring } from 'framer-motion';
import {
  ChevronDown, LayoutDashboard, LifeBuoy, LogIn, LogOut, Menu, Moon, ShieldCheck, Sun, UserPlus, UserRound,
  X,
} from 'lucide-react';
import { homeFor, useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Sections of the landing page shown in the top bar
export const SECTIONS = [
  { id: 'how', label: 'How it works' },
  { id: 'features', label: 'Features' },
  { id: 'roles', label: 'Who it’s for' },
  { id: 'faq', label: 'FAQ' },
];

const pill = <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />;

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const landing = location.pathname === '/';

  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState('');
  const menuRef = useRef(null);

  // Thin progress bar showing how far down the landing page you are
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 40, restDelta: 0.001 });

  useEffect(() => {
    setOpen(false);
    setMenu(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the user menu when clicking outside it
  useEffect(() => {
    if (!menu) return undefined;
    const onDown = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false);
    const onKey = (e) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  // Scroll-spy: highlight the landing section currently on screen
  useEffect(() => {
    if (!landing) {
      setActiveId('');
      return undefined;
    }
    let observer;
    const t = setTimeout(() => {
      observer = new IntersectionObserver(
        (entries) => entries.forEach((e) => e.isIntersecting && setActiveId(e.target.id)),
        { rootMargin: '-45% 0px -50% 0px' }
      );
      document.querySelectorAll('main section[id]').forEach((el) => observer.observe(el));
    }, 500);
    return () => {
      clearTimeout(t);
      observer?.disconnect();
    };
  }, [landing]);

  const goSection = (id) => (e) => {
    e.preventDefault();
    setOpen(false);
    if (landing) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    else navigate(`/#${id}`);
  };

  const doLogout = () => {
    setMenu(false);
    logout();
    navigate('/');
  };

  const initials = user?.name?.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const roleLabel = user?.role === 'officer' ? user.department?.name || 'Officer' : user?.role;

  const appLinks = [
    ...(user ? [{ to: homeFor(user.role), label: 'Dashboard', icon: LayoutDashboard }] : []),
    { to: '/verify', label: 'Verify', icon: ShieldCheck },
    { to: '/help', label: 'Help', icon: LifeBuoy },
  ];

  return (
    <header className={`navbar ${scrolled || !landing ? 'scrolled' : ''}`}>
      <div className="navbar-inner">
        <Link to="/" className="brand" aria-label="ClearPath home">
          <motion.span className="brand-mark" whileHover={{ rotate: -8, scale: 1.06 }}>✓</motion.span>
          <span>ClearPath</span>
        </Link>

        <nav className="nav-links" aria-label="Main">
          {landing
            ? SECTIONS.map((s) => (
                <a key={s.id} href={`/#${s.id}`} onClick={goSection(s.id)} className={`nav-link ${activeId === s.id ? 'active' : ''}`}>
                  {activeId === s.id && pill}
                  <span>{s.label}</span>
                </a>
              ))
            : appLinks.map((l) => (
                <NavLink key={l.to} to={l.to} className="nav-link">
                  {({ isActive }) => (
                    <>
                      {isActive && pill}
                      <l.icon size={16} />
                      <span>{l.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
        </nav>

        <div className="nav-right">
          <motion.button whileTap={{ scale: 0.88 }} className="icon-btn" onClick={toggle} aria-label="Toggle dark mode" title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'grid' }}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </motion.span>
            </AnimatePresence>
          </motion.button>

          {user ? (
            <>
              {landing && (
                <Link to={homeFor(user.role)} className="btn btn-primary btn-sm desktop-only">
                  <LayoutDashboard size={15} /> Dashboard
                </Link>
              )}
              <div className="user-menu-wrap" ref={menuRef}>
                <button className="user-chip" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu">
                  <span className="avatar">{initials}</span>
                  <span className="user-meta">
                    <strong>{user.name}</strong>
                    <small>{roleLabel}</small>
                  </span>
                  <ChevronDown size={16} className={`chev ${menu ? 'up' : ''}`} />
                </button>
                <AnimatePresence>
                  {menu && (
                    <motion.div
                      className="menu"
                      role="menu"
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.16 }}
                    >
                      <div className="menu-head">
                        <strong>{user.name}</strong>
                        <small>{user.email}</small>
                      </div>
                      <Link to={homeFor(user.role)} className="menu-item"><LayoutDashboard size={16} /> Dashboard</Link>
                      <Link to="/profile" className="menu-item"><UserRound size={16} /> Profile &amp; settings</Link>
                      <Link to="/help" className="menu-item"><LifeBuoy size={16} /> Help centre</Link>
                      <div className="menu-sep" />
                      <button className="menu-item danger" onClick={doLogout}><LogOut size={16} /> Log out</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="desktop-only row-gap">
              <Link to="/login" className="btn btn-ghost btn-sm"><LogIn size={15} /> Log in</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get started</Link>
            </div>
          )}

          <button className="icon-btn mobile-only" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {landing && <motion.div className="scroll-progress" style={{ scaleX: progress }} />}

      <AnimatePresence>
        {open && (
          <motion.nav className="mobile-menu" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}>
            {landing && SECTIONS.map((s) => (
              <a key={s.id} href={`/#${s.id}`} onClick={goSection(s.id)} className="mobile-link">{s.label}</a>
            ))}
            {appLinks.map((l) => (
              <NavLink key={l.to} to={l.to} className="mobile-link"><l.icon size={17} /> {l.label}</NavLink>
            ))}
            {user ? (
              <>
                <NavLink to="/profile" className="mobile-link"><UserRound size={17} /> Profile &amp; settings</NavLink>
                <button className="mobile-link" onClick={doLogout}><LogOut size={17} /> Log out</button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="mobile-link"><LogIn size={17} /> Log in</NavLink>
                <NavLink to="/register" className="mobile-link"><UserPlus size={17} /> Create account</NavLink>
              </>
            )}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
