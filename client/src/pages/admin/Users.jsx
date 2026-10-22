import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { KeyRound, Plus, Trash2, UserCog, Users } from 'lucide-react';
import api, { errMsg } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import useFetch from '../../hooks/useFetch';
import useSort from '../../hooks/useSort';
import {
  Badge, cap, Drawer, Empty, ErrorState, fmtDate, lkr, PageHeader, PageSkeleton, Person, SearchInput, Skeleton, Spin,
} from '../../components/ui';
import FacultySelect, { facultyShort } from '../../components/FacultySelect';

const ROLE_LABEL = { student: 'Student', officer: 'Officer', facultyadmin: 'Faculty admin', admin: 'University admin' };
const emptyUser = { name: '', email: '', password: '', role: 'officer', department: '', regNo: '', facultyId: '' };

// Offices grouped for the drop-down: central first, then each faculty
const groupOffices = (list = []) => {
  const groups = {};
  list.forEach((d) => { const k = d.faculty ? facultyShort(d.faculty.name) : 'Central offices'; (groups[k] = groups[k] || []).push(d); });
  return Object.entries(groups).sort(([a], [b]) => (a === 'Central offices' ? -1 : b === 'Central offices' ? 1 : a.localeCompare(b)));
};
const OfficeOptions = ({ list }) => groupOffices(list).map(([g, ds]) => (
  <optgroup key={g} label={g}>{ds.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</optgroup>
));

export default function AdminUsers() {
  const { user: me } = useAuth();
  const { confirm } = useDialog();
  const [params, setParams] = useSearchParams();
  const role = params.get('role') || '';
  const search = params.get('q') || '';
  const faculty = params.get('faculty') || '';
  const isUniAdmin = me.role === 'admin';
  const list = useFetch('/admin/users', { params: { role: role || undefined, search: search || undefined, faculty: faculty || undefined } });
  const depts = useFetch('/departments');
  const [form, setForm] = useState(null); // create form
  const [edit, setEdit] = useState(null); // user being edited
  const [busy, setBusy] = useState(false);
  const summary = useFetch(edit?.role === 'student' ? `/admin/users/${edit._id}/summary` : null, { enabled: edit?.role === 'student' });
  const domains = me.university?.domains || [];
  const { sorted, th } = useSort(list.data, { key: '', dir: 'asc' }, {
    details: (u) => (u.role === 'officer' ? u.department?.name : u.regNo),
    faculty: (u) => (u.facultyId ? facultyShort(u.facultyId.name) : ''),
    active: (u) => (u.isActive ? 0 : 1),
  });

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/admin/users', form);
      toast.success(`${ROLE_LABEL[form.role]} account created`);
      setForm(null);
      list.refresh();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { name: edit.name, role: edit.role, department: edit.role === 'officer' ? edit.department?._id || edit.department : '', isActive: edit.isActive, phone: edit.phone };
      if (isUniAdmin && ['student', 'facultyadmin'].includes(edit.role)) body.facultyId = edit.facultyId?._id || edit.facultyId;
      if (edit.newPassword) body.password = edit.newPassword;
      await api.patch(`/admin/users/${edit._id}`, body);
      toast.success('Account updated');
      setEdit(null);
      list.refresh();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (u) => {
    if (u.isActive) {
      const ok = await confirm({ title: `Disable ${u.name}?`, message: 'They will not be able to log in until you enable the account again.', confirmText: 'Disable', tone: 'danger' });
      if (!ok) return;
    }
    try {
      await api.patch(`/admin/users/${u._id}`, { isActive: !u.isActive });
      toast.success(`${u.name} ${u.isActive ? 'disabled' : 'enabled'}`);
      list.refresh();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const remove = async (u) => {
    const ok = await confirm({ title: `Delete ${u.name}?`, message: 'This cannot be undone. Students with clearance records can only be disabled.', confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/admin/users/${u._id}`);
      toast.success('User deleted');
      list.refresh();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  if (list.error) return <ErrorState message={list.error} onRetry={list.reload} />;
  const counts = (list.data || []).reduce((m, u) => ({ ...m, [u.role]: (m[u.role] || 0) + 1 }), {});

  return (
    <div className="page">
      <PageHeader
        title="Users & staff"
        subtitle={isUniAdmin ? 'Officers, faculty admins, university admins and students of every faculty.' : `Officers and students of the ${me.facultyInfo?.name || 'faculty'}.`}
        actions={<button className="btn btn-primary" onClick={() => setForm({ ...emptyUser })}><Plus size={16} /> New account</button>}
      />

      <section className="card">
        <div className="toolbar">
          <SearchInput value={search} onChange={(v) => setParam('q', v)} placeholder="Search name, email or reg. no." />
          <div className="seg">
            {(isUniAdmin ? [['', 'Everyone'], ['officer', 'Officers'], ['facultyadmin', 'Faculty admins'], ['admin', 'Univ. admins'], ['student', 'Students']] : [['', 'Everyone'], ['officer', 'Officers'], ['student', 'Students']]).map(([v, l]) => (
              <button key={v} className={role === v ? 'active' : ''} onClick={() => setParam('role', v)}>{l}</button>
            ))}
          </div>
          {isUniAdmin && <FacultySelect all central value={faculty} onChange={(v) => setParam('faculty', v)} className="input select-sm" />}
          {list.data && <span className="muted small push-right">{list.data.length} account{list.data.length !== 1 ? 's' : ''}{!role && counts.student ? ` · ${counts.student} students` : ''}</span>}
        </div>
        {!list.data ? <PageSkeleton /> : list.data.length === 0 ? <Empty icon={Users} title="No users found" /> : (
          <div className="table-wrap">
            <table className="table-click">
              <thead><tr>{th('name', 'User')}{th('role', 'Role')}{th('faculty', 'Faculty', { className: 'hide-sm' })}{th('details', 'Details', { className: 'hide-sm' })}{th('active', 'Status')}<th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {sorted.map((u) => (
                  <tr key={u._id} onClick={() => setEdit({ ...u, newPassword: '' })}>
                    <td><Person name={u.name} photo={u.avatarUrl} sub={u.email} /></td>
                    <td><span className={`badge badge-role role-${u.role}`}>{ROLE_LABEL[u.role] || cap(u.role)}</span></td>
                    <td className="small hide-sm">{u.facultyId ? <span title={u.facultyId.name}>{facultyShort(u.facultyId.name)}</span> : <span className="muted">Central</span>}</td>
                    <td className="small hide-sm">{u.role === 'officer' ? u.department?.name : u.role === 'student' ? u.regNo : u.role === 'facultyadmin' ? 'Manages the faculty' : 'Whole university'}</td>
                    <td><Badge status={u.isActive ? 'active' : 'inactive'} /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="actions end">
                        <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...u, newPassword: '' })}><UserCog size={14} /> Manage</button>
                        {String(u._id) !== String(me.id) && <button className="btn btn-ghost btn-sm" onClick={() => toggle(u)}>{u.isActive ? 'Disable' : 'Enable'}</button>}
                        {String(u._id) !== String(me.id) && <button className="btn btn-ghost btn-sm" onClick={() => remove(u)} aria-label={`Delete ${u.name}`}><Trash2 size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Create */}
      <Drawer open={!!form} onClose={() => setForm(null)} title="New account" subtitle={domains.length ? `Use a university email (${domains.map((d) => `@${d}`).join(' or ')})` : ''}>
        {form && (
          <form className="form-stack" onSubmit={create}>
            <label className="label">Role
              <select className="input" value={form.role} onChange={set('role')}>
                <option value="officer">Office officer</option>
                {isUniAdmin && <option value="facultyadmin">Faculty admin</option>}
                {isUniAdmin && <option value="admin">University admin</option>}
                <option value="student">Student</option>
              </select>
            </label>
            {form.role === 'student' && <p className="policy-note small">Students normally create their own account from the official student list. Use this only for special cases.</p>}
            <label className="label">Full name<input className="input" required value={form.name} onChange={set('name')} /></label>
            <label className="label">Email<input className="input" type="email" required value={form.email} onChange={set('email')} placeholder={domains[0] ? `name@${domains[0]}` : ''} /></label>
            <label className="label">Temporary password<input className="input" required minLength={6} value={form.password} onChange={set('password')} /><small className="field-hint">Share it privately – they can change it under Account settings.</small></label>
            {form.role === 'officer' && (
              <label className="label">Department
                <select className="input" required value={form.department} onChange={set('department')}>
                  <option value="">Select…</option>
                  <OfficeOptions list={(depts.data || []).filter((d) => isUniAdmin || d.faculty)} />
                </select>
                <small className="field-hint">A faculty office&rsquo;s officer signs in on that faculty; a central office&rsquo;s officer on Central administration.</small>
              </label>
            )}
            {isUniAdmin && ['student', 'facultyadmin'].includes(form.role) && (
              <label className="label">Faculty<FacultySelect required value={form.facultyId} onChange={(v) => setForm({ ...form, facultyId: v })} /></label>
            )}
            {form.role === 'student' && (
              <label className="label">Reg. no.<input className="input" required value={form.regNo} onChange={set('regNo')} /></label>
            )}
            <div className="row-gap"><button className="btn btn-primary" disabled={busy}>{busy ? <Spin /> : <Plus size={16} />} Create account</button><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button></div>
          </form>
        )}
      </Drawer>

      {/* Manage */}
      <Drawer open={!!edit} onClose={() => setEdit(null)} title={edit?.name} subtitle={edit?.email}>
        {edit && (
          <>
            <form className="form-stack" onSubmit={save}>
              <label className="label">Full name<input className="input" required value={edit.name} disabled={edit.role === 'student'} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
              {edit.role !== 'student' && (
                <label className="label">Role
                  <select className="input" value={edit.role} disabled={String(edit._id) === String(me.id) || !isUniAdmin} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>
                    <option value="officer">Office officer</option>
                    {(isUniAdmin || edit.role === 'facultyadmin') && <option value="facultyadmin">Faculty admin</option>}
                    {(isUniAdmin || edit.role === 'admin') && <option value="admin">University admin</option>}
                  </select>
                </label>
              )}
              {edit.role === 'officer' && (
                <label className="label">Department
                  <select className="input" required value={edit.department?._id || edit.department || ''} onChange={(e) => setEdit({ ...edit, department: e.target.value })}>
                    <option value="">Select…</option>
                    <OfficeOptions list={(depts.data || []).filter((d) => isUniAdmin || d.faculty)} />
                  </select>
                </label>
              )}
              {isUniAdmin && ['student', 'facultyadmin'].includes(edit.role) && (
                <label className="label">Faculty<FacultySelect required value={edit.facultyId?._id || edit.facultyId || ''} onChange={(v) => setEdit({ ...edit, facultyId: v })} /></label>
              )}
              <label className="label"><span><KeyRound size={13} style={{ verticalAlign: -2 }} /> Set a new password (optional)</span><input className="input" minLength={6} value={edit.newPassword} onChange={(e) => setEdit({ ...edit, newPassword: e.target.value })} placeholder="Leave empty to keep the current one" /></label>
              {String(edit._id) !== String(me.id) && (
                <label className="check-row"><input type="checkbox" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} /> Account is active (can log in)</label>
              )}
              <div className="row-gap"><button className="btn btn-primary" disabled={busy}>{busy ? <Spin /> : null} Save changes</button><button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>Close</button></div>
            </form>

            {edit.role === 'student' && (
              <div>
                <div className="section-title">Clearance record</div>
                {!summary.data || summary.data.user?._id !== edit._id ? <Skeleton h={120} r={12} /> : (
                  <>
                    {summary.data.requests.length === 0 ? <p className="muted small">No clearance requests.</p> : summary.data.requests.map((r) => (
                      <div key={r._id} className="dd-row">
                        <div><strong>{cap(r.reason)}</strong><small className="muted">{fmtDate(r.createdAt)} · {r.items.filter((i) => i.status === 'cleared').length}/{r.items.length} cleared</small></div>
                        <Badge status={r.status} />
                      </div>
                    ))}
                    <div className="section-title" style={{ marginTop: 14 }}>Dues</div>
                    {summary.data.dues.length === 0 ? <p className="muted small">No dues.</p> : summary.data.dues.map((d) => (
                      <div key={d._id} className="dd-row">
                        <div><strong>{d.description}</strong><small className="muted">{d.department?.name}</small></div>
                        <div className="row-gap"><strong>{lkr(d.amount)}</strong><Badge status={d.status} /></div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
