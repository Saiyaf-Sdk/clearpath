import { useEffect, useState } from 'react';
import api, { errMsg, fileUrl } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Alert, Badge, cap, Empty, fmtDate, lkr, Spinner } from '../../components/ui';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [form, setForm] = useState({ reason: 'graduation', note: '' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [r, d] = await Promise.all([api.get('/clearances/my'), api.get('/dues/my')]);
      setRequests(r.data);
      setDues(d.data);
    } catch (err) {
      setMsg({ type: 'error', text: errMsg(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const flash = (type, text) => setMsg({ type, text });

  const submitRequest = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/clearances', form);
      flash('success', 'Clearance request submitted. Departments will now review it.');
      await load();
    } catch (err) {
      flash('error', errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id) => {
    if (!window.confirm('Cancel this clearance request?')) return;
    try {
      await api.patch(`/clearances/${id}/cancel`);
      flash('success', 'Request cancelled');
      load();
    } catch (err) {
      flash('error', errMsg(err));
    }
  };

  const uploadReceipt = async (dueId, file) => {
    if (!file) return;
    const data = new FormData();
    data.append('receipt', file);
    try {
      await api.post(`/dues/${dueId}/receipt`, data);
      flash('success', 'Receipt uploaded. The department will verify it.');
      load();
    } catch (err) {
      flash('error', errMsg(err));
    }
  };

  const downloadCert = async (requestId, certNo) => {
    try {
      const res = await api.get(`/certificates/${requestId}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `ClearPath-${certNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      flash('error', 'Could not download the certificate');
    }
  };

  if (loading) return <Spinner />;

  const active = requests.find((r) => ['pending', 'in-progress', 'completed'].includes(r.status));
  const current = requests.find((r) => ['pending', 'in-progress'].includes(r.status));
  const history = requests.filter((r) => r !== active);
  const outstanding = dues.filter((d) => ['unpaid', 'receipt-submitted'].includes(d.status));
  const owed = outstanding.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h1>Hello, {user.name.split(' ')[0]}</h1>
          <p className="muted">{user.regNo} · Faculty of {user.faculty}</p>
        </div>
      </div>

      <Alert type={msg.type} onClose={() => setMsg({ type: '', text: '' })}>{msg.text}</Alert>

      <div className="stats">
        <div className="stat"><span>Request status</span><strong>{active ? cap(active.status.replace('-', ' ')) : 'Not started'}</strong></div>
        <div className="stat"><span>Departments cleared</span><strong>{active ? `${active.items.filter((i) => i.status === 'cleared').length} / ${active.items.length}` : '-'}</strong></div>
        <div className={`stat ${owed > 0 ? 'stat-warn' : ''}`}><span>Outstanding dues</span><strong>{lkr(owed)}</strong></div>
      </div>

      {!active && (
        <section className="card">
          <h2>Start a clearance request</h2>
          <p className="muted">Your request goes to every department at once. You can track each one below.</p>
          <form onSubmit={submitRequest} className="grid-2">
            <label>
              Reason
              <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                <option value="graduation">Graduation</option>
                <option value="transfer">Transfer to another university</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Note (optional)
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Needed for transcript" />
            </label>
            <div><button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit request'}</button></div>
          </form>
        </section>
      )}

      {active && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Clearance tracker</h2>
              <p className="muted">
                {cap(active.reason)} · submitted {fmtDate(active.createdAt)}
              </p>
            </div>
            <Badge status={active.status} />
          </div>

          <Progress items={active.items} />

          <div className="dept-grid">
            {active.items.map((it) => (
              <div className={`dept-card dept-${it.status}`} key={it.department?._id}>
                <div className="dept-top">
                  <strong>{it.department?.name}</strong>
                  <Badge status={it.status} />
                </div>
                {it.remark && <p className="dept-remark">{it.remark}</p>}
                {it.actionedAt && <small className="muted">Updated {fmtDate(it.actionedAt)}</small>}
              </div>
            ))}
          </div>

          {active.status === 'completed' && active.certificate && (
            <div className="cert-box">
              <div>
                <h3>🎓 You are fully cleared</h3>
                <p>Certificate No: <strong>{active.certificate.certificateNo}</strong> · issued {fmtDate(active.certificate.issuedAt)}</p>
              </div>
              <div className="row-gap">
                <button className="btn btn-primary" onClick={() => downloadCert(active._id, active.certificate.certificateNo)}>Download PDF</button>
                <a className="btn btn-ghost" href={`/verify/${active.certificate.certificateNo}`} target="_blank" rel="noreferrer">Verify page</a>
              </div>
            </div>
          )}

          {current && current.items.every((i) => i.status === 'pending') && (
            <button className="btn btn-ghost btn-sm" onClick={() => cancel(current._id)}>Cancel request</button>
          )}
        </section>
      )}

      <section className="card">
        <h2>My dues</h2>
        {dues.length === 0 ? (
          <Empty>No dues recorded against you. 🎉</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Department</th><th>Description</th><th>Amount</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {dues.map((d) => (
                  <tr key={d._id}>
                    <td>{d.department?.name}</td>
                    <td>
                      {d.description}
                      {d.officerNote && <div className="note">Officer: {d.officerNote}</div>}
                    </td>
                    <td>{lkr(d.amount)}</td>
                    <td><Badge status={d.status} /></td>
                    <td>
                      {['unpaid', 'receipt-submitted'].includes(d.status) && (
                        <label className="btn btn-ghost btn-sm file-btn">
                          {d.status === 'unpaid' ? 'Upload receipt' : 'Replace receipt'}
                          <input type="file" accept=".jpg,.jpeg,.png,.pdf" hidden onChange={(e) => uploadReceipt(d._id, e.target.files[0])} />
                        </label>
                      )}
                      {d.receiptUrl && (
                        <a className="link-sm" href={fileUrl(d.receiptUrl)} target="_blank" rel="noreferrer">View receipt</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className="card">
          <h2>Previous requests</h2>
          <ul className="simple-list">
            {history.map((r) => (
              <li key={r._id}>
                {cap(r.reason)} · {fmtDate(r.createdAt)} <Badge status={r.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Progress({ items }) {
  const done = items.filter((i) => i.status === 'cleared').length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  return (
    <div className="progress-wrap">
      <div className="progress"><div className="progress-bar" style={{ width: `${pct}%` }} /></div>
      <span className="progress-label">{pct}% cleared</span>
    </div>
  );
}
