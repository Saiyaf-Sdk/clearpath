import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Eye, EyeOff, KeyRound, LayoutDashboard, LifeBuoy, Lock, LogOut, Moon, Settings, UserRound } from 'lucide-react';
import api, { errMsg } from '../api';
import { homeFor, useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Field, Spin } from '../components/ui';
import { item, stagger } from '../components/Page';

// 0–4 score: length, mixed case, digits, symbols
const strength = (pw) => {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  return Math.max(1, s);
};
const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];

export default function Profile() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const initials = user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const score = strength(pw.next);

  const submit = async (e) => {
    e.preventDefault();
    if (pw.next.length < 6) return toast.error('New password must be at least 6 characters');
    if (pw.next !== pw.confirm) return toast.error('New passwords do not match');
    setBusy(true);
    try {
      await api.patch('/auth/password', { currentPassword: pw.current, newPassword: pw.next });
      toast.success('Password updated');
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const eye = (
    <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide passwords' : 'Show passwords'}>
      {show ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <span className="eyebrow"><Settings size={13} /> Account</span>
          <h1>Profile &amp; settings</h1>
          <p className="muted">Manage your account details, password and preferences.</p>
        </div>
      </div>

      <motion.div className="profile-grid" variants={stagger} initial="hidden" animate="show">
        <motion.section className="card profile-card" variants={item}>
          <span className="avatar avatar-lg">{initials}</span>
          <h2 style={{ fontSize: '1.25rem' }}>{user.name}</h2>
          <p className="muted small">{user.email}</p>
          <span className="badge badge-role" style={{ marginTop: 10, textTransform: 'capitalize' }}>{user.role}</span>
          <dl className="kv">
            {user.role === 'student' && (<><dt>Reg. number</dt><dd>{user.regNo}</dd><dt>Faculty</dt><dd>{user.faculty}</dd>{user.phone && (<><dt>Phone</dt><dd>{user.phone}</dd></>)}</>)}
            {user.role === 'officer' && (<><dt>Department</dt><dd>{user.department?.name}</dd></>)}
            {user.role === 'admin' && (<><dt>Access</dt><dd>Full administrator</dd></>)}
          </dl>
          <div className="row-gap" style={{ justifyContent: 'center', marginTop: 20 }}>
            <Link to={homeFor(user.role)} className="btn btn-soft btn-sm"><LayoutDashboard size={15} /> Dashboard</Link>
            <Link to="/help" className="btn btn-ghost btn-sm"><LifeBuoy size={15} /> Help</Link>
          </div>
        </motion.section>

        <div>
          <motion.section className="card" variants={item}>
            <h2><KeyRound size={18} className="text-brand" style={{ verticalAlign: -3, marginRight: 6 }} />Change password</h2>
            <p className="muted small" style={{ marginBottom: 16 }}>Use at least 8 characters with a mix of letters, numbers and symbols.</p>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field icon={Lock} label="Current password" type={show ? 'text' : 'password'} required autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} right={eye} />
              <div className="grid-2">
                <div>
                  <Field icon={Lock} label="New password" type={show ? 'text' : 'password'} required minLength={6} autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                  {pw.next && (
                    <>
                      <div className={`strength s${score}`}><i /><i /><i /><i /></div>
                      <small className="muted">{STRENGTH_LABEL[score]} password</small>
                    </>
                  )}
                </div>
                <Field icon={Lock} label="Confirm new password" type={show ? 'text' : 'password'} required autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
              </div>
              <div>
                <button className="btn btn-primary" disabled={busy}>{busy ? <Spin /> : <KeyRound size={16} />} Update password</button>
              </div>
            </form>
          </motion.section>

          <motion.section className="card" variants={item}>
            <h2><UserRound size={18} className="text-brand" style={{ verticalAlign: -3, marginRight: 6 }} />Preferences</h2>
            <div className="setting-row">
              <div>
                <strong><Moon size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Dark mode</strong>
                <p>Easier on the eyes at night. Saved on this device.</p>
              </div>
              <button className={`switch ${theme === 'dark' ? 'on' : ''}`} onClick={toggle} role="switch" aria-checked={theme === 'dark'} aria-label="Dark mode">
                <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }} />
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong><LogOut size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Log out</strong>
                <p>End your session on this device.</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/'); toast.success('Logged out'); }}>Log out</button>
            </div>
          </motion.section>
        </div>
      </motion.div>
    </div>
  );
}
