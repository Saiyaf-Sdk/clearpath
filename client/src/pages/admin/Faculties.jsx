import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2, ExternalLink, GraduationCap, MapPin, PencilLine, Plus, School, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import api, { errMsg } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import useFaculties, { refreshFaculties } from '../../hooks/useFaculties';
import { Avatar, Badge, Drawer, Empty, PageHeader, PageSkeleton, SearchInput, Spin } from '../../components/ui';
import { facultyShort } from '../../components/FacultySelect';

const blank = { name: '', code: '', location: '', slug: '' };

/* ---------------- Faculties (university admin) ----------------
   Each faculty has its own portal (/portal/<university>/<faculty>), offices, faculty admin and students. */
export default function AdminFaculties() {
  const { user } = useAuth();
  const { confirm } = useDialog();
  const { faculties } = useFaculties();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState('');
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');
  const canManage = user.role === 'admin';
  const uniSlug = user.university?.slug;

  if (!faculties) return <PageSkeleton />;
  const shown = faculties.filter((f) => !q || `${f.name} ${f.code} ${f.location || ''}`.toLowerCase().includes(q.toLowerCase()));
  const totals = faculties.reduce((t, f) => ({ students: t.students + f.stats.students, officers: t.officers + f.stats.officers, active: t.active + f.stats.activeRequests }), { students: 0, officers: 0, active: 0 });

  const create = async (e) => {
    e.preventDefault();
    setBusy('add');
    try {
      await api.post('/admin/faculties', form);
      toast.success(`${form.name} added – its portal is ready`);
      setForm(blank);
      await refreshFaculties();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy('');
    }
  };

  const toggle = async (f) => {
    if (f.isActive) {
      const ok = await confirm({ title: `Deactivate ${f.name}?`, message: 'Its portal disappears from the faculty list. Existing records are kept and you can activate it again later.', confirmText: 'Deactivate' });
      if (!ok) return;
    }
    try {
      await api.patch(`/admin/faculties/${f._id}`, { isActive: !f.isActive });
      toast.success(`${f.name} ${f.isActive ? 'deactivated' : 'activated'}`);
      await refreshFaculties();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const remove = async (f) => {
    const ok = await confirm({ title: `Delete ${f.name}?`, message: 'Only possible while the faculty has no offices, staff or students. Otherwise, deactivate it.', confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/admin/faculties/${f._id}`);
      toast.success('Faculty deleted');
      await refreshFaculties();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div className="page">
      <PageHeader title="Faculties" subtitle="Each faculty has its own portal, offices, faculty admin and students. Central offices clear students of every faculty." />

      <div className="summary-strip">
        <div><small>Faculties</small><strong>{faculties.length}</strong></div>
        <div><small>Students</small><strong>{totals.students}</strong></div>
        <div><small>Faculty officers</small><strong>{totals.officers}</strong></div>
        <div><small>Active requests</small><strong>{totals.active}</strong></div>
      </div>

      {canManage && (
        <section className="card">
          <h2><Plus size={17} className="text-brand" style={{ verticalAlign: -3, marginRight: 6 }} />Add a faculty</h2>
          <p className="muted small" style={{ marginBottom: 12 }}>The faculty gets its own sign-in page straight away. Then add its offices and a faculty admin.</p>
          <form className="grid-4" onSubmit={create}>
            <label className="label">Name<input className="input" required placeholder="Faculty of Engineering" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="label">Code<input className="input" required maxLength={6} placeholder="ENG" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></label>
            <label className="label">Location<input className="input" placeholder="Hapugala, Galle" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
            <div className="row-gap" style={{ flexWrap: 'nowrap' }}>
              <label className="label" style={{ flex: 1 }}>Portal address<input className="input" placeholder="engineering" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></label>
              <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} disabled={busy === 'add'}>{busy === 'add' ? <Spin /> : <Plus size={16} />} Add</button>
            </div>
          </form>
        </section>
      )}

      <section className="card">
        <div className="toolbar">
          <SearchInput value={q} onChange={setQ} placeholder="Search faculty, code or town" />
          <span className="muted small push-right">{shown.length} of {faculties.length}</span>
        </div>
        {shown.length === 0 ? (
          <Empty icon={School} title="No faculties">Add the university&rsquo;s faculties above.</Empty>
        ) : (
          <div className="fac-list">
            {shown.map((f) => (
              <article key={f._id} className={`fac-row ${f.isActive ? '' : 'inactive'}`}>
                <span className="fac-badge">{f.code}</span>
                <div className="fac-main">
                  <div className="fac-title">
                    <strong>{f.name}</strong>
                    {!f.isActive && <Badge status="inactive" />}
                  </div>
                  <div className="fac-meta muted small">
                    {f.location && <span><MapPin size={12} /> {f.location}</span>}
                    {uniSlug && <Link to={`/portal/${uniSlug}/${f.slug}`} target="_blank" rel="noreferrer" className="auth-link"><ExternalLink size={12} /> /portal/{uniSlug}/{f.slug}</Link>}
                  </div>
                  <div className="fac-stats small">
                    <span title="Students with an account"><GraduationCap size={13} /> {f.stats.students} students</span>
                    <span title="On the official list">{f.stats.onList} on list</span>
                    <span><Building2 size={13} /> {f.stats.offices} offices</span>
                    <span><Users size={13} /> {f.stats.officers} officers</span>
                    <span>{f.stats.activeRequests} active requests</span>
                  </div>
                </div>
                <div className="fac-admins">
                  {f.admins.length === 0 ? (
                    <span className="badge badge-dues">No faculty admin</span>
                  ) : f.admins.map((a) => (
                    <span key={a._id} className="fac-admin" title={`${a.name} · ${a.email}`}>
                      <Avatar name={a.name} src={a.avatarUrl} size={26} />
                      <span><strong>{a.name}</strong><small>{a.email}</small></span>
                    </span>
                  ))}
                </div>
                {canManage && (
                  <div className="actions end">
                    <button className="btn btn-soft btn-sm" onClick={() => setEdit({ ...f })}><PencilLine size={14} /> Manage</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggle(f)}>{f.isActive ? 'Deactivate' : 'Activate'}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(f)} aria-label={`Delete ${f.name}`}><Trash2 size={14} /></button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <FacultyDrawer faculty={edit} onClose={() => setEdit(null)} universityDomain={user.university?.domains?.[0]} />
    </div>
  );
}

function FacultyDrawer({ faculty, onClose, universityDomain }) {
  const [edit, setEdit] = useState(null);
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState('');
  const current = faculty && (edit?._id === faculty._id ? edit : faculty);
  // start editing a copy whenever another faculty is opened
  useEffect(() => { if (faculty) setEdit({ ...faculty }); }, [faculty?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault();
    setBusy('save');
    try {
      await api.patch(`/admin/faculties/${current._id}`, { name: current.name, code: current.code, location: current.location, slug: current.slug, order: Number(current.order) || 0 });
      toast.success('Faculty updated');
      await refreshFaculties();
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy('');
    }
  };

  const addAdmin = async (e) => {
    e.preventDefault();
    setBusy('admin');
    try {
      await api.post('/admin/users', { ...adminForm, role: 'facultyadmin', facultyId: current._id });
      toast.success(`${adminForm.name} can now sign in on the ${facultyShort(current.name)} portal`);
      setAdminForm({ name: '', email: '', password: '' });
      await refreshFaculties();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy('');
    }
  };

  const toggleAdmin = async (a) => {
    try {
      await api.patch(`/admin/users/${a._id}`, { isActive: !a.isActive });
      toast.success(`${a.name} ${a.isActive ? 'disabled' : 'enabled'}`);
      await refreshFaculties();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const admins = faculty ? (faculty.admins || []) : [];

  return (
    <Drawer open={!!faculty} onClose={onClose} title={current ? current.name : ''} subtitle={current ? `${current.code}${current.location ? ` · ${current.location}` : ''}` : ''}>
      {current && (
        <div className="form-stack">
          <div className="section-title"><ShieldCheck size={15} style={{ verticalAlign: -2 }} /> Faculty admins</div>
          <p className="muted small" style={{ marginTop: -6 }}>A faculty admin manages this faculty&rsquo;s offices, officers and student list, and sees only this faculty.</p>
          {admins.length > 0 && (
            <div className="admin-list">
              {admins.map((a) => (
                <div key={a._id} className="admin-row">
                  <Avatar name={a.name} src={a.avatarUrl} size={30} />
                  <div><strong>{a.name}</strong><small className="muted">{a.email}</small></div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleAdmin(a)}>{a.isActive ? 'Disable' : 'Enable'}</button>
                </div>
              ))}
            </div>
          )}
          <form className="form-stack" onSubmit={addAdmin} style={{ gap: 10 }}>
            <div className="grid-2">
              <input className="input" required placeholder="Full name" value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} />
              <input className="input" required type="email" placeholder={`name@${universityDomain || 'university.ac.lk'}`} value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} />
            </div>
            <input className="input" required minLength={6} placeholder="Temporary password (they change it in Account settings)" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} />
            <div><button className="btn btn-soft btn-sm" disabled={busy === 'admin'}>{busy === 'admin' ? <Spin /> : <UserPlus size={15} />} Add faculty admin</button></div>
          </form>

          <form onSubmit={save} className="form-stack" style={{ marginTop: 8 }}>
            <div className="section-title">Details</div>
            <label className="label">Name<input className="input" required value={current.name} onChange={(e) => setEdit({ ...current, name: e.target.value })} /></label>
            <div className="grid-2">
              <label className="label">Code<input className="input" required maxLength={6} value={current.code} onChange={(e) => setEdit({ ...current, code: e.target.value.toUpperCase() })} /></label>
              <label className="label">Order<input className="input" type="number" value={current.order ?? 0} onChange={(e) => setEdit({ ...current, order: e.target.value })} /></label>
            </div>
            <label className="label">Location (town or campus)<input className="input" value={current.location || ''} onChange={(e) => setEdit({ ...current, location: e.target.value })} /></label>
            <label className="label">Portal address<input className="input" required value={current.slug} onChange={(e) => setEdit({ ...current, slug: e.target.value })} /></label>
            <small className="field-hint">Changing the address breaks old bookmarks to this faculty&rsquo;s sign-in page.</small>
            <div className="row-gap">
              <button className="btn btn-primary" disabled={busy === 'save'}>{busy === 'save' ? <Spin /> : null} Save changes</button>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
            </div>
          </form>
        </div>
      )}
    </Drawer>
  );
}
