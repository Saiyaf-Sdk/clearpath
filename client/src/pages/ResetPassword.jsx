import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CircleAlert, Eye, EyeOff, Lock, LockKeyhole, ShieldCheck, Timer } from 'lucide-react';
import api, { errMsg } from '../api';
import { loginPath } from '../utils/portal';
import { Field, PasswordStrength, Skeleton, Spin } from '../components/ui';
import AuthLayout, { FormError } from '../components/AuthLayout';

const EASE = [0.22, 1, 0.36, 1];
const POINTS = [
  { icon: LockKeyhole, title: 'Choose a strong password', text: 'Mix upper and lower case letters, numbers and symbols.' },
  { icon: ShieldCheck, title: 'Confirmation email', text: 'We let you know as soon as the password changes.' },
  { icon: Timer, title: 'One-time link', text: 'This link stops working as soon as it is used.' },
];

// A tick that draws itself
function SuccessTick() {
  return (
    <motion.svg width="72" height="72" viewBox="0 0 72 72" initial="hidden" animate="show" aria-hidden="true">
      <motion.circle cx="36" cy="36" r="32" fill="none" stroke="var(--good-solid)" strokeWidth="4"
        variants={{ hidden: { pathLength: 0, opacity: 0 }, show: { pathLength: 1, opacity: 1, transition: { duration: 0.5, ease: EASE } } }} />
      <motion.path d="M23 37 L32 46 L50 27" fill="none" stroke="var(--good-solid)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
        variants={{ hidden: { pathLength: 0, opacity: 0 }, show: { pathLength: 1, opacity: 1, transition: { delay: 0.4, duration: 0.4, ease: EASE } } }} />
    </motion.svg>
  );
}

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // checking | ready | invalid | done
  const [email, setEmail] = useState('');
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [portal, setPortal] = useState(null);
  // Back to the right university portal (or the chooser / platform page)
  const loginHere = portal ? `/portal/${portal.slug}${portal.faculty ? `/${portal.faculty}` : ''}` : loginPath();

  useEffect(() => {
    api.get(`/auth/reset-password/${token}`)
      .then(({ data }) => { setEmail(data.email); setPortal(data.university ? { ...data.university, faculty: data.faculty?.slug } : null); setStatus('ready'); })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');
    if (form.password !== form.confirm) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password: form.password });
      setStatus('done');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const eye = (
    <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
      {show ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );
  const view = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 }, transition: { duration: 0.35, ease: EASE } };

  return (
    <AuthLayout title="A fresh start for your account." text="Set a new password and you're back in." points={POINTS}>
      <AnimatePresence mode="wait" initial={false}>
        {status === 'checking' && (
          <motion.div key="checking" className="auth-form-stack" {...view}>
            <Skeleton h={48} w={48} r={14} />
            <Skeleton h={26} w="60%" />
            <Skeleton h={52} r={13} />
            <Skeleton h={52} r={13} />
          </motion.div>
        )}

        {status === 'invalid' && (
          <motion.div key="invalid" className="auth-form-stack auth-success" {...view}>
            <div className="auth-icon big warn"><CircleAlert size={30} /></div>
            <div className="auth-head center">
              <h2>This link has expired</h2>
              <p>Reset links work once and only for 15 minutes. Request a new one to continue.</p>
            </div>
            <Link to="/forgot-password" className="btn btn-primary btn-lg btn-block">Request a new link <ArrowRight size={18} className="arrow" /></Link>
            <Link to={loginHere} className="auth-back"><ArrowLeft size={16} /> Back to log in</Link>
          </motion.div>
        )}

        {status === 'ready' && (
          <motion.form key="form" className="auth-form-stack" onSubmit={submit} {...view}>
            <div className="auth-icon"><LockKeyhole size={24} /></div>
            <div className="auth-head">
              <h2>Set a new password</h2>
              <p>For <strong>{email}</strong></p>
            </div>
            <AnimatePresence>{error && <FormError><CircleAlert size={16} /> {error}</FormError>}</AnimatePresence>
            <div>
              <Field icon={Lock} label="New password" type={show ? 'text' : 'password'} required minLength={6} autoComplete="new-password" autoFocus value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} right={eye} />
              <PasswordStrength value={form.password} />
            </div>
            <Field icon={Lock} label="Confirm new password" type={show ? 'text' : 'password'} required autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
            <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
              {busy ? <><Spin /> Saving…</> : <>Update password <ArrowRight size={18} className="arrow" /></>}
            </button>
            <Link to={loginHere} className="auth-back"><ArrowLeft size={16} /> Back to log in</Link>
          </motion.form>
        )}

        {status === 'done' && (
          <motion.div key="done" className="auth-form-stack auth-success" {...view}>
            <div className="success-tick"><SuccessTick /></div>
            <div className="auth-head center">
              <h2>Password updated</h2>
              <p>Your password has been changed. Log in with your new password to continue.</p>
            </div>
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => navigate(loginHere)}>
              Continue to log in <ArrowRight size={18} className="arrow" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
