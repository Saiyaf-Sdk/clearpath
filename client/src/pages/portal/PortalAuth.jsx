import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert, ClipboardCheck, Eye, EyeOff, FlaskConical, Hash, Info, Landmark, Lock, Mail, MapPin, Phone, QrCode,
  Repeat, ShieldCheck, UserCheck,
} from 'lucide-react';
import api, { errMsg } from '../../api';
import { canVisit, homeFor, useAuth } from '../../context/AuthContext';
import useFetch from '../../hooks/useFetch';
import { Field, PasswordStrength, Skeleton, Spin, UniLogo } from '../../components/ui';
import { FormError } from '../../components/AuthLayout';
import CodeInput from '../../components/CodeInput';
import { emailMatches, facultyPath, rememberPortal } from '../../utils/portal';

const EASE = [0.22, 1, 0.36, 1];
// Portal details already loaded in this visit (switching between Log in / Create account is instant)
const portalCache = {};

// Demo accounts are only offered while developing, or when VITE_SHOW_DEMO=true is set (project evaluation).
// They follow the seed script's pattern: central offices demo.lib@…, faculty staff demo.<code>.office@… and so on.
const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO === 'true';
const LAB_FACULTY = /engineering|science|medic|agri|technolog|dental|veterinary|computing|health|siddha|architecture|livestock|animal|geomatics|nursing|bioresources|fisheries|information/i;
const DEMO_STUDENTS = {
  'ruhuna/engineering': [['Student · in progress', 'demo.kasun'], ['Student · certificate ready', 'demo.nimali'], ['Student · no request yet', 'demo.tharindu']],
  'ruhuna/science': [['Student · in progress', 'demo.hiruni']],
  'colombo/science': [['Student · in progress', 'demo.saman']],
};
const REMOTE_LIBRARY = ['ruhuna/engineering', 'ruhuna/medicine', 'ruhuna/agriculture', 'ruhuna/allied-health-sciences', 'ruhuna/technology'];
const demoAccounts = (uni, fac) => {
  const d = uni.domains[0];
  if (fac.central) {
    return [['University admin', 'demo.admin'], ['Main library', 'demo.lib'], ['Finance (Bursar)', 'demo.fin'], ['Student affairs', 'demo.saf'], ...(uni.slug === 'colombo' ? [] : [['Hostels', 'demo.hos']]), ['Sports', 'demo.spo']].map(([l, e]) => [l, `${e}@${d}`]);
  }
  const key = `${uni.slug}/${fac.slug}`;
  const c = fac.code.toLowerCase();
  const staff = [['Faculty admin', 'admin'], ['Faculty office', 'office'], ['Head of Department', 'hod']];
  if (LAB_FACULTY.test(fac.name) && !/graduate/i.test(fac.name)) staff.push(['Laboratories', 'lab']);
  if (REMOTE_LIBRARY.includes(key)) staff.push(['Faculty library', 'flib']);
  return [...(DEMO_STUDENTS[key] || []).map(([l, e]) => [l, `${e}@${d}`]), ...(/graduate/i.test(fac.name) ? staff.slice(0, 2) : staff).map(([l, k]) => [l, `demo.${c}.${k}@${d}`])];
};

// One faculty's portal (or Central administration): log in and create account
// e.g. /portal/ruhuna/engineering, /portal/ruhuna/engineering/register, /portal/ruhuna/central
export default function PortalAuth({ mode = 'login' }) {
  const { slug, faculty: facSlug } = useParams();
  const { user } = useAuth();
  const key = `${slug}/${facSlug}`;
  const { data, error: loadError } = useFetch(`/universities/${encodeURIComponent(slug)}/${encodeURIComponent(facSlug)}`);
  const uni = data || portalCache[key] || null;
  const fac = uni?.faculty;
  const error = uni ? null : loadError;
  const central = !!fac?.central;

  useEffect(() => {
    if (data?.slug) {
      portalCache[key] = data;
      rememberPortal(data.slug, data.faculty?.slug);
    }
  }, [data, key]);

  if (user) return <Navigate to={homeFor(user.role)} replace />;
  // Students never create accounts on Central administration
  if (central && mode === 'register') return <Navigate to={`/portal/${slug}?next=register`} replace />;

  if (error) {
    return (
      <div className="portal-missing card">
        <CircleAlert size={26} />
        <h2>Portal not found</h2>
        <p className="muted">{error}</p>
        <Link to={`/portal/${slug}`} className="btn btn-primary"><ArrowLeft size={16} /> Choose your faculty</Link>
      </div>
    );
  }

  return (
    <div className="auth-shell portal-shell">
      <motion.aside className="auth-intro" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: EASE }}>
        {!uni ? (
          <>
            <Skeleton h={72} w={72} r={18} />
            <Skeleton h={44} w="90%" style={{ marginTop: 22 }} />
            <Skeleton h={18} w="70%" style={{ marginTop: 14 }} />
          </>
        ) : (
          <>
            <div className="portal-id">
              <UniLogo university={uni} size={72} />
              <div>
                <small>{uni.name}</small>
                <strong>{central ? 'Central administration' : `${fac.code} · ${uni.domains[0]}`}</strong>
              </div>
            </div>
            <h1 className={`auth-headline ${fac.name.length > 34 ? 'long' : ''}`} lang="en">{fac.name}</h1>
            {fac.location && <p className="portal-where"><MapPin size={15} /> {fac.location}</p>}
            <p className="auth-lead">
              {central
                ? `For the ${uni.shortName} university admin and the central offices – main library, finance, student affairs, hostels and sports.`
                : mode === 'register'
                  ? `Create your ClearPath account for the ${fac.name} with your registration number and university email.`
                  : `Sign in to the ${fac.name} clearance portal – students, faculty officers and the faculty admin.`}
            </p>
            <ul className="auth-points">
              {[
                central
                  ? { icon: Landmark, title: 'Central offices clear everyone', text: `Requests from every ${uni.shortName} faculty reach the central offices.` }
                  : { icon: ClipboardCheck, title: 'One request, every office', text: `Your faculty's offices and the ${uni.shortName} central offices review it in parallel.` },
                { icon: Mail, title: `${uni.domains.map((d) => '@' + d).join(' / ')} only`, text: 'Accounts use your official university email.' },
                { icon: QrCode, title: 'QR-verified certificate', text: `Issued in the name of ${uni.name}.` },
              ].map((p, i) => (
                <motion.li key={p.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08, duration: 0.45, ease: EASE }}>
                  <span className="ic"><p.icon size={17} /></span>
                  <div><strong>{p.title}</strong><small>{p.text}</small></div>
                </motion.li>
              ))}
            </ul>
            <div className="auth-trust"><ShieldCheck size={15} /> Encrypted passwords · signed sessions · role-based access</div>
          </>
        )}
      </motion.aside>

      <motion.section className="auth-card" initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.55, ease: EASE, delay: 0.05 }}>
        <div className="portal-card-top">
          {uni ? (
            <div className="portal-mini"><UniLogo university={uni} size={30} /><span>{central ? 'Central administration' : fac.name.replace(/^Faculty of\s+/i, '')} · {uni.shortName}</span></div>
          ) : <Skeleton h={30} w={180} />}
          <Link to={`/portal/${slug}${mode === 'register' ? '?next=register' : ''}`} className="auth-link small"><Repeat size={13} style={{ verticalAlign: -2 }} /> Change faculty</Link>
        </div>

        {!central && (
          <div className="portal-tabs" role="tablist">
            <Link role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} to={facultyPath(slug, facSlug)} replace>Log in</Link>
            <Link role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} to={facultyPath(slug, facSlug, true)} replace>Create account</Link>
          </div>
        )}

        {!uni ? <Skeleton h={260} r={14} /> : mode === 'register' ? <RegisterForm uni={uni} fac={fac} /> : <LoginForm uni={uni} fac={fac} />}
      </motion.section>
    </div>
  );
}

/* ---------------- Log in ---------------- */
function LoginForm({ uni, fac }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const target = (u) => (canVisit(u.role, from) ? from : homeFor(u.role));
  const [form, setForm] = useState({ email: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const match = emailMatches(form.email, uni);
  const demo = demoAccounts(uni, fac);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = await login(form.email, form.password, remember, uni.slug, fac.slug);
      toast.success(`Welcome back, ${u.name.split(' ')[0]}`);
      navigate(target(u), { replace: true });
    } catch (err) {
      setError({ message: errMsg(err), code: err.response?.data?.code, portal: err.response?.data?.portal });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auth-form-stack" onSubmit={submit}>
      <div className="auth-head">
        <h2>Log in</h2>
        <p>{fac.central ? `University admin and central office staff of ${uni.shortName}.` : `Use your ${uni.shortName} email and password.`}</p>
      </div>

      <AnimatePresence>
        {error && (
          <FormError>
            <CircleAlert size={16} />
            <span>
              {error.message}
              {error.code === 'WRONG_PORTAL' && error.portal && (
                <> <Link className="auth-link" to={`/portal/${error.portal.slug}`} replace onClick={() => setError(null)}>Go to {error.portal.shortName} portal →</Link></>
              )}
              {['WRONG_FACULTY', 'CHOOSE_FACULTY'].includes(error.code) && error.portal?.faculty && (
                <> <Link className="auth-link" to={facultyPath(error.portal.slug, error.portal.faculty.slug)} replace onClick={() => setError(null)}>Go to {error.portal.faculty.name} →</Link></>
              )}
              {error.code === 'PLATFORM_LOGIN' && <> <Link className="auth-link" to="/platform-login">Platform sign-in →</Link></>}
            </span>
          </FormError>
        )}
      </AnimatePresence>

      <div>
        <Field icon={Mail} label="University email" type="email" required autoComplete="email" autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        {match === false ? (
          <small className="field-hint bad"><CircleAlert size={13} /> This isn't a {uni.shortName} email ({uni.domains.map((d) => '@' + d).join(' or ')}).</small>
        ) : (
          <small className="field-hint">e.g. name@{uni.domains[0]}</small>
        )}
      </div>
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

      <div className="auth-row">
        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span className="box" aria-hidden="true" />
          Keep me signed in
        </label>
        <Link to={`/forgot-password?portal=${uni.slug}/${fac.slug}`} className="auth-link">Forgot password?</Link>
      </div>

      <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
        {busy ? <><Spin /> Signing in…</> : <>Log in <ArrowRight size={18} className="arrow" /></>}
      </button>

      {fac.central ? (
        <p className="auth-note">Students and faculty staff log in on their own faculty. <Link to={`/portal/${uni.slug}`} className="auth-link">Choose a faculty</Link></p>
      ) : (
        <p className="auth-note">New student? <Link to={facultyPath(uni.slug, fac.slug, true)} className="auth-link" replace>Create your account</Link>. Staff accounts are created by your faculty or university admin.</p>
      )}

      {SHOW_DEMO && demo.length > 0 && (
        <div className={`demo-panel ${demoOpen ? 'open' : ''}`}>
          <button type="button" className="demo-toggle" onClick={() => setDemoOpen((o) => !o)} aria-expanded={demoOpen}>
            <FlaskConical size={15} /> Demo access for evaluation
            <ChevronDown size={15} className="chev-sm" />
          </button>
          <AnimatePresence initial={false}>
            {demoOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
                <div className="demo-list">
                  {demo.map(([label, email]) => (
                    <button type="button" key={email} className="chip-btn" onClick={() => setForm({ email, password: 'password123' })}>{label}</button>
                  ))}
                </div>
                <small className="muted">Fills the form with a seeded {fac.central ? uni.shortName : fac.name.replace(/^Faculty of\s+/i, '')} account (password: password123).</small>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </form>
  );
}

/* ---------------- Create account ----------------
   Step 1: registration number, university email, password  → we email a 6-digit code
   Step 2: enter the code                                     → account created and signed in */
function RegisterForm({ uni, fac }) {
  const { completeRegistration } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ regNo: '', email: '', password: '', confirm: '', phone: '' });
  const [agree, setAgree] = useState(false);
  const [show, setShow] = useState(false);
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [devCode, setDevCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const match = emailMatches(form.email, uni);
  const pwOk = form.password.length >= 6 && form.password === form.confirm;

  useEffect(() => {
    if (!cooldown) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const fail = (err) => setError({ message: errMsg(err), code: err.response?.data?.code, portal: err.response?.data?.portal });

  const sendCode = async () => {
    setError(null);
    if (match === false) return setError({ message: `Use your ${uni.shortName} email (${uni.domains.map((d) => '@' + d).join(' or ')}).` });
    if (form.password.length < 6) return setError({ message: 'Password must be at least 6 characters.' });
    if (form.password !== form.confirm) return setError({ message: 'The two passwords do not match.' });
    if (!agree) return setError({ message: 'Please confirm these details are yours.' });
    setBusy(true);
    try {
      const { data } = await api.post('/auth/register/start', { university: uni.slug, faculty: fac.slug, regNo: form.regNo, email: form.email });
      setSentTo(data.maskedEmail);
      setDevCode(data.devCode || '');
      setCode('');
      setCooldown(30);
      if (step === 0) setStep(1);
      else toast.success('A new code is on its way');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (code.length !== 6) return setError({ message: 'Enter all 6 digits of the code.' });
    setError(null);
    setBusy(true);
    try {
      const u = await completeRegistration({ university: uni.slug, faculty: fac.slug, regNo: form.regNo, email: form.email, code, password: form.password, phone: form.phone });
      toast.success(`Welcome to ClearPath, ${u.name.split(' ')[0]}!`);
      navigate('/student', { replace: true });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (step === 0) sendCode();
    else finish();
  };

  const eye = <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide passwords' : 'Show passwords'}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>;

  return (
    <form className="auth-form-stack" onSubmit={submit}>
      <div className="auth-head">
        <h2>Create your account</h2>
        <p>For {fac.name} students on the {uni.shortName} official student list.</p>
      </div>

      <div className="stepper two" aria-label={`Step ${step + 1} of 2`}>
        {['Your details', 'Verify email'].map((label, i) => (
          <div key={label} className={`step-item ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
            <span className="step-dot">{i < step ? <Check size={13} /> : i + 1}</span>
            <span className="step-label">{label}</span>
          </div>
        ))}
        <div className="step-track"><motion.span animate={{ scaleX: step }} transition={{ duration: 0.45, ease: EASE }} /></div>
      </div>

      <AnimatePresence>
        {error && (
          <FormError>
            <CircleAlert size={16} />
            <span>
              {error.message}
              {error.code === 'WRONG_PORTAL' && error.portal && (
                <> <Link className="auth-link" to={`/portal/${error.portal.slug}?next=register`} replace onClick={() => setError(null)}>Go to {error.portal.shortName} portal →</Link></>
              )}
              {error.code === 'WRONG_FACULTY' && error.portal?.faculty && (
                <> <Link className="auth-link" to={facultyPath(error.portal.slug, error.portal.faculty.slug, true)} replace onClick={() => setError(null)}>Go to {error.portal.faculty.name} →</Link></>
              )}
            </span>
          </FormError>
        )}
      </AnimatePresence>

      {step === 0 ? (
        <motion.div key="s0" className="auth-form-stack" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.28, ease: EASE }}>
          <div>
            <Field icon={Hash} label="Registration number" required autoComplete="off" autoFocus value={form.regNo} onChange={set('regNo')} />
            <small className="field-hint">As printed on your student ID, e.g. EG/2021/1234</small>
          </div>
          <div>
            <Field icon={Mail} label="University email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
            {match === false ? (
              <small className="field-hint bad"><CircleAlert size={13} /> Must end with {uni.domains.map((d) => '@' + d).join(' or ')}</small>
            ) : (
              <small className="field-hint">e.g. name@{uni.domains[0]} – we'll send a code here</small>
            )}
          </div>
          <div>
            <Field icon={Lock} label="Create password" type={show ? 'text' : 'password'} required minLength={6} autoComplete="new-password" value={form.password} onChange={set('password')} right={eye} />
            <PasswordStrength value={form.password} />
          </div>
          <div>
            <Field icon={Lock} label="Confirm password" type={show ? 'text' : 'password'} required autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
            {form.confirm && <small className={`match ${pwOk ? 'ok' : ''}`}>{pwOk ? 'Passwords match' : 'Passwords do not match yet'}</small>}
          </div>
          <Field icon={Phone} label="Phone (optional)" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
          <label className="check">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span className="box" aria-hidden="true" />
            I am this student and these details are mine.
          </label>
          <div className="policy-note">
            <Info size={16} />
            <span>Your registration number and email must be on the {uni.shortName} student list under the {fac.name}. Your name comes from university records.</span>
          </div>
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? <><Spin /> Checking…</> : <>Send verification code <ArrowRight size={18} className="arrow" /></>}
          </button>
          <p className="auth-note">Already have an account? <Link to={facultyPath(uni.slug, fac.slug)} className="auth-link" replace>Log in</Link></p>
        </motion.div>
      ) : (
        <motion.div key="s1" className="auth-form-stack" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.28, ease: EASE }}>
          <div className="identity verify-box">
            <UserCheck size={22} />
            <div>
              <strong>Check your email</strong>
              <small>We sent a 6-digit code to <b>{sentTo}</b>. It expires in 10 minutes.</small>
            </div>
          </div>
          <CodeInput value={code} onChange={setCode} disabled={busy} />
          {devCode && (
            <div className="dev-callout">
              <strong>Email isn't set up on this server.</strong>
              <span>For local testing, your code is {devCode}.</span>
              <button type="button" className="btn btn-soft btn-sm" onClick={() => setCode(devCode)}>Fill in the code</button>
            </div>
          )}
          <div className="auth-actions">
            <button type="button" className="btn btn-ghost btn-lg" onClick={() => { setStep(0); setError(null); }}><ArrowLeft size={17} /> Back</button>
            <button className="btn btn-primary btn-lg" disabled={busy || code.length !== 6}>
              {busy ? <><Spin /> Creating account…</> : <>Verify &amp; create account</>}
            </button>
          </div>
          <p className="resend">
            Didn't get it? Check spam, or{' '}
            <button type="button" onClick={sendCode} disabled={busy || cooldown > 0}>{cooldown > 0 ? `resend in ${cooldown}s` : 'resend the code'}</button>
          </p>
        </motion.div>
      )}
    </form>
  );
}
