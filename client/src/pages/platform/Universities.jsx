import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Building2, Globe, GraduationCap, Plus, Search, UserPlus, Users } from 'lucide-react';
import api, { errMsg } from '../../api';
import LogoPanel from '../../components/LogoPanel';
import { useDialog } from '../../context/DialogContext';
import { item, stagger } from '../../components/Page';
import { Badge, Drawer, Empty, PageHeader, PageSkeleton, Spin, StatCard, UniLogo } from '../../components/ui';

const emptyUni = { name: '', shortName: '', code: '', slug: '', domains: '', website: '' };

/*
  Platform admin: manages the universities on ClearPath.
  - each university's email domains (decide which portal an email opens)
  - its logo (official file provided by the university)
  - its first university admin, who then sets up departments, officers and the student list
*/
export default function PlatformUniversities() {
  const { confirm } = useDialog();
  const [unis, setUnis] = useState(null);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyUni);
  const [selected, setSelected] = useState(null);

  const load = () => api.get('/platform/universities').then((r) => setUnis(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  if (!unis) return <PageSkeleton />;

  const q = search.toLowerCase();
  const shown = unis.filter((u) => !q || u.name.toLowerCase().includes(q) || u.code.toLowerCase().includes(q) || u.domains.some((d) => d.includes(q)));
  const totals = unis.reduce((t, u) => ({ students: t.students + u.stats.students, admins: t.admins + u.stats.admins }), { students: 0, admins: 0 });
  const live = unis.filter((u) => u.stats.admins > 0).length;

  const addUni = async (e) => {
    e.preventDefault();
    try {
      await api.post('/platform/universities', { ...form, domains: form.domains.split(',') });
      toast.success(`${form.name} added`);
      setForm(emptyUni);
      setShowAdd(false);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const toggle = async (u) => {
    if (u.isActive) {
      const ok = await confirm({ title: `Deactivate ${u.name}?`, message: 'Its users will not be able to log in until it is activated again.', confirmText: 'Deactivate', tone: 'danger' });
      if (!ok) return;
    }
    try {
      await api.patch(`/platform/universities/${u._id}`, { isActive: !u.isActive });
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Universities"
        subtitle="Each university gets its own portal. A user's email domain decides which portal they enter."
        actions={<button className="btn btn-primary" onClick={() => setShowAdd((s) => !s)}><Plus size={16} /> Add university</button>}
      />

      <motion.div className="stats" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={item}><StatCard icon={Building2} label="Universities" value={unis.length} /></motion.div>
        <motion.div variants={item}><StatCard icon={Globe} tone="good" label="Portals with an admin" value={live} /></motion.div>
        <motion.div variants={item}><StatCard icon={GraduationCap} label="Student accounts" value={totals.students} /></motion.div>
        <motion.div variants={item}><StatCard icon={Users} label="University admins" value={totals.admins} /></motion.div>
      </motion.div>

      <AnimatePresence initial={false}>
        {showAdd && (
          <motion.section className="card" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <h2>Add a university</h2>
            <form className="grid-3" style={{ marginTop: 14 }} onSubmit={addUni}>
              <label className="label">Full name<input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="label">Short name<input className="input" value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} placeholder="Shown in the top bar" /></label>
              <label className="label">Code<input className="input" required maxLength={6} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. UOR" /></label>
              <label className="label">Portal address<input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="e.g. ruhuna → /portal/ruhuna" /></label>
              <label className="label span-2">Email domains (comma separated)<input className="input" required value={form.domains} onChange={(e) => setForm({ ...form, domains: e.target.value })} placeholder="ruh.ac.lk" /></label>
              <label className="label">Website<input className="input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label>
              <div className="row-gap"><button className="btn btn-primary">Add</button><button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button></div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="card">
        <div className="toolbar">
          <div className="search-box">
            <Search size={16} />
            <input className="input" placeholder="Search name, code or domain" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <span className="muted small" style={{ marginLeft: 'auto' }}>Click a university to edit its domains, logo and admins</span>
        </div>
        {shown.length === 0 ? <Empty icon={Building2} title="No universities match" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>University</th><th>Portal</th><th className="hide-sm">Email domains</th><th>University admin</th><th className="hide-sm">Students</th><th>Status</th><th /></tr></thead>
              <tbody>
                {shown.map((u) => (
                  <tr key={u._id} style={{ cursor: 'pointer' }} onClick={() => setSelected(u._id)}>
                    <td>
                      <div className="person">
                        <UniLogo university={u} size={38} />
                        <div><strong>{u.name}</strong><small>{u.code}</small></div>
                      </div>
                    </td>
                    <td className="small"><a href={`/portal/${u.slug || u.code.toLowerCase()}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>/portal/{u.slug || u.code.toLowerCase()}</a></td>
                    <td className="small hide-sm">{u.domains.map((d) => `@${d}`).join(', ')}</td>
                    <td>{u.stats.admins > 0 ? <span className="badge badge-active">{u.stats.admins} admin{u.stats.admins > 1 ? 's' : ''}</span> : <span className="badge badge-dues">No admin yet</span>}</td>
                    <td className="hide-sm">{u.stats.students}<div className="muted small">{u.stats.onList} on list</div></td>
                    <td><Badge status={u.isActive ? 'active' : 'inactive'} /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle(u)}>{u.isActive ? 'Deactivate' : 'Activate'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <UniversityDrawer uni={unis.find((u) => u._id === selected)} onClose={() => setSelected(null)} onChanged={load} />
    </div>
  );
}

function UniversityDrawer({ uni, onClose, onChanged }) {
  const [edit, setEdit] = useState(emptyUni);
  const [admins, setAdmins] = useState([]);
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!uni) return;
    setEdit({ name: uni.name, shortName: uni.shortName || '', code: uni.code, slug: uni.slug || uni.code.toLowerCase(), domains: uni.domains.join(', '), website: uni.website || '' });
    setAdminForm({ name: '', email: '', password: '' });
    api.get(`/platform/universities/${uni._id}/admins`).then((r) => setAdmins(r.data)).catch(() => setAdmins([]));
  }, [uni?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault();
    setBusy('save');
    try {
      await api.patch(`/platform/universities/${uni._id}`, { ...edit, domains: edit.domains.split(',') });
      toast.success('Saved');
      onChanged();
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
      const { data } = await api.post(`/platform/universities/${uni._id}/admins`, adminForm);
      setAdmins((a) => [...a, data]);
      setAdminForm({ name: '', email: '', password: '' });
      toast.success(`${data.name} can now manage ${uni.shortName || uni.name}`);
      onChanged();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy('');
    }
  };

  return (
    <Drawer open={!!uni} onClose={onClose} title={uni?.name} subtitle={uni && `${uni.code} · ${uni.domains.map((d) => '@' + d).join(', ')}`}>
      {uni && (
        <>
          <div>
            <div className="section-title">University admins</div>
            <p className="muted small" style={{ marginBottom: 10 }}>Each university has its own admin. They manage only {uni.shortName || uni.name}: departments, officers, the official student list, requests and reports. They sign in on <a href={`/portal/${uni.slug || uni.code.toLowerCase()}`} target="_blank" rel="noreferrer">/portal/{uni.slug || uni.code.toLowerCase()}</a>.</p>
            {admins.length === 0 ? (
              <p className="policy-note small">No admin yet – this portal can't be used until you add one (for example the registrar or Student Affairs).</p>
            ) : (
              <div className="row-list" style={{ marginBottom: 12 }}>
                {admins.map((a) => (
                  <div key={a._id} className="officer-row">
                    <span className="avatar">{a.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
                    <div className="grow"><strong>{a.name}</strong><small>{a.email}</small></div>
                    <Badge status={a.isActive ? 'active' : 'inactive'} />
                  </div>
                ))}
              </div>
            )}
            <form className="auth-form-stack" style={{ gap: 10, marginTop: 10 }} onSubmit={addAdmin}>
              <div className="grid-2">
                <input className="input" required placeholder="Full name" value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} />
                <input className="input" required type="email" placeholder={`name@${uni.domains[0] || 'university.ac.lk'}`} value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} />
              </div>
              <input className="input" required minLength={6} placeholder="Temporary password (they can change it later)" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} />
              <div><button className="btn btn-soft btn-sm" disabled={busy === 'admin'}>{busy === 'admin' ? <Spin /> : <UserPlus size={15} />} Add university admin</button></div>
            </form>
          </div>
          <div>
            <div className="section-title">Logo</div>
            <LogoPanel university={uni} endpoint={`/platform/universities/${uni._id}/logo`} onChanged={onChanged} />
          </div>

          <form onSubmit={save}>
            <div className="section-title">Details</div>
            <div className="auth-form-stack" style={{ gap: 10 }}>
              <label className="label">Full name<input className="input" required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
              <div className="grid-2">
                <label className="label">Short name<input className="input" value={edit.shortName} onChange={(e) => setEdit({ ...edit, shortName: e.target.value })} /></label>
                <label className="label">Code<input className="input" required maxLength={6} value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></label>
              </div>
              <label className="label">Portal address<input className="input" required value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} /></label>
              <small className="muted">Students and staff open {window.location.origin}/portal/{edit.slug || '…'}</small>
              <label className="label">Email domains (comma separated)<input className="input" required value={edit.domains} onChange={(e) => setEdit({ ...edit, domains: e.target.value })} /></label>
              <small className="muted">Sub-domains match automatically: ruh.ac.lk also covers stu.ruh.ac.lk.</small>
              <label className="label">Website<input className="input" value={edit.website} onChange={(e) => setEdit({ ...edit, website: e.target.value })} /></label>
              <div><button className="btn btn-primary btn-sm" disabled={busy === 'save'}>{busy === 'save' ? <Spin /> : null} Save changes</button></div>
            </div>
          </form>

        </>
      )}
    </Drawer>
  );
}
