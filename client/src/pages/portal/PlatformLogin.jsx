import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, CircleAlert, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { errMsg } from '../../api';
import { homeFor, useAuth } from '../../context/AuthContext';
import { Field, Spin } from '../../components/ui';
import AuthLayout, { FormError } from '../../components/AuthLayout';

const POINTS = [
  { icon: ShieldCheck, title: 'Platform administration only', text: 'Add universities, their email domains, logos and each university’s own admin.' },
  { icon: Lock, title: 'Separate from university portals', text: 'Students and staff sign in on their own university’s portal instead.' },
];

// Sign-in for the ClearPath platform owner (not linked to any university)
export default function PlatformLogin() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = await login(form.email, form.password, true);
      toast.success(`Welcome back, ${u.name.split(' ')[0]}`);
      navigate(homeFor(u.role), { replace: true });
    } catch (err) {
      setError({ message: errMsg(err), portal: err.response?.data?.portal });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="ClearPath platform administration." text="Manage the universities on ClearPath and create each university's administrator." points={POINTS}>
      <form className="auth-form-stack" onSubmit={submit}>
        <div className="auth-head">
          <h2>Platform sign-in</h2>
          <p>For the ClearPath platform administrator.</p>
        </div>
        <AnimatePresence>
          {error && (
            <FormError>
              <CircleAlert size={16} />
              <span>
                {error.message}
                {error.portal && <> <Link className="auth-link" to={`/portal/${error.portal.slug}`}>Go to {error.portal.shortName} portal →</Link></>}
              </span>
            </FormError>
          )}
        </AnimatePresence>
        <Field icon={Mail} label="Email" type="email" required autoComplete="email" autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Field
          icon={Lock}
          label="Password"
          type={show ? 'text' : 'password'}
          required
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          right={<button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>}
        />
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? <><Spin /> Signing in…</> : <>Sign in <ArrowRight size={18} className="arrow" /></>}
        </button>
        {(import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO === 'true') && (
          <button type="button" className="chip-btn" style={{ alignSelf: 'center' }} onClick={() => setForm({ email: 'platform@clearpath.lk', password: 'password123' })}>Fill demo platform admin</button>
        )}
        <Link to="/portal" className="auth-back"><ArrowLeft size={16} /> Student or staff? Choose your university</Link>
      </form>
    </AuthLayout>
  );
}
