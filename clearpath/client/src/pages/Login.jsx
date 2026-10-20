import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../context/AuthContext';
import { errMsg } from '../api';
import { Alert } from '../components/ui';

const demo = [
  ['Kasun (student)', 'kasun@student.lk'],
  ['Nimali (student)', 'nimali@student.lk'],
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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = await login(form.email, form.password);
      navigate(homeFor(u.role));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h2>Log in to ClearPath</h2>
        <Alert>{error}</Alert>
        <label>
          Email
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>
          Password
          <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <p className="muted center">
          New student? <Link to="/register">Create an account</Link>
        </p>

        <div className="demo-box">
          <strong>Demo accounts</strong> (password: <code>password123</code>)
          <div className="demo-list">
            {demo.map(([label, email]) => (
              <button type="button" key={email} className="btn btn-ghost btn-sm" onClick={() => setForm({ email, password: 'password123' })}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
