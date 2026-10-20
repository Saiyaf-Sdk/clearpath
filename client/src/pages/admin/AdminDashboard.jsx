import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity, BadgeCheck, Building2, ClipboardList, Clock, Download, FileSpreadsheet, GraduationCap, Info, LayoutDashboard, Plus, Search,
  Upload,
  ShieldCheck, Trash2, Users, Wallet,
} from 'lucide-react';
import api, { errMsg } from '../../api';
import { useDialog } from '../../context/DialogContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { item, stagger } from '../../components/Page';
import { Badge, cap, Empty, fmtDate, lkr, PageSkeleton, Skeleton, StatCard, Tabs, UniLogo } from '../../components/ui';

const TABS = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'requests', label: 'Requests', icon: ClipboardList },
  { value: 'roster', label: 'Student list', icon: FileSpreadsheet },
  { value: 'users', label: 'Users', icon: Users },
  { value: 'departments', label: 'Departments', icon: Building2 },
  { value: 'audit', label: 'Audit log', icon: Activity },
];

// Status colours carry meaning only: grey = waiting, brand = in progress, green = done
const STATUS_COLORS = { pending: '#94a3b8', 'in-progress': '#4f46e5', completed: '#10b981', cancelled: '#cbd5e1' };
const initials = (name = '') => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

const fade = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, transition: { duration: 0.22 } };

export default function AdminDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <span className="eyebrow"><ShieldCheck size={13} /> Admin console</span>
          <div className="row-gap" style={{ gap: 12, marginBottom: 4 }}>
            <UniLogo university={user.university} size={44} />
            <h1 style={{ margin: 0 }}>{user.university?.name || 'University'}</h1>
          </div>
          <p className="muted">Manage departments and staff, and see where students are waiting.</p>
        </div>
      </div>
      <Tabs id="admin" tabs={TABS} value={tab} onChange={setTab} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} {...fade}>
          {tab === 'overview' && <Overview />}
          {tab === 'requests' && <Requests />}
          {tab === 'users' && <UsersTab />}
          {tab === 'departments' && <Departments />}
          {tab === 'roster' && <Roster />}
          {tab === 'audit' && <Audit />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label && <strong>{label}</strong>}
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color || p.payload?.fill }}>{p.name}: <strong>{p.value}</strong></div>
      ))}
    </div>
  );
}

/* ---------------- Overview ---------------- */
function Overview() {
  const [data, setData] = useState(null);
  const { theme } = useTheme();
  useEffect(() => {
    api.get('/admin/reports').then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);
  if (!data) return <PageSkeleton />;

  const axis = theme === 'dark' ? '#9a98bf' : '#6b6a8a';
  const grid = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.12)';
  const unpaid = (data.dueTotals.unpaid?.total || 0) + (data.dueTotals['receipt-submitted']?.total || 0);
  const collected = data.dueTotals.paid?.total || 0;
  const pie = Object.entries(data.statusCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: cap(k.replace('-', ' ')), value: v, fill: STATUS_COLORS[k] }));
  const active = data.statusCounts.pending + data.statusCounts['in-progress'];

  return (
    <>
      <motion.div className="stats" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={item}><StatCard icon={GraduationCap} tone="brand" label="Students" value={data.totals.students} /></motion.div>
        <motion.div variants={item}><StatCard icon={Clock} tone="brand" label="Active requests" value={active} /></motion.div>
        <motion.div variants={item}><StatCard icon={BadgeCheck} tone="good" label="Certificates issued" value={data.totals.certificates} /></motion.div>
        <motion.div variants={item}><StatCard icon={Activity} tone="brand" label="Avg. days to clear" value={data.avgClearanceDays} format={(v) => v.toFixed(1)} /></motion.div>
        <motion.div variants={item}><StatCard icon={Wallet} tone="warn" label="Outstanding dues" value={unpaid} format={lkr} sub={`${lkr(collected)} collected`} /></motion.div>
      </motion.div>

      <div className="chart-grid">
        <section className="card chart-card">
          <h2>Requests by status</h2>
          <p className="muted small">All clearance requests in the system</p>
          {pie.length === 0 ? (
            <Empty icon={ClipboardList} title="No requests yet" />
          ) : (
            <>
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pie} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95} paddingAngle={3} stroke="none" animationDuration={900}>
                      {pie.map((p) => <Cell key={p.name} fill={p.fill} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center"><strong>{data.totals.requests}</strong><small>Total</small></div>
              </div>
              <div className="legend-list">
                {pie.map((p) => (
                  <div className="legend-row" key={p.name}>
                    <span><i style={{ background: p.fill }} />{p.name}</span>
                    <strong>{p.value}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="card chart-card">
          <h2>Where students are waiting</h2>
          <p className="muted small">Department items on active requests. Long grey or amber bars are bottlenecks.</p>
          <ResponsiveContainer width="100%" height={Math.max(260, data.departmentLoad.length * 46)}>
            <BarChart data={data.departmentLoad} layout="vertical" margin={{ top: 16, right: 16, left: 8, bottom: 0 }} barSize={18}>
              <CartesianGrid horizontal={false} stroke={grid} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="department" width={130} tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: axis }} />
              <Bar dataKey="cleared" name="Cleared" stackId="a" fill="#10b981" animationDuration={900} />
              <Bar dataKey="dues" name="Dues found" stackId="a" fill="#f59e0b" animationDuration={900} />
              <Bar dataKey="pending" name="Pending" stackId="a" fill="#818cf8" radius={[0, 6, 6, 0]} animationDuration={900} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>
    </>
  );
}

/* ---------------- Requests ---------------- */
function Requests() {
  const { prompt } = useDialog();
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState('');

  const load = () => api.get('/admin/requests', { params: { status: status || undefined } }).then((r) => setRows(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const override = async (r, it) => {
    if (['cancelled', 'completed'].includes(r.status)) return;
    const action = it.status === 'cleared' ? 'flag' : 'clear';
    const remark = await prompt({
      title: `${action === 'clear' ? 'Clear' : 'Flag'} ${it.department.name}?`,
      message: `Admin override for ${r.student.name}`,
      defaultValue: 'Admin override',
      confirmText: action === 'clear' ? 'Clear' : 'Flag',
    });
    if (remark === null) return;
    try {
      await api.patch(`/clearances/${r._id}/items/${it.department._id}`, { action, remark });
      toast.success(`${it.department.name} updated`);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <section className="card">
      <div className="toolbar">
        <select className="input" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className="muted small">Tip: click a department chip to override it.</span>
      </div>
      {!rows ? <Skeleton h={200} r={14} /> : rows.length === 0 ? <Empty icon={ClipboardList} title="No requests" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Reason</th><th>Submitted</th><th>Departments</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td>
                    <div className="person">
                      <span className="avatar">{initials(r.student?.name)}</span>
                      <div><strong>{r.student?.name}</strong><small>{r.student?.regNo}</small></div>
                    </div>
                  </td>
                  <td>{cap(r.reason)}</td>
                  <td>{fmtDate(r.createdAt)}</td>
                  <td>
                    <div className="row-gap" style={{ gap: 4 }}>
                      {r.items.map((it) => (
                        <button key={it.department?._id} className={`chip-dept ${it.status}`} title={`${it.department?.name}: ${it.status}`} onClick={() => override(r, it)}>
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

function UsersTab() {
  const { confirm } = useDialog();
  const [users, setUsers] = useState(null);
  const [depts, setDepts] = useState([]);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyUser);
  const [showForm, setShowForm] = useState(false);

  const load = () => api.get('/admin/users', { params: { role: role || undefined, search: search || undefined } }).then((r) => setUsers(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, [role]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.get('/departments').then((r) => setDepts(r.data)).catch(() => {}); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/users', form);
      toast.success(`${cap(form.role)} account created`);
      setForm(emptyUser);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const toggle = async (u) => {
    try {
      await api.patch(`/admin/users/${u._id}`, { isActive: !u.isActive });
      toast.success(`${u.name} ${u.isActive ? 'disabled' : 'enabled'}`);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const remove = async (u) => {
    const ok = await confirm({ title: `Delete ${u.name}?`, message: 'This cannot be undone.', confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/admin/users/${u._id}`);
      toast.success('User deleted');
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <AnimatePresence initial={false}>
        {showForm && (
          <motion.section className="card" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <h2>Create account</h2>
            <form className="grid-4" style={{ marginTop: 12 }} onSubmit={create}>
              <label className="label">Name<input className="input" required value={form.name} onChange={set('name')} /></label>
              <label className="label">Email<input className="input" type="email" required value={form.email} onChange={set('email')} /></label>
              <label className="label">Password<input className="input" required minLength={6} value={form.password} onChange={set('password')} /></label>
              <label className="label">
                Role
                <select className="input" value={form.role} onChange={set('role')}>
                  <option value="officer">Department officer</option>
                  <option value="admin">Admin</option>
                  <option value="student">Student</option>
                </select>
              </label>
              {form.role === 'officer' && (
                <label className="label">
                  Department
                  <select className="input" required value={form.department} onChange={set('department')}>
                    <option value="">Select…</option>
                    {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </label>
              )}
              {form.role === 'student' && (
                <>
                  <label className="label">Reg no.<input className="input" required value={form.regNo} onChange={set('regNo')} /></label>
                  <label className="label">Faculty<input className="input" required value={form.faculty} onChange={set('faculty')} /></label>
                </>
              )}
              <div className="row-gap">
                <button className="btn btn-primary">Create</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="card">
        <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <div className="search-box">
            <Search size={16} />
            <input className="input" placeholder="Search name, email, reg no. and press Enter" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input" style={{ width: 'auto' }} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="student">Students</option>
            <option value="officer">Officers</option>
            <option value="admin">Admins</option>
          </select>
          {!showForm && <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowForm(true)}><Plus size={15} /> New account</button>}
        </form>
        {!users ? <Skeleton h={220} r={14} /> : users.length === 0 ? <Empty icon={Users} title="No users found" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>User</th><th>Role</th><th>Details</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div className="person">
                        <span className="avatar">{initials(u.name)}</span>
                        <div><strong>{u.name}</strong><small>{u.email}</small></div>
                      </div>
                    </td>
                    <td><span className="badge badge-role" style={{ textTransform: 'capitalize' }}>{u.role}</span></td>
                    <td className="small">{u.role === 'officer' ? u.department?.name : u.role === 'student' ? `${u.regNo} · ${u.faculty}` : '—'}</td>
                    <td><Badge status={u.isActive ? 'active' : 'inactive'} /></td>
                    <td><div className="actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle(u)}>{u.isActive ? 'Disable' : 'Enable'}</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => remove(u)} aria-label="Delete user"><Trash2 size={14} /></button>
                    </div></td>
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
function Departments() {
  const { confirm } = useDialog();
  const [depts, setDepts] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', description: '', order: '' });

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
    <>
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
    </>
  );
}

/* ---------------- Audit log ---------------- */
function Audit() {
  const [logs, setLogs] = useState(null);
  useEffect(() => {
    api.get('/admin/audit').then((r) => setLogs(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);
  return (
    <section className="card">
      <h2>Audit log</h2>
      <p className="muted small" style={{ marginBottom: 12 }}>Last 100 actions across the system</p>
      {!logs ? <Skeleton h={220} r={14} /> : logs.length === 0 ? <Empty icon={Activity} title="No activity yet" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td className="small muted" style={{ whiteSpace: 'nowrap' }}>{new Date(l.createdAt).toLocaleString('en-GB')}</td>
                  <td><strong>{l.actor?.name || '—'}</strong> <span className="muted small">{l.actor?.role}</span></td>
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

/* ---------------- Official student list ---------------- */
// Minimal CSV parser (handles quotes and commas inside quotes)
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i += 1; } else if (c === '"') quoted = false; else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

// Turns CSV rows into { regNo, email, name, faculty } using the header names
function toStudents(rows) {
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
  const col = (...names) => head.findIndex((h) => names.includes(h));
  const iReg = col('regno', 'registrationnumber', 'registrationno', 'regnumber', 'indexno');
  const iEmail = col('email', 'universityemail', 'emailaddress');
  const iName = col('name', 'fullname', 'studentname');
  const iFac = col('faculty');
  if (iReg < 0 || iEmail < 0 || iName < 0) throw new Error('The CSV needs the columns: regNo, email, name (faculty is optional).');
  return rows.slice(1).map((r) => ({ regNo: r[iReg] || '', email: r[iEmail] || '', name: r[iName] || '', faculty: iFac >= 0 ? r[iFac] || '' : '' }));
}

const SAMPLE_CSV = 'regNo,name,email,faculty\nEG/2021/4519,Amal Silva,amal@student.lk,Engineering\nSC/2021/1033,Dilini Jayasinghe,dilini@student.lk,Science\n';

function Roster() {
  const { confirm } = useDialog();
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState({ regNo: '', name: '', email: '', faculty: '' });
  const { user } = useAuth();
  const domains = user.university?.domains || [];

  const load = () => api.get('/admin/roster', { params: { search: search || undefined, status: status || undefined } })
    .then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFile = async (file) => {
    if (!file) return;
    setResult(null);
    try {
      const students = toStudents(parseCSV(await file.text()));
      if (!students.length) throw new Error('No students found in this file.');
      setPreview({ name: file.name, students });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const doImport = async () => {
    setImporting(true);
    try {
      const { data: r } = await api.post('/admin/roster/import', { rows: preview.students });
      setResult(r);
      setPreview(null);
      toast.success(`${r.added} added, ${r.updated} updated`);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setImporting(false);
    }
  };

  const addOne = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/roster', form);
      toast.success(`${form.name} added to the student list`);
      setForm({ regNo: '', name: '', email: '', faculty: '' });
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const remove = async (r) => {
    const ok = await confirm({ title: `Remove ${r.name}?`, message: 'They will no longer be able to create an account.', confirmText: 'Remove', tone: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/admin/roster/${r._id}`);
      toast.success('Removed from the student list');
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const downloadSample = () => {
    const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student-list-sample.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <div className="policy-note" style={{ marginBottom: 18 }}>
        <Info size={16} />
        <span>
          Only students on this list can create an account, using their own university email
          {domains.length ? ` (${domains.map((d) => `@${d}`).join(' or ')})` : ''}. Import the list from the registrar's records each intake.
        </span>
      </div>

      <div className="grid-2" style={{ alignItems: 'start', marginBottom: 20 }}>
        <section className="card" style={{ margin: 0 }}>
          <h2><Upload size={17} className="text-brand" style={{ verticalAlign: -3, marginRight: 6 }} />Import from CSV</h2>
          <p className="muted small" style={{ margin: '4px 0 14px' }}>Columns: regNo, name, email, faculty. Existing students are updated, students who already have an account are skipped.</p>
          <label className="dropzone">
            <FileSpreadsheet size={20} />
            <span>{preview ? preview.name : 'Choose a CSV file'}</span>
            <small className="muted">{preview ? `${preview.students.length} students ready to import` : 'Exported from the registrar system or Excel'}</small>
            <input type="file" accept=".csv,text/csv" hidden onChange={(e) => { onFile(e.target.files[0]); e.target.value = ''; }} />
          </label>
          <div className="row-gap" style={{ marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" disabled={!preview || importing} onClick={doImport}>
              {importing ? 'Importing…' : `Import${preview ? ` ${preview.students.length} students` : ''}`}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={downloadSample}><Download size={14} /> Sample CSV</button>
          </div>
          {result && (
            <div className="small" style={{ marginTop: 12 }}>
              <strong>{result.added}</strong> added · <strong>{result.updated}</strong> updated · <strong>{result.skipped}</strong> skipped (already registered)
              {result.errors.length > 0 && (
                <ul className="muted" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  {result.errors.slice(0, 6).map((er) => <li key={`${er.row}-${er.regNo}`}>Row {er.row}{er.regNo ? ` (${er.regNo})` : ''}: {er.reason}</li>)}
                  {result.errors.length > 6 && <li>…and {result.errors.length - 6} more</li>}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="card" style={{ margin: 0 }}>
          <h2><Plus size={17} className="text-brand" style={{ verticalAlign: -3, marginRight: 6 }} />Add one student</h2>
          <form className="grid-2" style={{ marginTop: 14 }} onSubmit={addOne}>
            <label className="label">Registration no.<input className="input" required value={form.regNo} onChange={(e) => setForm({ ...form, regNo: e.target.value })} /></label>
            <label className="label">Full name<input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="label">University email<input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="label">Faculty<input className="input" value={form.faculty} onChange={(e) => setForm({ ...form, faculty: e.target.value })} /></label>
            <div><button className="btn btn-primary btn-sm">Add to list</button></div>
          </form>
        </section>
      </div>

      <section className="card">
        <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <div className="search-box">
            <Search size={16} />
            <input className="input" placeholder="Search reg no., name or email and press Enter" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Everyone</option>
            <option value="pending">Not registered yet</option>
            <option value="activated">Account created</option>
          </select>
          {data && <span className="muted small" style={{ marginLeft: 'auto' }}>{data.activated} of {data.total} students have created an account</span>}
        </form>
        {!data ? <Skeleton h={220} r={14} /> : data.rows.length === 0 ? <Empty icon={FileSpreadsheet} title="No students on the list yet">Import a CSV from the registrar to get started.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Reg. no.</th><th>Name</th><th>University email</th><th>Faculty</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r._id}>
                    <td><strong>{r.regNo}</strong></td>
                    <td>{r.name}</td>
                    <td className="small">{r.email}</td>
                    <td className="small">{r.faculty || '—'}</td>
                    <td><Badge status={r.status === 'activated' ? 'activated' : 'invited'} /></td>
                    <td>{r.status !== 'activated' && <button className="btn btn-ghost btn-sm" onClick={() => remove(r)} aria-label="Remove from list"><Trash2 size={14} /></button>}</td>
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
