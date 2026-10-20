import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, CircleAlert, Eye, EyeOff, Hash, Lock, Mail, Phone, User } from 'lucide-react';
import { homeFor, useAuth } from '../context/AuthContext';
import { errMsg } from '../api';
import { Field, Spin } from '../components/ui';
import AuthSide from '../components/AuthSide';

const faculties = ['Engineering', 'Science', 'Medicine', 'Management', 'Arts', 'Agriculture', 'Technology'];

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', regNo: '', faculty: 'Engineering', phone: '', password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isPresent = useIsPresent();
  if (user && isPresent) return <Navigate to={homeFor(user.role)} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setBusy(true);
    try {
      const { confirm, ...data } = form; // eslint-disable-line no-unused-vars
      await register(data);
      toast.success('Account created. Welcome to ClearPath!');
      navigate('/student');
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

  return (
    <div className="auth glass">
      <AuthSide title="Start your clearance in two minutes." text="Create your student account, then submit one request to every department." />

      <form className="auth-form" onSubmit={submit}>
        <div>
          <span className="eyebrow">Student registration</span>
          <h1>Create your account</h1>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div className="form-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <CircleAlert size={16} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        <Field icon={User} label="Full name" required value={form.name} onChange={set('name')} />
        <Field icon={Mail} label="University email" type="email" required value={form.email} onChange={set('email')} />
        <div className="grid-2">
          <Field icon={Hash} label="Registration no. (EG/2021/1234)" required value={form.regNo} onChange={set('regNo')} />
          <label className="label">
            Faculty
            <select className="input" value={form.faculty} onChange={set('faculty')}>
              {faculties.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
        </div>
        <Field icon={Phone} label="Phone (optional)" value={form.phone} onChange={set('phone')} />
        <div className="grid-2">
          <Field icon={Lock} label="Password" type={show ? 'text' : 'password'} required minLength={6} value={form.password} onChange={set('password')} right={eye} />
          <Field icon={Lock} label="Confirm password" type={show ? 'text' : 'password'} required value={form.confirm} onChange={set('confirm')} />
        </div>

        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? <><Spin /> Creating account…</> : <>Create account <ArrowRight size={18} /></>}
        </button>
        <p className="muted center small">Already registered? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
