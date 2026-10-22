import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Landmark, PencilLine, Plus, Trash2 } from 'lucide-react';
import api, { errMsg } from '../../api';
import { useDialog } from '../../context/DialogContext';
import { Badge, Drawer, PageHeader, Skeleton } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import FacultySelect, { facultyShort } from '../../components/FacultySelect';

/* ---------------- Offices (departments) ----------------
   Central offices clear every student of the university; faculty offices only their own faculty's students.
   A faculty admin manages their faculty's offices and sees the central ones read-only. */
export default function AdminDepartments() {
  const { user } = useAuth();
  const { confirm } = useDialog();
  const isUniAdmin = user.role === 'admin';
  const [depts, setDepts] = useState(null);
  const [view, setView] = useState('');
  const [form, setForm] = useState({ name: '', code: '', description: '', order: '', faculty: isUniAdmin ? 'central' : '' });
  const [edit, setEdit] = useState(null);
  const mine = (d) => isUniAdmin || (d.faculty && String(d.faculty._id || d.faculty) === String(user.facultyInfo?.id));

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/departments/${edit._id}`, { name: edit.name, code: edit.code, description: edit.description, order: Number(edit.order) || 0, ...(isUniAdmin ? { faculty: edit.facultyValue } : {}) });
      toast.success('Office updated');
      setEdit(null);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const load = () => api.get('/departments', { params: isUniAdmin && view ? { faculty: view } : {} }).then((r) => setDepts(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post('/departments', { ...form, order: Number(form.order) || 0 });
      toast.success('Office added');
      setForm({ ...form, name: '', code: '', description: '', order: '' });
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const toggle = async (d) => {
    try {
      await api.patch(`/departments/${d._id}`, { isActive: !d.isActive });
      toast.success(`${d.name} ${d.isActive ? 'deactivated' : 'activated'}`);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const remove = async (d) => {
    const ok = await confirm({ title: `Delete ${d.name}?`, message: 'Only possible if no request uses it. Otherwise, deactivate it.', confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/departments/${d._id}`);
      toast.success('Office deleted');
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Offices"
        subtitle={isUniAdmin
          ? 'Central offices clear every student; faculty offices clear only their own faculty. New requests include all active offices for the student, in this order.'
          : `The ${user.facultyInfo?.name || 'faculty'} offices that clear your students, plus the university's central offices.`}
      />
      <section className="card">
        <h2>Add an office</h2>
        <p className="muted small" style={{ marginBottom: 12 }}>{isUniAdmin ? 'Choose Central for a university-wide office, or the faculty it belongs to.' : `New offices belong to the ${user.facultyInfo?.name || 'faculty'}.`}</p>
        {isUniAdmin && (
          <label className="label" style={{ maxWidth: 360, marginBottom: 12 }}>Belongs to
            <FacultySelect central value={form.faculty} onChange={(v) => setForm({ ...form, faculty: v })} />
          </label>
        )}
        <form className="grid-4" onSubmit={create}>
          <label className="label">Name<input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="label">Code<input className="input" required maxLength={6} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label className="label">Description<input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div className="row-gap" style={{ flexWrap: 'nowrap' }}>
            <label className="label" style={{ flex: 1 }}>Order<input className="input" type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} /></label>
            <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }}><Plus size={16} /> Add</button>
          </div>
        </form>
      </section>
      <section className="card">
        {isUniAdmin && (
          <div className="toolbar">
            <FacultySelect all central value={view} onChange={setView} className="input select-sm" />
            <span className="muted small push-right">{depts ? `${depts.length} offices` : ''}</span>
          </div>
        )}
        {!depts ? <Skeleton h={220} r={14} /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Office</th><th>Belongs to</th><th className="hide-sm">Description</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {[...depts].sort((a, b) => (a.faculty ? 0 : 1) - (b.faculty ? 0 : 1) || facultyShort(a.faculty?.name || '').localeCompare(facultyShort(b.faculty?.name || '')) || a.order - b.order).map((d) => (
                  <tr key={d._id}>
                    <td className="muted">{d.order}</td>
                    <td><strong>{d.name}</strong> <span className="badge badge-pending">{d.code}</span></td>
                    <td className="small">{d.faculty ? <span title={d.faculty.name}>{facultyShort(d.faculty.name)}</span> : <span className="central-tag"><Landmark size={12} /> Central</span>}</td>
                    <td className="small hide-sm">{d.description}</td>
                    <td><Badge status={d.isActive ? 'active' : 'inactive'} /></td>
                    <td>{mine(d) ? (
                      <div className="actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...d, facultyValue: d.faculty ? (d.faculty._id || d.faculty) : 'central' })} aria-label={`Edit ${d.name}`}><PencilLine size={14} /> Edit</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggle(d)}>{d.isActive ? 'Deactivate' : 'Activate'}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => remove(d)} aria-label="Delete office"><Trash2 size={14} /></button>
                      </div>
                    ) : <span className="muted small">Managed by the university admin</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Drawer open={!!edit} onClose={() => setEdit(null)} title={edit ? `Edit ${edit.name}` : ''} subtitle="Changes apply to new requests and the tracker order.">
        {edit && (
          <form onSubmit={saveEdit} className="form-stack">
            <label className="label">Name<input className="input" required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <label className="label">Code<input className="input" required maxLength={6} value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></label>
            <label className="label">Description<input className="input" value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
            <label className="label">Order on the tracker<input className="input" type="number" value={edit.order} onChange={(e) => setEdit({ ...edit, order: e.target.value })} /></label>
            {isUniAdmin && (
              <label className="label">Belongs to
                <FacultySelect central value={edit.facultyValue} onChange={(v) => setEdit({ ...edit, facultyValue: v })} />
                <small className="field-hint">An office that already has requests, dues or officers can&rsquo;t move to another faculty.</small>
              </label>
            )}
            <div className="row-gap"><button className="btn btn-primary">Save changes</button><button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button></div>
          </form>
        )}
      </Drawer>
    </div>
  );
}
