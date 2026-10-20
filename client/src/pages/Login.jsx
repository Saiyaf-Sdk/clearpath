import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, ChevronDown, CircleAlert, Eye, EyeOff, FlaskConical, Lock, Mail } from 'lucide-react';
import { homeFor, useAuth } from '../context/AuthContext';
import { errMsg } from '../api';
import { Field, Spin } from '../components/ui';
import AuthLayout, { FormError } from '../components/AuthLayout';

// Demo accounts are only offered while developing, or when VITE_SHOW_DEMO=true is set
// (e.g. for the project evaluation). They never appear on a normal live deployment.
const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO === 'true';
const DEMO = [
  ['Student', 'kasun@student.lk'],
  ['Student (no dues)', 'nimali@student.lk'],
  ['Library officer', 'library@clearpath.lk'],
  ['Finance officer', 'finance@clearpath.lk'],
  ['Administrator', 'admin@clearpath.lk'],
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [demoOpen, setDemoOpen] = useState(false);

  const isPresent = useIsPresent();
  if (user && isPresent) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = await login(form.email, form.password, remember);
      toast.success(`Welcome back, ${u.name.split(' ')[0]}`);
      navigate(homeFor(u.role));
    } catch (err) {
      setError(errMsg(err));
      setShake((s) => s + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Welcome back to ClearPath." text="Log in to track your clearance, review requests or manage the system.">
      <motion.form
        className="auth-form-stack"
        onSubmit={submit}
        animate={{ x: shake % 2 ? [0, -10, 10, -6, 6, 0] : [0, 10, -10, 6, -6, 0] }}
        initial={false}
        transition={{ duration: shake ? 0.4 : 0 }}
      >
        <div className="auth-head">
          <h2>Log in</h2>
          <p>Students, department officers and administrators all sign in here.</p>
        </div>

        <AnimatePresence>{error && <FormError><CircleAlert size={16} /> {error}</FormError>}</AnimatePresence>

        <Field icon={Mail} label="Email address" type="email" required autoComplete="email" autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Field
          icon={Lock}
          label="Password"
          type={show ? 'text' : 'password'}
          required
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          right={
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          }
        />

        <div className="auth-row">
          <label className="check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span className="box" aria-hidden="true" />
            Keep me signed in
          </label>
          <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
        </div>

        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? <><Spin /> Signing in…</> : <>Log in <ArrowRight size={18} className="arrow" /></>}
        </button>

        <div className="auth-divider"><span>New to ClearPath?</span></div>
        <Link to="/register" className="btn btn-ghost btn-lg btn-block">Create a student account</Link>
        <p className="auth-note">Staff accounts are created by the university administrator.</p>

        {SHOW_DEMO && (
          <div className={`demo-panel ${demoOpen ? 'open' : ''}`}>
            <button type="button" className="demo-toggle" onClick={() => setDemoOpen((o) => !o)} aria-expanded={demoOpen}>
              <FlaskConical size={15} /> Demo access for evaluation
              <ChevronDown size={15} className="chev-sm" />
            </button>
            <AnimatePresence initial={false}>
              {demoOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
                  <div className="demo-list">
                    {DEMO.map(([label, email]) => (
                      <button type="button" key={email} className="chip-btn" onClick={() => setForm({ email, password: 'password123' })}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <small className="muted">Fills the form with a seeded account (password: password123).</small>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.form>
    </AuthLayout>
  );
}
