import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Check, CircleAlert, Eye, EyeOff, Hash, Info, Lock, Mail, Phone, ShieldCheck, UserCheck,
} from 'lucide-react';
import api, { errMsg } from '../api';
import { homeFor, useAuth } from '../context/AuthContext';
import { Field, PasswordStrength, Spin } from '../components/ui';
import AuthLayout, { FormError } from '../components/AuthLayout';
import PortalBanner, { useUniversityFor } from '../components/PortalBanner';
import { UniLogo } from '../components/ui';

const STEPS = ['Find your record', 'Verify email', 'Set password'];
const EASE = [0.22, 1, 0.36, 1];
const POINTS = [
  { icon: ShieldCheck, title: 'Only enrolled students', text: "Your registration number must be on the university's official student list." },
  { icon: Mail, title: 'University email only', text: 'We send a one-time code to prove the email is yours.' },
  { icon: UserCheck, title: 'Official details', text: 'Your name and faculty come straight from university records.' },
];

// Six boxes for the verification code (typing, backspace and paste all work)
function CodeInput({ value, onChange, disabled }) {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  const setDigit = (i, d) => {
    const next = [...digits];
    next[i] = d;
    onChange(next.join(''));
  };
  const onInput = (i, e) => {
    const d = e.target.value.replace(/\D/g, '').slice(-1);
    if (!d) return;
    setDigit(i, d);
    if (i < 5) refs.current[i + 1]?.focus();
  };
  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) setDigit(i, '');
      else if (i > 0) { refs.current[i - 1]?.focus(); setDigit(i - 1, ''); }
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
  };
  const onPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="otp" onPaste={onPaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className={d ? 'filled' : ''}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={d}
          disabled={disabled}
          autoFocus={i === 0}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => onInput(i, e)}
          onKeyDown={(e) => onKeyDown(i, e)}
        />
      ))}
    </div>
  );
}

export default function Register() {
  const { user, completeRegistration } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [form, setForm] = useState({ regNo: '', email: '', phone: '', password: '', confirm: '' });
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [devCode, setDevCode] = useState('');
  const [student, setStudent] = useState(null);
  const [agree, setAgree] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Which university portal this email belongs to (shown live under the email field)
  const portal = useUniversityFor(form.email);
  const isPresent = useIsPresent();
  if (user && isPresent) return <Navigate to={homeFor(user.role)} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const go = (n) => { setDir(n > step ? 1 : -1); setError(''); setStep(n); };
  const uni = student?.university || portal.university;
  const matches = form.confirm && form.confirm === form.password;

  const sendCode = async () => {
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/register/start', { regNo: form.regNo, email: form.email });
      setSentTo(data.maskedEmail);
      setDevCode(data.devCode || '');
      setCode('');
      setCooldown(30);
      if (step === 0) go(1);
      else toast.success('A new code is on its way');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (code.length !== 6) return setError('Enter all 6 digits of the code.');
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/register/verify', { regNo: form.regNo, email: form.email, code });
      setStudent(data);
      go(2);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const createAccount = async () => {
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');
    if (form.password !== form.confirm) return setError('The two passwords do not match.');
    if (!agree) return setError('Please confirm the details above are yours.');
    setError('');
    setBusy(true);
    try {
      await completeRegistration({ regNo: form.regNo, email: form.email, code, password: form.password, phone: form.phone });
      toast.success(`Welcome to ClearPath, ${student.name.split(' ')[0]}!`);
      navigate('/student');
    } catch (err) {
      setError(errMsg(err));
      if (/code/i.test(errMsg(err))) go(1);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (step === 0) sendCode();
    else if (step === 1) verifyCode();
    else createAccount();
  };

  const eye = (
    <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
      {show ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );
  const initials = student?.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <AuthLayout
      title={uni ? `Welcome to the ${uni.shortName} portal.` : 'One platform for every state university.'}
      text={uni ? 'Create your account with your university details. It takes about two minutes.' : "Enter your university email and we'll open your university's portal."}
      points={POINTS}
    >
      <form className="auth-form-stack" onSubmit={submit}>
        <div className="auth-head">
          <h2>Create your account</h2>
          <p>Already registered? <Link to="/login" className="auth-link">Log in</Link></p>
        </div>

        <div className="stepper" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((label, i) => (
            <div key={label} className={`step-item ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
              <span className="step-dot">{i < step ? <Check size={13} /> : i + 1}</span>
              <span className="step-label">{label}</span>
            </div>
          ))}
          <div className="step-track"><motion.span animate={{ scaleX: step / (STEPS.length - 1) }} transition={{ duration: 0.5, ease: EASE }} /></div>
        </div>

        <AnimatePresence>{error && <FormError><CircleAlert size={16} /> {error}</FormError>}</AnimatePresence>

        <div className="step-viewport">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={{ enter: (d) => ({ opacity: 0, x: d * 40 }), center: { opacity: 1, x: 0 }, exit: (d) => ({ opacity: 0, x: d * -40 }) }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: EASE }}
              className="auth-form-stack"
            >
              {step === 0 && (
                <>
                  <div>
                    <Field icon={Hash} label="Registration number" required autoComplete="off" autoFocus value={form.regNo} onChange={set('regNo')} />
                    <small className="field-hint">As printed on your student ID, e.g. EG/2021/1234</small>
                  </div>
                  <div>
                    <Field icon={Mail} label="University email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
                    <small className="field-hint">The email your university gave you, e.g. name@ruh.ac.lk</small>
                  </div>
                  <PortalBanner lookup={portal} />
                  <div className="policy-note">
                    <Info size={16} />
                    <span>Only students on {uni ? `the ${uni.shortName}` : "their university's"} official student list can register. Your details must match university records.</span>
                  </div>
                  <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
                    {busy ? <><Spin /> Checking…</> : <>Send verification code <ArrowRight size={18} className="arrow" /></>}
                  </button>
                </>
              )}

              {step === 1 && (
                <>
                  <p className="muted small" style={{ margin: 0 }}>Enter the 6-digit code we sent to <strong>{sentTo}</strong>. It expires in 10 minutes.</p>
                  <CodeInput value={code} onChange={setCode} disabled={busy} />
                  {devCode && (
                    <div className="dev-callout">
                      <strong>Email isn't configured on this server.</strong>
                      <span>For local testing, your code is {devCode}.</span>
                      <button type="button" className="btn btn-soft btn-sm" onClick={() => setCode(devCode)}>Fill in the code</button>
                    </div>
                  )}
                  <div className="auth-actions">
                    <button type="button" className="btn btn-ghost btn-lg" onClick={() => go(0)}><ArrowLeft size={17} /> Back</button>
                    <button className="btn btn-primary btn-lg" disabled={busy || code.length !== 6}>
                      {busy ? <><Spin /> Verifying…</> : <>Verify <ArrowRight size={18} className="arrow" /></>}
                    </button>
                  </div>
                  <p className="resend">
                    Didn't get it?{' '}
                    <button type="button" onClick={sendCode} disabled={busy || cooldown > 0}>
                      {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                    </button>
                  </p>
                </>
              )}

              {step === 2 && student && (
                <>
                  <motion.div className="identity" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, ease: EASE }}>
                    {student.university ? <UniLogo university={student.university} size={42} /> : <span className="avatar">{initials}</span>}
                    <div>
                      <strong>{student.name}</strong>
                      <small>{student.regNo} · Faculty of {student.faculty || '—'}</small>
                      {student.university && <small>{student.university.name}</small>}
                    </div>
                    <span className="verified"><BadgeCheck size={15} /> Verified</span>
                  </motion.div>
                  <div>
                    <Field icon={Lock} label="Create password" type={show ? 'text' : 'password'} required minLength={6} autoComplete="new-password" autoFocus value={form.password} onChange={set('password')} right={eye} />
                    <PasswordStrength value={form.password} />
                  </div>
                  <div>
                    <Field icon={Lock} label="Confirm password" type={show ? 'text' : 'password'} required autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
                    <AnimatePresence>
                      {form.confirm && (
                        <motion.small className={`match ${matches ? 'ok' : ''}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                          {matches ? 'Passwords match' : 'Passwords do not match yet'}
                        </motion.small>
                      )}
                    </AnimatePresence>
                  </div>
                  <Field icon={Phone} label="Phone (optional)" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
                  <label className="check">
                    <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                    <span className="box" aria-hidden="true" />
                    These details are mine.
                  </label>
                  <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
                    {busy ? <><Spin /> Creating account…</> : <>Create account <ArrowRight size={18} className="arrow" /></>}
                  </button>
                  <p className="auth-note">Not you? Contact your university's Student Affairs office to correct your record.</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </form>
    </AuthLayout>
  );
}
