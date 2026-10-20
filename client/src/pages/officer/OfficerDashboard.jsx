import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { CircleCheck, ClipboardList, Clock, FileText, Plus, Receipt, Search, TriangleAlert, Trash2, Wallet } from 'lucide-react';
import api, { errMsg, fileUrl } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { item, stagger } from '../../components/Page';
import { Badge, cap, deptIcon, Drawer, Empty, fmtDate, lkr, PageSkeleton, Spin, StatCard, Tabs } from '../../components/ui';

const OPEN = ['unpaid', 'receipt-submitted'];
const isImage = (url = '') => /\.(png|jpe?g)$/i.test(url);
const initials = (name = '') => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export default function OfficerDashboard() {
  const { user } = useAuth();
  const { confirm, prompt } = useDialog();
  const dept = user.department;
  const DeptIcon = deptIcon(dept?.code);

  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [dueFilter, setDueFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [dueForm, setDueForm] = useState({ regNo: '', amount: '', description: '' });
  const [working, setWorking] = useState('');

  const load = async () => {
    try {
      const [r, d] = await Promise.all([api.get('/clearances/department'), api.get('/dues/department')]);
      setRequests(r.data);
      setDues(d.data);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const c = { '': requests.length, pending: 0, dues: 0, cleared: 0 };
    requests.forEach((r) => { if (r.item) c[r.item.status] += 1; });
    return c;
  }, [requests]);

  const toVerify = dues.filter((d) => d.status === 'receipt-submitted').length;
  const owedTotal = dues.filter((d) => OPEN.includes(d.status)).reduce((s, d) => s + d.amount, 0);
  const q = search.toLowerCase();
  const matches = (s) => !q || s?.name?.toLowerCase().includes(q) || s?.regNo?.toLowerCase().includes(q);

  const shownRequests = requests.filter((r) => (!filter || r.item?.status === filter) && matches(r.student));
  const shownDues = dues.filter((d) => (!dueFilter || d.status === dueFilter) && matches(d.student));
  const selected = requests.find((r) => r._id === selectedId);

  /* ---------- actions ---------- */
  const act = async (r, action) => {
    const remark = await prompt({
      title: action === 'clear' ? `Clear ${r.student.name}?` : `Flag ${r.student.name}?`,
      message: action === 'clear' ? 'Add an optional remark the student will see.' : 'Tell the student what is outstanding.',
      defaultValue: action === 'clear' ? 'All items returned' : '',
      placeholder: action === 'clear' ? 'Remark' : 'e.g. Lab coat not returned',
      confirmText: action === 'clear' ? 'Clear student' : 'Flag dues',
      required: action === 'flag',
    });
    if (remark === null) return;
    setWorking(`${action}-${r._id}`);
    try {
      await api.patch(`/clearances/${r._id}/items/${dept._id}`, { action, remark });
      toast.success(`${r.student.name} ${action === 'clear' ? 'cleared' : 'flagged'}`);
      await load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setWorking('');
    }
  };

  const addDue = async (e, regNoOverride) => {
    e.preventDefault();
    const body = { ...dueForm, regNo: regNoOverride || dueForm.regNo };
    setWorking('add-due');
    try {
      await api.post('/dues', body);
      toast.success(`Due added for ${body.regNo.toUpperCase()}`);
      setDueForm({ regNo: '', amount: '', description: '' });
      await load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setWorking('');
    }
  };

  const verify = async (d, body, label) => {
    let note = '';
    if (body.approve === false && !body.waive) {
      note = await prompt({ title: 'Reject this receipt?', message: 'The student will be asked to upload it again.', defaultValue: 'Receipt unclear, please re-upload', confirmText: 'Reject receipt' });
      if (note === null) return;
    }
    if (body.waive) {
      const ok = await confirm({ title: 'Waive this due?', message: `${lkr(d.amount)} – ${d.description}`, confirmText: 'Waive' });
      if (!ok) return;
    }
    setWorking(`due-${d._id}`);
    try {
      await api.patch(`/dues/${d._id}/verify`, { ...body, note });
      toast.success(`Due ${label}`);
      await load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setWorking('');
    }
  };

  const removeDue = async (d) => {
    const ok = await confirm({ title: 'Delete this due?', message: d.description, confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/dues/${d._id}`);
      toast.success('Due deleted');
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  if (loading) return <PageSkeleton />;

  const filters = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'dues', label: 'Dues found' },
    { value: 'cleared', label: 'Cleared' },
  ];

  const dueActions = (d) => (
    <div className="actions">
      {d.status === 'receipt-submitted' && (
        <>
          <button className="btn btn-success btn-sm" disabled={!!working} onClick={() => verify(d, { approve: true }, 'marked as paid')}>Approve</button>
          <button className="btn btn-danger btn-sm" disabled={!!working} onClick={() => verify(d, { approve: false }, 'receipt rejected')}>Reject</button>
        </>
      )}
      {d.status === 'unpaid' && (
        <>
          <button className="btn btn-ghost btn-sm" disabled={!!working} onClick={() => verify(d, { approve: true }, 'marked as paid')}>Paid at counter</button>
          <button className="btn btn-ghost btn-sm" disabled={!!working} onClick={() => verify(d, { waive: true }, 'waived')}>Waive</button>
        </>
      )}
      {OPEN.includes(d.status) && (
        <button className="btn btn-ghost btn-sm" onClick={() => removeDue(d)} aria-label="Delete due"><Trash2 size={14} /></button>
      )}
    </div>
  );

  return (
    <div className="dashboard">
      <div className="page-head">
        <div className="row-gap" style={{ gap: 14 }}>
          <span className="head-icon"><DeptIcon size={24} /></span>
          <div>
            <span className="eyebrow">Department desk</span>
            <h1>{dept?.name || 'Department'}</h1>
            <p className="muted">Signed in as {user.name}</p>
          </div>
        </div>
      </div>

      <motion.div className="stats" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={item}><StatCard icon={Clock} tone="brand" label="Awaiting review" value={counts.pending} /></motion.div>
        <motion.div variants={item}><StatCard icon={TriangleAlert} tone="warn" label="Flagged with dues" value={counts.dues} /></motion.div>
        <motion.div variants={item}><StatCard icon={CircleCheck} tone="good" label="Cleared" value={counts.cleared} /></motion.div>
        <motion.div variants={item}><StatCard icon={Wallet} tone="brand" label="Outstanding dues" value={owedTotal} format={lkr} sub={`${toVerify} receipt(s) to verify`} /></motion.div>
      </motion.div>

      <Tabs
        id="officer"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'requests', label: 'Clearance requests', icon: ClipboardList },
          { value: 'dues', label: 'Dues & receipts', icon: Receipt, count: toVerify },
        ]}
      />

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} />
          <input className="input" placeholder="Search name or reg no." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {tab === 'requests' ? (
          <div className="filter-chips">
            {filters.map((f) => (
              <button key={f.value} className={`filter-chip ${filter === f.value ? 'active' : ''}`} onClick={() => setFilter(f.value)}>
                {filter === f.value && <motion.span layoutId="officer-filter" className="tab-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <span>{f.label}</span>
                <span className="count">{counts[f.value]}</span>
              </button>
            ))}
          </div>
        ) : (
          <select className="input" style={{ width: 'auto' }} value={dueFilter} onChange={(e) => setDueFilter(e.target.value)}>
            <option value="">All dues</option>
            <option value="unpaid">Unpaid</option>
            <option value="receipt-submitted">Receipt submitted</option>
            <option value="paid">Paid</option>
            <option value="waived">Waived</option>
          </select>
        )}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'requests' ? (
          <motion.section key="req" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            {shownRequests.length === 0 ? (
              <div className="card"><Empty icon={ClipboardList} title="Nothing here">No requests match this view.</Empty></div>
            ) : (
              <motion.div className="row-list" variants={stagger} initial="hidden" animate="show">
                {shownRequests.map((r) => {
                  const open = r.dues.filter((d) => OPEN.includes(d.status));
                  return (
                    <motion.div key={r._id} variants={item} layout whileHover={{ y: -2 }} className="row-card" onClick={() => setSelectedId(r._id)}>
                      <div className="person">
                        <span className="avatar">{initials(r.student?.name)}</span>
                        <div>
                          <strong>{r.student?.name}</strong>
                          <small>{r.student?.regNo} · {r.student?.faculty}</small>
                        </div>
                      </div>
                      <div className="hide-sm">
                        <div className="meta">Reason</div>
                        <strong>{cap(r.reason)}</strong>
                      </div>
                      <div className="hide-sm">
                        <div className="meta">Open dues</div>
                        {open.length ? <span className="warn-text">{lkr(open.reduce((s, d) => s + d.amount, 0))}</span> : <span className="muted">None</span>}
                      </div>
                      <Badge status={r.item?.status} />
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </motion.section>
        ) : (
          <motion.div key="dues" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            <section className="card">
              <h2>Add a due</h2>
              <p className="muted small" style={{ marginBottom: 12 }}>The student's request is automatically flagged until it is settled.</p>
              <form className="grid-4" onSubmit={addDue}>
                <label className="label">Student reg no.<input className="input" required value={dueForm.regNo} onChange={(e) => setDueForm({ ...dueForm, regNo: e.target.value })} placeholder="EG/2021/4501" /></label>
                <label className="label">Amount (LKR)<input className="input" required type="number" min="0" step="0.01" value={dueForm.amount} onChange={(e) => setDueForm({ ...dueForm, amount: e.target.value })} /></label>
                <label className="label">Description<input className="input" required value={dueForm.description} onChange={(e) => setDueForm({ ...dueForm, description: e.target.value })} placeholder="e.g. Lost lab multimeter" /></label>
                <button className="btn btn-primary" disabled={working === 'add-due'}>{working === 'add-due' ? <Spin /> : <Plus size={16} />} Add due</button>
              </form>
            </section>

            <section className="card">
              {shownDues.length === 0 ? (
                <Empty icon={Receipt} title="No dues">Nothing matches this filter.</Empty>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Student</th><th>Description</th><th>Amount</th><th>Status</th><th>Receipt</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {shownDues.map((d) => (
                        <tr key={d._id}>
                          <td>
                            <div className="person">
                              <span className="avatar">{initials(d.student?.name)}</span>
                              <div><strong>{d.student?.name}</strong><small>{d.student?.regNo}</small></div>
                            </div>
                          </td>
                          <td>{d.description}<div className="muted small">Added {fmtDate(d.createdAt)}</div></td>
                          <td><strong>{lkr(d.amount)}</strong></td>
                          <td><Badge status={d.status} /></td>
                          <td>{d.receiptUrl ? <a className="btn btn-soft btn-sm" href={fileUrl(d.receiptUrl)} target="_blank" rel="noreferrer"><FileText size={13} /> View</a> : <span className="muted">—</span>}</td>
                          <td>{dueActions(d)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Student detail drawer */}
      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.student?.name}
        subtitle={selected && `${selected.student?.regNo} · ${selected.student?.faculty}`}
      >
        {selected && (
          <>
            <div>
              <div className="section-title">Request</div>
              <dl className="kv">
                <dt>Reason</dt><dd>{cap(selected.reason)}</dd>
                <dt>Submitted</dt><dd>{fmtDate(selected.createdAt)}</dd>
                <dt>Email</dt><dd>{selected.student?.email}</dd>
                <dt>{dept?.name}</dt><dd><Badge status={selected.item?.status} /></dd>
                {selected.item?.remark && (<><dt>Remark</dt><dd>{selected.item.remark}</dd></>)}
                {selected.note && (<><dt>Student note</dt><dd>{selected.note}</dd></>)}
              </dl>
            </div>

            <div>
              <div className="section-title">Dues in {dept?.name}</div>
              {selected.dues.length === 0 ? (
                <p className="muted small">No dues recorded for this student.</p>
              ) : (
                <div className="due-list">
                  {selected.dues.map((d) => (
                    <div className="due-card" key={d._id}>
                      <div className="due-top">
                        <div><strong>{d.description}</strong><div className="muted small">Added {fmtDate(d.createdAt)}</div></div>
                        <div style={{ textAlign: 'right' }}><div className="due-amount">{lkr(d.amount)}</div><Badge status={d.status} /></div>
                      </div>
                      {d.receiptUrl && (
                        isImage(d.receiptUrl) ? (
                          <a className="receipt-preview" href={fileUrl(d.receiptUrl)} target="_blank" rel="noreferrer"><img src={fileUrl(d.receiptUrl)} alt="Payment receipt" /></a>
                        ) : (
                          <a className="btn btn-soft btn-sm" style={{ alignSelf: 'flex-start' }} href={fileUrl(d.receiptUrl)} target="_blank" rel="noreferrer"><FileText size={14} /> Open PDF receipt</a>
                        )
                      )}
                      {dueActions(d)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selected.overallStatus !== 'completed' && (
              <form onSubmit={(e) => addDue(e, selected.student?.regNo)}>
                <div className="section-title">Add a due for this student</div>
                <div className="grid-2">
                  <input className="input" required type="number" min="0" step="0.01" placeholder="Amount (LKR)" value={dueForm.amount} onChange={(e) => setDueForm({ ...dueForm, amount: e.target.value })} />
                  <input className="input" required placeholder="Description" value={dueForm.description} onChange={(e) => setDueForm({ ...dueForm, description: e.target.value })} />
                </div>
                <button className="btn btn-soft btn-sm" style={{ marginTop: 10 }} disabled={working === 'add-due'}><Plus size={14} /> Add due</button>
              </form>
            )}
          </>
        )}
        {selected && selected.overallStatus !== 'completed' && (
          <div className="drawer-actions" style={{ margin: 'auto -22px -20px', position: 'sticky', bottom: -20, background: 'var(--surface)' }}>
            {selected.item?.status !== 'dues' && (
              <button className="btn btn-danger" disabled={!!working} onClick={() => act(selected, 'flag')}><TriangleAlert size={16} /> Flag dues</button>
            )}
            {selected.item?.status !== 'cleared' && (
              <button className="btn btn-success" disabled={!!working} onClick={() => act(selected, 'clear')}>
                {working === `clear-${selected._id}` ? <Spin /> : <CircleCheck size={16} />} Clear student
              </button>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
