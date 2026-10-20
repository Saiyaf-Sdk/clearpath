import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, CircleAlert, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { homeFor, useAuth } from '../context/AuthContext';
import { errMsg } from '../api';
import { Field, Spin } from '../components/ui';
import AuthSide from '../components/AuthSide';

const demo = [
  ['Kasun · student', 'kasun@student.lk'],
  ['Nimali · student', 'nimali@student.lk'],
  ['Library', 'library@clearpath.lk'],
  ['Hostel', 'hostel@clearpath.lk'],
  ['Finance', 'finance@clearpath.lk'],
  ['Labs', 'lab@clearpath.lk'],
  ['Sports', 'sports@clearpath.lk'],
  ['Student Affairs', 'affairs@clearpath.lk'],
  ['Admin', 'admin@clearpath.lk'],
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const isPresent = useIsPresent();
  if (user && isPresent) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = await login(form.email, form.password);
      toast.success(`Welcome back, ${u.name.split(' ')[0]}!`);
      navigate(homeFor(u.role));
    } catch (err) {
      setError(errMsg(err));
      setShake((s) => s + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth glass">
      <AuthSide title="Your clearance, all in one place." text="Track every department live and skip the queues." />

      <motion.form
        className="auth-form"
        onSubmit={submit}
        animate={{ x: shake % 2 ? [0, -10, 10, -6, 6, 0] : [0, 10, -10, 6, -6, 0] }}
        initial={false}
        transition={{ duration: shake ? 0.4 : 0 }}
      >
        <div>
          <span className="eyebrow">Welcome back</span>
          <h1>Log in to ClearPath</h1>
          <p className="muted">Students, department officers and admins use the same login.</p>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div className="form-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <CircleAlert size={16} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        <Field icon={Mail} label="Email address" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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

        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? <><Spin /> Logging in…</> : <>Log in <ArrowRight size={18} /></>}
        </button>
        <p className="muted center small">
          New student? <Link to="/register">Create an account</Link>
        </p>

        <div className="demo-box">
          <strong>Demo accounts</strong> · password <code>password123</code>
          <div className="demo-list">
            {demo.map(([label, email]) => (
              <button type="button" key={email} className="chip-btn" onClick={() => setForm({ email, password: 'password123' })}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </motion.form>
    </div>
  );
}
