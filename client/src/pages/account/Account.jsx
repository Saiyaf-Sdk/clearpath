import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, KeyRound, Lock, LogOut, Moon, Save, UserRound } from 'lucide-react';
import api, { errMsg } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import AvatarPicker from '../../components/AvatarPicker';
import LogoPanel from '../../components/LogoPanel';
import { Field, PageHeader, PasswordStrength, Spin, UniLogo } from '../../components/ui';

const ROLE_LABEL = { student: 'Student', officer: 'Department officer', admin: 'University admin', superadmin: 'Platform admin' };

export default function Account() {
  const { user, logout, updateUser } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ name: user.name, phone: user.phone || '' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState('');

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy('profile');
    try {
      const body = { phone: profile.phone };
      if (user.role !== 'student') body.name = profile.name;
      const { data } = await api.patch('/auth/me', body);
      updateUser(data.user);
      toast.success('Profile saved');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy('');
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.next.length < 6) return toast.error('New password must be at least 6 characters');
    if (pw.next !== pw.confirm) return toast.error('The new passwords do not match');
    setBusy('pw');
    try {
      await api.patch('/auth/password', { currentPassword: pw.current, newPassword: pw.next });
      toast.success('Password updated');
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy('');
    }
  };

  const eye = (
    <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide passwords' : 'Show passwords'}>
      {show ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );

  return (
    <div className="page">
      <PageHeader title="Account settings" subtitle="Your profile, password and preferences." />

      <div className="account-grid">
        <section className="card profile-card">
          <AvatarPicker />
          <h2>{user.name}</h2>
          <p className="muted small">{user.email}</p>
          <span className="badge badge-role" style={{ marginTop: 10 }}>{ROLE_LABEL[user.role]}</span>
          {user.university && (
            <div className="uni-line" style={{ justifyContent: 'center', marginTop: 16 }}>
              <UniLogo university={user.university} size={30} />
              <span className="small">{user.university.name}</span>
            </div>
          )}
          <dl className="kv" style={{ textAlign: 'left' }}>
            {user.role === 'student' && (<><dt>Reg. number</dt><dd>{user.regNo}</dd><dt>Faculty</dt><dd>{user.faculty}</dd></>)}
            {user.role === 'officer' && (<><dt>Department</dt><dd>{user.department?.name}</dd></>)}
          </dl>
        </section>

        <div className="stack">
          {user.role === 'admin' && user.university && (
            <section className="card">
              <h2>University logo</h2>
              <p className="muted small" style={{ marginTop: 4 }}>Shown on your portal, in the sidebar, on certificates and on the verify page.</p>
              <div style={{ marginTop: 12 }}>
                <LogoPanel university={user.university} endpoint="/admin/logo" onChanged={(uni) => updateUser({ ...user, university: { ...user.university, logoUrl: uni.logoUrl } })} />
              </div>
            </section>
          )}
          <section className="card">
            <h2><UserRound size={18} className="text-brand" style={{ verticalAlign: -3, marginRight: 6 }} />Profile</h2>
            <form className="form-stack" style={{ marginTop: 12 }} onSubmit={saveProfile}>
              <div className="grid-2">
                <label className="label">Full name
                  <input className="input" value={profile.name} disabled={user.role === 'student'} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                  {user.role === 'student' && <small className="field-hint">Your name comes from the official student list. Contact Student Affairs to correct it.</small>}
                </label>
                <label className="label">Phone number
                  <input className="input" type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="07X XXX XXXX" />
                </label>
              </div>
              <div><button className="btn btn-primary" disabled={busy === 'profile'}>{busy === 'profile' ? <Spin /> : <Save size={16} />} Save profile</button></div>
            </form>
          </section>

          <section className="card">
            <h2><KeyRound size={18} className="text-brand" style={{ verticalAlign: -3, marginRight: 6 }} />Change password</h2>
            <p className="muted small" style={{ marginBottom: 14 }}>Use at least 8 characters with a mix of letters and numbers.</p>
            <form onSubmit={changePassword} className="form-stack">
              <Field icon={Lock} label="Current password" type={show ? 'text' : 'password'} required autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} right={eye} />
              <div className="grid-2">
                <div>
                  <Field icon={Lock} label="New password" type={show ? 'text' : 'password'} required minLength={6} autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                  <PasswordStrength value={pw.next} />
                </div>
                <Field icon={Lock} label="Confirm new password" type={show ? 'text' : 'password'} required autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
              </div>
              <div><button className="btn btn-primary" disabled={busy === 'pw'}>{busy === 'pw' ? <Spin /> : <KeyRound size={16} />} Update password</button></div>
            </form>
          </section>

          <section className="card">
            <h2>Preferences</h2>
            <div className="setting-row">
              <div>
                <strong><Moon size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Dark mode</strong>
                <p>Easier on the eyes at night. Saved on this device.</p>
              </div>
              <button className={`switch ${theme === 'dark' ? 'on' : ''}`} onClick={toggle} role="switch" aria-checked={theme === 'dark'} aria-label="Dark mode"><span /></button>
            </div>
            <div className="setting-row">
              <div>
                <strong><LogOut size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Log out</strong>
                <p>End your session on this device.</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { logout(); toast.success('You have been logged out'); navigate('/', { replace: true }); }}>Log out</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
