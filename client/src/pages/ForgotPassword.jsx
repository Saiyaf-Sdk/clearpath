import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CircleAlert, KeyRound, Mail, MailCheck, ShieldCheck, Timer } from 'lucide-react';
import api, { errMsg } from '../api';
import { Field, Spin } from '../components/ui';
import AuthLayout, { FormError } from '../components/AuthLayout';

const EASE = [0.22, 1, 0.36, 1];
const POINTS = [
  { icon: Mail, title: 'Check your email', text: 'We send a secure link to the address on your account.' },
  { icon: Timer, title: 'Valid for 15 minutes', text: 'The link expires quickly and works only once.' },
  { icon: ShieldCheck, title: 'Private by design', text: 'We never reveal whether an email is registered.' },
];

export default function ForgotPassword() {
  const [params] = useSearchParams();
  const portal = params.get('portal');
  const back = portal ? `/portal/${portal}` : '/login';
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const request = async (e) => {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setDevUrl(data.devResetUrl || '');
      setSent(true);
      setCooldown(30);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  // The dev link points at CLIENT_URL; keep the user on this site's origin
  const devPath = devUrl ? devUrl.replace(/^https?:\/\/[^/]+/, '') : '';

  return (
    <AuthLayout title="Locked out? It happens." text="Reset your password in a minute and get back to your clearance." points={POINTS}>
      <AnimatePresence mode="wait" initial={false}>
        {!sent ? (
          <motion.form key="form" className="auth-form-stack" onSubmit={request} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3, ease: EASE }}>
            <div className="auth-icon"><KeyRound size={24} /></div>
            <div className="auth-head">
              <h2>Forgot your password?</h2>
              <p>Enter the email you use for ClearPath and we'll send you a link to choose a new password.</p>
            </div>
            <AnimatePresence>{error && <FormError><CircleAlert size={16} /> {error}</FormError>}</AnimatePresence>
            <Field icon={Mail} label="Email address" type="email" required autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
              {busy ? <><Spin /> Sending link…</> : <>Send reset link <ArrowRight size={18} className="arrow" /></>}
            </button>
            <Link to={back} className="auth-back"><ArrowLeft size={16} /> Back to log in</Link>
          </motion.form>
        ) : (
          <motion.div key="sent" className="auth-form-stack auth-success" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35, ease: EASE }}>
            <motion.div className="auth-icon big" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}>
              <MailCheck size={30} />
            </motion.div>
            <div className="auth-head center">
              <h2>Check your inbox</h2>
              <p>If an account exists for <strong>{email}</strong>, a reset link is on its way. It expires in 15 minutes.</p>
            </div>

            {devPath && (
              <div className="dev-callout">
                <strong>Email isn't configured on this server.</strong>
                <span>For local testing, open the reset link directly:</span>
                <Link to={devPath} className="btn btn-soft btn-sm">Open reset link <ArrowRight size={14} /></Link>
              </div>
            )}

            <div className="auth-tips">
              <span>Can't find it? Check your spam folder, or make sure you used your university email.</span>
            </div>
            <button type="button" className="btn btn-ghost btn-lg btn-block" onClick={() => request()} disabled={busy || cooldown > 0}>
              {busy ? <Spin /> : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend link'}
            </button>
            <button type="button" className="auth-back" onClick={() => { setSent(false); setDevUrl(''); }}>Use a different email</button>
            <Link to={back} className="auth-back"><ArrowLeft size={16} /> Back to log in</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
