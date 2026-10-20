import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PencilLine, Plus, Trash2 } from 'lucide-react';
import api, { errMsg } from '../../api';
import { useDialog } from '../../context/DialogContext';
import { Badge, Drawer, PageHeader, Skeleton } from '../../components/ui';

/* ---------------- Departments ---------------- */
export default function AdminDepartments() {
  const { confirm } = useDialog();
  const [depts, setDepts] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', description: '', order: '' });
  const [edit, setEdit] = useState(null);

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/departments/${edit._id}`, { name: edit.name, code: edit.code, description: edit.description, order: Number(edit.order) || 0 });
      toast.success('Department updated');
      setEdit(null);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const load = () => api.get('/departments').then((r) => setDepts(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post('/departments', { ...form, order: Number(form.order) || 0 });
      toast.success('Department added');
      setForm({ name: '', code: '', description: '', order: '' });
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
      toast.success('Department deleted');
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div className="page">
      <PageHeader title="Departments" subtitle="The offices that must clear every student. New requests include every active department, in this order." />
      <section className="card">
        <h2>Add department</h2>
        <p className="muted small" style={{ marginBottom: 12 }}>New requests include every active department.</p>
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
        {!depts ? <Skeleton h={220} r={14} /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Department</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {depts.map((d) => (
                  <tr key={d._id}>
                    <td className="muted">{d.order}</td>
                    <td><strong>{d.name}</strong> <span className="badge badge-pending">{d.code}</span></td>
                    <td className="small">{d.description}</td>
                    <td><Badge status={d.isActive ? 'active' : 'inactive'} /></td>
                    <td><div className="actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...d })} aria-label={`Edit ${d.name}`}><PencilLine size={14} /> Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle(d)}>{d.isActive ? 'Deactivate' : 'Activate'}</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => remove(d)} aria-label="Delete department"><Trash2 size={14} /></button>
                    </div></td>
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
            <div className="row-gap"><button className="btn btn-primary">Save changes</button><button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button></div>
          </form>
        )}
      </Drawer>
    </div>
  );
}
