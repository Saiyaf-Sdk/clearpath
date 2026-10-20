import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api';
import { Alert, Badge, cap, Empty, fmtDate, lkr, Spinner } from '../../components/ui';

const TABS = ['overview', 'requests', 'users', 'departments', 'audit'];

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const flash = (type, text) => setMsg({ type, text });

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h1>Admin console</h1>
          <p className="muted">Manage departments, staff and monitor clearance progress.</p>
        </div>
      </div>
      <Alert type={msg.type} onClose={() => setMsg({ type: '', text: '' })}>{msg.text}</Alert>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{cap(t)}</button>
        ))}
      </div>
      {tab === 'overview' && <Overview flash={flash} />}
      {tab === 'requests' && <Requests flash={flash} />}
      {tab === 'users' && <Users flash={flash} />}
      {tab === 'departments' && <Departments flash={flash} />}
      {tab === 'audit' && <Audit flash={flash} />}
    </div>
  );
}

/* ---------------- Overview ---------------- */
function Overview({ flash }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get('/admin/reports').then((r) => setData(r.data)).catch((e) => flash('error', errMsg(e)));
  }, []);
  if (!data) return <Spinner />;

  const max = Math.max(1, ...data.departmentLoad.map((d) => d.pending + d.dues + d.cleared));
  const unpaid = (data.dueTotals.unpaid?.total || 0) + (data.dueTotals['receipt-submitted']?.total || 0);
  const collected = data.dueTotals.paid?.total || 0;

  return (
    <>
      <div className="stats">
        <div className="stat"><span>Students</span><strong>{data.totals.students}</strong></div>
        <div className="stat"><span>Active requests</span><strong>{data.statusCounts.pending + data.statusCounts['in-progress']}</strong></div>
        <div className="stat stat-good"><span>Certificates issued</span><strong>{data.totals.certificates}</strong></div>
        <div className="stat"><span>Avg. days to clear</span><strong>{data.avgClearanceDays || '-'}</strong></div>
        <div className="stat stat-warn"><span>Outstanding dues</span><strong>{lkr(unpaid)}</strong></div>
        <div className="stat"><span>Dues collected</span><strong>{lkr(collected)}</strong></div>
      </div>

      <section className="card">
        <h2>Workload by department (active requests)</h2>
        <p className="muted">Long amber or grey bars show where students are waiting.</p>
        <div className="legend">
          <span><i className="sw sw-cleared" />Cleared</span>
          <span><i className="sw sw-dues" />Dues found</span>
          <span><i className="sw sw-pending" />Pending</span>
        </div>
        <div className="bars">
          {data.departmentLoad.map((d) => (
            <div className="bar-row" key={d.department}>
              <span className="bar-label">{d.department}</span>
              <div className="bar-track">
                <div className="bar-seg sw-cleared" style={{ width: `${(d.cleared / max) * 100}%` }} title={`Cleared: ${d.cleared}`} />
                <div className="bar-seg sw-dues" style={{ width: `${(d.dues / max) * 100}%` }} title={`Dues: ${d.dues}`} />
                <div className="bar-seg sw-pending" style={{ width: `${(d.pending / max) * 100}%` }} title={`Pending: ${d.pending}`} />
              </div>
              <span className="bar-value">{d.pending} pending · {d.dues} dues</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Requests by status</h2>
        <div className="status-row">
          {Object.entries(data.statusCounts).map(([s, n]) => (
            <div key={s} className="status-chip"><Badge status={s} /> <strong>{n}</strong></div>
          ))}
        </div>
      </section>
    </>
  );
}

/* ---------------- Requests ---------------- */
function Requests({ flash }) {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState('');

  const load = () => api.get('/admin/requests', { params: { status: status || undefined } }).then((r) => setRows(r.data)).catch((e) => flash('error', errMsg(e)));
  useEffect(() => { load(); }, [status]);

  const override = async (r, it) => {
    const action = it.status === 'cleared' ? 'flag' : 'clear';
    const remark = window.prompt(`Admin override: ${action} ${it.department.name} for ${r.student.name}. Remark:`, 'Admin override');
    if (remark === null) return;
    try {
      await api.patch(`/clearances/${r._id}/items/${it.department._id}`, { action, remark });
      flash('success', 'Updated');
      load();
    } catch (e) {
      flash('error', errMsg(e));
    }
  };

  if (!rows) return <Spinner />;
  return (
    <section className="card">
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className="muted small">Click a department chip to override it.</span>
      </div>
      {rows.length === 0 ? <Empty>No requests.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Reason</th><th>Submitted</th><th>Departments</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td><strong>{r.student?.name}</strong><div className="muted small">{r.student?.regNo}</div></td>
                  <td>{cap(r.reason)}</td>
                  <td>{fmtDate(r.createdAt)}</td>
                  <td>
                    <div className="chips">
                      {r.items.map((it) => (
                        <button key={it.department?._id} className={`chip chip-${it.status}`} title={`${it.department?.name}: ${it.status}`} onClick={() => !['cancelled', 'completed'].includes(r.status) && override(r, it)}>
                          {it.department?.code}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td><Badge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------------- Users ---------------- */
const emptyUser = { name: '', email: '', password: '', role: 'officer', department: '', regNo: '', faculty: '' };

function Users({ flash }) {
  const [users, setUsers] = useState(null);
  const [depts, setDepts] = useState([]);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyUser);

  const load = () => api.get('/admin/users', { params: { role: role || undefined, search: search || undefined } }).then((r) => setUsers(r.data)).catch((e) => flash('error', errMsg(e)));
  useEffect(() => { load(); }, [role]);
  useEffect(() => { api.get('/departments').then((r) => setDepts(r.data)); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/users', form);
      flash('success', `${cap(form.role)} account created`);
      setForm(emptyUser);
      load();
    } catch (err) {
      flash('error', errMsg(err));
    }
  };

  const toggle = async (u) => {
    try {
      await api.patch(`/admin/users/${u._id}`, { isActive: !u.isActive });
      load();
    } catch (err) {
      flash('error', errMsg(err));
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete ${u.name}?`)) return;
    try {
      await api.delete(`/admin/users/${u._id}`);
      flash('success', 'User deleted');
      load();
    } catch (err) {
      flash('error', errMsg(err));
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <section className="card">
        <h2>Create account</h2>
        <form className="grid-4" onSubmit={create}>
          <label>Name<input required value={form.name} onChange={set('name')} /></label>
          <label>Email<input type="email" required value={form.email} onChange={set('email')} /></label>
          <label>Password<input required minLength={6} value={form.password} onChange={set('password')} /></label>
          <label>
            Role
            <select value={form.role} onChange={set('role')}>
              <option value="officer">Department officer</option>
              <option value="admin">Admin</option>
              <option value="student">Student</option>
            </select>
          </label>
          {form.role === 'officer' && (
            <label>
              Department
              <select required value={form.department} onChange={set('department')}>
                <option value="">Select…</option>
                {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </label>
          )}
          {form.role === 'student' && (
            <>
              <label>Reg no.<input required value={form.regNo} onChange={set('regNo')} /></label>
              <label>Faculty<input required value={form.faculty} onChange={set('faculty')} /></label>
            </>
          )}
          <div><button className="btn btn-primary">Create</button></div>
        </form>
      </section>

      <section className="card">
        <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <input className="search" placeholder="Search name, email, reg no." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="student">Students</option>
            <option value="officer">Officers</option>
            <option value="admin">Admins</option>
          </select>
          <button className="btn btn-ghost btn-sm">Search</button>
        </form>
        {!users ? <Spinner /> : users.length === 0 ? <Empty>No users found.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Details</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td><strong>{u.name}</strong></td>
                    <td>{u.email}</td>
                    <td><span className="role-tag">{u.role}</span></td>
                    <td className="small">{u.role === 'officer' ? u.department?.name : u.role === 'student' ? `${u.regNo} · ${u.faculty}` : '-'}</td>
                    <td>{u.isActive ? <span className="badge badge-cleared">Active</span> : <span className="badge badge-cancelled">Disabled</span>}</td>
                    <td className="actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle(u)}>{u.isActive ? 'Disable' : 'Enable'}</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => remove(u)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/* ---------------- Departments ---------------- */
function Departments({ flash }) {
  const [depts, setDepts] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', description: '', order: '' });

  const load = () => api.get('/departments').then((r) => setDepts(r.data)).catch((e) => flash('error', errMsg(e)));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post('/departments', { ...form, order: Number(form.order) || 0 });
      flash('success', 'Department added');
      setForm({ name: '', code: '', description: '', order: '' });
      load();
    } catch (err) {
      flash('error', errMsg(err));
    }
  };

  const toggle = async (d) => {
    try {
      await api.patch(`/departments/${d._id}`, { isActive: !d.isActive });
      load();
    } catch (err) {
      flash('error', errMsg(err));
    }
  };

  const remove = async (d) => {
    if (!window.confirm(`Delete ${d.name}?`)) return;
    try {
      await api.delete(`/departments/${d._id}`);
      flash('success', 'Department deleted');
      load();
    } catch (err) {
      flash('error', errMsg(err));
    }
  };

  return (
    <>
      <section className="card">
        <h2>Add department</h2>
        <p className="muted">New requests include every active department. Deactivate a department to stop adding it to new requests.</p>
        <form className="grid-4" onSubmit={create}>
          <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Code<input required maxLength={6} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label>Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label>Order<input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} /></label>
          <div><button className="btn btn-primary">Add</button></div>
        </form>
      </section>
      <section className="card">
        {!depts ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Code</th><th>Name</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {depts.map((d) => (
                  <tr key={d._id}>
                    <td>{d.order}</td>
                    <td><strong>{d.code}</strong></td>
                    <td>{d.name}</td>
                    <td className="small">{d.description}</td>
                    <td>{d.isActive ? <span className="badge badge-cleared">Active</span> : <span className="badge badge-cancelled">Inactive</span>}</td>
                    <td className="actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle(d)}>{d.isActive ? 'Deactivate' : 'Activate'}</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => remove(d)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/* ---------------- Audit log ---------------- */
function Audit({ flash }) {
  const [logs, setLogs] = useState(null);
  useEffect(() => {
    api.get('/admin/audit').then((r) => setLogs(r.data)).catch((e) => flash('error', errMsg(e)));
  }, []);
  if (!logs) return <Spinner />;
  return (
    <section className="card">
      <h2>Audit log (last 100 actions)</h2>
      {logs.length === 0 ? <Empty>No activity yet.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td className="small">{new Date(l.createdAt).toLocaleString('en-GB')}</td>
                  <td>{l.actor?.name || '-'} <span className="muted small">{l.actor?.role}</span></td>
                  <td><code>{l.action}</code></td>
                  <td className="small">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
