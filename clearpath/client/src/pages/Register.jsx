import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../context/AuthContext';
import { errMsg } from '../api';
import { Alert } from '../components/ui';

const faculties = ['Engineering', 'Science', 'Medicine', 'Management', 'Arts', 'Agriculture', 'Technology'];

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', regNo: '', faculty: 'Engineering', phone: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setBusy(true);
    try {
      const { confirm, ...data } = form; // eslint-disable-line no-unused-vars
      await register(data);
      navigate('/student');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h2>Student registration</h2>
        <Alert>{error}</Alert>
        <label>Full name<input required value={form.name} onChange={set('name')} /></label>
        <label>University email<input type="email" required value={form.email} onChange={set('email')} /></label>
        <div className="grid-2">
          <label>Registration no.<input required placeholder="EG/2021/1234" value={form.regNo} onChange={set('regNo')} /></label>
          <label>
            Faculty
            <select value={form.faculty} onChange={set('faculty')}>
              {faculties.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
        </div>
        <label>Phone (optional)<input value={form.phone} onChange={set('phone')} /></label>
        <div className="grid-2">
          <label>Password<input type="password" required minLength={6} value={form.password} onChange={set('password')} /></label>
          <label>Confirm password<input type="password" required value={form.confirm} onChange={set('confirm')} /></label>
        </div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <p className="muted center">Already registered? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
