import { useEffect, useMemo, useState } from 'react';
import api, { errMsg, fileUrl } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Alert, Badge, cap, Empty, fmtDate, lkr, Spinner } from '../../components/ui';

const OPEN = ['unpaid', 'receipt-submitted'];

export default function OfficerDashboard() {
  const { user } = useAuth();
  const dept = user.department;
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [dueFilter, setDueFilter] = useState('');
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [dueForm, setDueForm] = useState({ regNo: '', amount: '', description: '' });

  const flash = (type, text) => setMsg({ type, text });

  const load = async () => {
    try {
      const [r, d] = await Promise.all([api.get('/clearances/department'), api.get('/dues/department')]);
      setRequests(r.data);
      setDues(d.data);
    } catch (err) {
      flash('error', errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const c = { pending: 0, dues: 0, cleared: 0 };
    requests.forEach((r) => { if (r.item) c[r.item.status] += 1; });
    return c;
  }, [requests]);

  const toVerify = dues.filter((d) => d.status === 'receipt-submitted').length;

  const shownRequests = requests.filter((r) => {
    if (filter && r.item?.status !== filter) return false;
    const q = search.toLowerCase();
    return !q || r.student?.name.toLowerCase().includes(q) || r.student?.regNo?.toLowerCase().includes(q);
  });

  const shownDues = dues.filter((d) => {
    if (dueFilter && d.status !== dueFilter) return false;
    const q = search.toLowerCase();
    return !q || d.student?.name.toLowerCase().includes(q) || d.student?.regNo?.toLowerCase().includes(q);
  });

  const act = async (r, action) => {
    const remark = window.prompt(
      action === 'clear' ? 'Remark (optional):' : 'Why are you flagging this student? (e.g. book not returned)',
      action === 'clear' ? 'All items returned' : ''
    );
    if (remark === null) return;
    try {
      await api.patch(`/clearances/${r._id}/items/${dept._id}`, { action, remark });
      flash('success', `${r.student.name} ${action === 'clear' ? 'cleared' : 'flagged'}`);
      load();
    } catch (err) {
      flash('error', errMsg(err));
    }
  };

  const addDue = async (e) => {
    e.preventDefault();
    try {
      await api.post('/dues', dueForm);
      flash('success', `Due added for ${dueForm.regNo.toUpperCase()}`);
      setDueForm({ regNo: '', amount: '', description: '' });
      load();
    } catch (err) {
      flash('error', errMsg(err));
    }
  };

  const verify = async (d, body, label) => {
    let note = '';
    if (body.approve === false) {
      note = window.prompt('Reason for rejecting this receipt:', 'Receipt unclear, please re-upload');
      if (note === null) return;
    }
    try {
      await api.patch(`/dues/${d._id}/verify`, { ...body, note });
      flash('success', `Due ${label}`);
      load();
    } catch (err) {
      flash('error', errMsg(err));
    }
  };

  const removeDue = async (d) => {
    if (!window.confirm(`Delete the due "${d.description}"?`)) return;
    try {
      await api.delete(`/dues/${d._id}`);
      flash('success', 'Due deleted');
      load();
    } catch (err) {
      flash('error', errMsg(err));
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h1>{dept?.name || 'Department'} desk</h1>
          <p className="muted">Signed in as {user.name}</p>
        </div>
      </div>

      <Alert type={msg.type} onClose={() => setMsg({ type: '', text: '' })}>{msg.text}</Alert>

      <div className="stats">
        <div className="stat"><span>Awaiting review</span><strong>{counts.pending}</strong></div>
        <div className="stat stat-warn"><span>Flagged with dues</span><strong>{counts.dues}</strong></div>
        <div className="stat stat-good"><span>Cleared</span><strong>{counts.cleared}</strong></div>
        <div className="stat"><span>Receipts to verify</span><strong>{toVerify}</strong></div>
      </div>

      <div className="tabs">
        <button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>Clearance requests</button>
        <button className={tab === 'dues' ? 'active' : ''} onClick={() => setTab('dues')}>
          Dues {toVerify > 0 && <span className="pill">{toVerify}</span>}
        </button>
      </div>

      <div className="toolbar">
        <input className="search" placeholder="Search name or reg no." value={search} onChange={(e) => setSearch(e.target.value)} />
        {tab === 'requests' ? (
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All requests</option>
            <option value="pending">Pending</option>
            <option value="dues">Dues found</option>
            <option value="cleared">Cleared</option>
          </select>
        ) : (
          <select value={dueFilter} onChange={(e) => setDueFilter(e.target.value)}>
            <option value="">All dues</option>
            <option value="unpaid">Unpaid</option>
            <option value="receipt-submitted">Receipt submitted</option>
            <option value="paid">Paid</option>
            <option value="waived">Waived</option>
          </select>
        )}
      </div>

      {tab === 'requests' && (
        <section className="card">
          {shownRequests.length === 0 ? (
            <Empty>No requests in this view.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Student</th><th>Reason</th><th>Submitted</th><th>Open dues</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {shownRequests.map((r) => {
                    const open = r.dues.filter((d) => OPEN.includes(d.status));
                    return (
                      <tr key={r._id}>
                        <td><strong>{r.student?.name}</strong><div className="muted small">{r.student?.regNo} · {r.student?.faculty}</div></td>
                        <td>{cap(r.reason)}</td>
                        <td>{fmtDate(r.createdAt)}</td>
                        <td>{open.length ? <span className="warn-text">{open.length} · {lkr(open.reduce((s, d) => s + d.amount, 0))}</span> : 'None'}</td>
                        <td><Badge status={r.item?.status} />{r.item?.remark && <div className="note">{r.item.remark}</div>}</td>
                        <td className="actions">
                          {r.item?.status !== 'cleared' && (
                            <button className="btn btn-success btn-sm" title={open.length ? 'Student must settle dues first' : ''} onClick={() => act(r, 'clear')}>Clear</button>
                          )}
                          {r.item?.status !== 'dues' && r.overallStatus !== 'completed' && (
                            <button className="btn btn-danger btn-sm" onClick={() => act(r, 'flag')}>Flag dues</button>
                          )}
                          <button className="btn btn-ghost btn-sm" onClick={() => { setDueForm({ ...dueForm, regNo: r.student?.regNo || '' }); setTab('dues'); }}>Add due</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'dues' && (
        <>
          <section className="card">
            <h2>Add a due</h2>
            <form className="grid-4" onSubmit={addDue}>
              <label>Student reg no.<input required value={dueForm.regNo} onChange={(e) => setDueForm({ ...dueForm, regNo: e.target.value })} placeholder="EG/2021/4501" /></label>
              <label>Amount (LKR)<input required type="number" min="0" step="0.01" value={dueForm.amount} onChange={(e) => setDueForm({ ...dueForm, amount: e.target.value })} /></label>
              <label className="span-2">Description<input required value={dueForm.description} onChange={(e) => setDueForm({ ...dueForm, description: e.target.value })} placeholder="e.g. Lost lab multimeter" /></label>
              <div><button className="btn btn-primary">Add due</button></div>
            </form>
          </section>

          <section className="card">
            {shownDues.length === 0 ? (
              <Empty>No dues in this view.</Empty>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Student</th><th>Description</th><th>Amount</th><th>Status</th><th>Receipt</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {shownDues.map((d) => (
                      <tr key={d._id}>
                        <td><strong>{d.student?.name}</strong><div className="muted small">{d.student?.regNo}</div></td>
                        <td>{d.description}<div className="muted small">Added {fmtDate(d.createdAt)}</div></td>
                        <td>{lkr(d.amount)}</td>
                        <td><Badge status={d.status} /></td>
                        <td>{d.receiptUrl ? <a href={fileUrl(d.receiptUrl)} target="_blank" rel="noreferrer">View</a> : '-'}</td>
                        <td className="actions">
                          {d.status === 'receipt-submitted' && (
                            <>
                              <button className="btn btn-success btn-sm" onClick={() => verify(d, { approve: true }, 'marked as paid')}>Approve</button>
                              <button className="btn btn-danger btn-sm" onClick={() => verify(d, { approve: false }, 'receipt rejected')}>Reject</button>
                            </>
                          )}
                          {d.status === 'unpaid' && (
                            <>
                              <button className="btn btn-ghost btn-sm" onClick={() => verify(d, { approve: true }, 'marked as paid')}>Paid at counter</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => verify(d, { waive: true }, 'waived')}>Waive</button>
                            </>
                          )}
                          {OPEN.includes(d.status) && <button className="btn btn-ghost btn-sm" onClick={() => removeDue(d)}>Delete</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
