import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert, Eye, EyeOff, GraduationCap, Hash, Lock, Mail, Phone, User } from 'lucide-react';
import { homeFor, useAuth } from '../context/AuthContext';
import { errMsg } from '../api';
import { Field, PasswordStrength, Spin } from '../components/ui';
import AuthLayout, { FormError } from '../components/AuthLayout';

const faculties = ['Engineering', 'Science', 'Medicine', 'Management', 'Arts', 'Agriculture', 'Technology'];
const STEPS = ['Your details', 'Secure your account'];
const EASE = [0.22, 1, 0.36, 1];

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', regNo: '', faculty: 'Engineering', phone: '', password: '', confirm: '' });
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [agree, setAgree] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isPresent = useIsPresent();
  if (user && isPresent) return <Navigate to={homeFor(user.role)} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const go = (n) => { setDir(n > step ? 1 : -1); setError(''); setStep(n); };
  const matches = form.confirm && form.confirm === form.password;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (step === 0) return go(1); // the browser has already checked the required fields
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');
    if (form.password !== form.confirm) return setError('The two passwords do not match.');
    if (!agree) return setError('Please confirm that your details are correct.');
    setBusy(true);
    try {
      const { confirm, ...data } = form; // eslint-disable-line no-unused-vars
      await register(data);
      toast.success('Account created. Welcome to ClearPath!');
      navigate('/student');
    } catch (err) {
      setError(errMsg(err));
      // Details like a taken email or registration number belong to step 1
      if (/email|regNo|registration/i.test(errMsg(err))) go(0);
    } finally {
      setBusy(false);
    }
  };

  const eye = (
    <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
      {show ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );

  return (
    <AuthLayout title="Start your clearance in two minutes." text="Create your student account, then send one request to every department.">
      <form className="auth-form-stack" onSubmit={submit}>
        <div className="auth-head">
          <h2>Create your account</h2>
          <p>Already registered? <Link to="/login" className="auth-link">Log in</Link></p>
        </div>

        {/* Step indicator */}
        <div className="stepper" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((label, i) => (
            <div key={label} className={`step-item ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
              <span className="step-dot">{i < step ? <Check size={13} /> : i + 1}</span>
              <span className="step-label">{label}</span>
            </div>
          ))}
          <div className="step-track"><motion.span animate={{ scaleX: step }} transition={{ duration: 0.5, ease: EASE }} /></div>
        </div>

        <AnimatePresence>{error && <FormError><CircleAlert size={16} /> {error}</FormError>}</AnimatePresence>

        <div className="step-viewport">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={{
                enter: (d) => ({ opacity: 0, x: d * 40 }),
                center: { opacity: 1, x: 0 },
                exit: (d) => ({ opacity: 0, x: d * -40 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: EASE }}
              className="auth-form-stack"
            >
              {step === 0 ? (
                <>
                  <Field icon={User} label="Full name" required autoComplete="name" value={form.name} onChange={set('name')} />
                  <Field icon={Mail} label="University email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
                  <div>
                    <Field icon={Hash} label="Registration number" required autoComplete="off" value={form.regNo} onChange={set('regNo')} />
                    <small className="field-hint">As printed on your student ID, e.g. EG/2021/1234</small>
                  </div>
                  <label className="select-float">
                    <GraduationCap size={17} className="field-icon" />
                    <select value={form.faculty} onChange={set('faculty')} aria-label="Faculty">
                      {faculties.map((f) => <option key={f}>{f}</option>)}
                    </select>
                    <span className="select-float-label">Faculty</span>
                    <ChevronDown size={16} className="select-float-chev" />
                  </label>
                  <Field icon={Phone} label="Phone (optional)" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
                  <button className="btn btn-primary btn-lg btn-block">Continue <ArrowRight size={18} className="arrow" /></button>
                </>
              ) : (
                <>
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
                  <label className="check">
                    <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                    <span className="box" aria-hidden="true" />
                    I confirm my details are correct and belong to me.
                  </label>
                  <div className="auth-actions">
                    <button type="button" className="btn btn-ghost btn-lg" onClick={() => go(0)}><ArrowLeft size={17} /> Back</button>
                    <button className="btn btn-primary btn-lg" disabled={busy}>
                      {busy ? <><Spin /> Creating…</> : <>Create account <ArrowRight size={18} className="arrow" /></>}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="auth-note">For students only. Staff accounts are created by the administrator.</p>
      </form>
    </AuthLayout>
  );
}
