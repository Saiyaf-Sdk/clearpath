import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CircleCheck, Download, FileText, PencilLine, Plus, Trash2, UserRoundCheck, UserRoundX, Wallet } from 'lucide-react';
import api, { errMsg, fileUrl } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { useShell } from '../../components/app/ShellContext';
import useFetch from '../../hooks/useFetch';
import useSort from '../../hooks/useSort';
import {
  Badge, downloadCsv, Drawer, Empty, ErrorState, fmtDate, lkr, PageHeader, PageSkeleton, Person, SearchInput, Spin,
} from '../../components/ui';

const OPEN = ['unpaid', 'receipt-submitted'];
const STATUSES = [
  { value: '', label: 'All dues' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'receipt-submitted', label: 'Receipt submitted' },
  { value: 'paid', label: 'Paid' },
  { value: 'waived', label: 'Waived' },
];

// Shows who a registration number belongs to while the officer types it
function StudentCheck({ regNo }) {
  const [state, setState] = useState(null);
  useEffect(() => {
    const value = regNo.trim();
    if (value.length < 6) {
      setState(null);
      return undefined;
    }
    let live = true;
    const t = setTimeout(() => {
      api.get('/dues/lookup', { params: { regNo: value } })
        .then((r) => live && setState({ ok: true, s: r.data }))
        .catch((e) => live && setState({ ok: false, msg: errMsg(e) }));
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [regNo]);
  if (!state) return <small className="field-hint">Type the student's registration number</small>;
  if (!state.ok) return <small className="field-hint bad"><UserRoundX size={13} /> {state.msg}</small>;
  return (
    <small className="field-hint good">
      <UserRoundCheck size={13} /> {state.s.name} · {state.s.faculty}
      {state.s.openDues > 0 && <> · already owes {state.s.openDues} due(s) here</>}
    </small>
  );
}

export default function OfficerDues() {
  const { user } = useAuth();
  const { confirm } = useDialog();
  const { refresh: refreshBadges } = useShell();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const q = (params.get('q') || '').toLowerCase();
  const { data, error, reload, refresh } = useFetch('/dues/department');
  const [form, setForm] = useState({ regNo: '', amount: '', description: '' });
  const [working, setWorking] = useState('');
  const [edit, setEdit] = useState(null); // due being corrected

  const filtered = (data || []).filter((d) => (!status || d.status === status) && (!q || d.student?.name?.toLowerCase().includes(q) || d.student?.regNo?.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)));
  const { sorted: shown, th } = useSort(filtered, { key: '', dir: 'asc' }, {
    student: (d) => d.student?.name,
    added: (d) => d.createdAt,
  });

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;

  const sum = (sts) => data.filter((d) => sts.includes(d.status)).reduce((s, d) => s + d.amount, 0);

  const after = async () => {
    await refresh();
    refreshBadges();
  };

  const add = async (e) => {
    e.preventDefault();
    setWorking('add');
    try {
      await api.post('/dues', form);
      toast.success(`Due added for ${form.regNo.toUpperCase()}`);
      setForm({ regNo: '', amount: '', description: '' });
      await after();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setWorking('');
    }
  };

  const settle = async (d, body, label) => {
    if (body.waive) {
      const ok = await confirm({ title: 'Waive this due?', message: `${lkr(d.amount)} – ${d.description}`, confirmText: 'Waive' });
      if (!ok) return;
    }
    setWorking(d._id);
    try {
      const { data: res } = await api.patch(`/dues/${d._id}/verify`, body);
      toast.success(res.reopened ? `Due ${label}. The student can now be cleared.` : `Due ${label}`);
      await after();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setWorking('');
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setWorking('edit');
    try {
      await api.patch(`/dues/${edit._id}`, { amount: edit.amount, description: edit.description });
      toast.success('Due updated – the student has been told');
      setEdit(null);
      await after();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setWorking('');
    }
  };

  const remove = async (d) => {
    const ok = await confirm({ title: 'Delete this due?', message: `${d.description} – only for dues added by mistake.`, confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/dues/${d._id}`);
      toast.success('Due deleted');
      await after();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const exportCsv = () =>
    downloadCsv(`${user.department?.code || 'dept'}-dues.csv`, [
      ['Student', 'Reg. no.', 'Description', 'Amount (LKR)', 'Status', 'Added', 'Settled', 'Added by', 'Verified by'],
      ...shown.map((d) => [d.student?.name, d.student?.regNo, d.description, d.amount, d.status, fmtDate(d.createdAt), d.paidAt ? fmtDate(d.paidAt) : '', d.addedBy?.name || '', d.verifiedBy?.name || '']),
    ]);

  return (
    <div className="page">
      <PageHeader
        title="Dues register"
        subtitle={`Every due recorded by ${user.department?.name}. Adding a due automatically flags the student's request.`}
        actions={<button className="btn btn-ghost" onClick={exportCsv}><Download size={16} /> Export CSV</button>}
      />

      <div className="summary-strip">
        <div><small>Outstanding</small><strong className="warn-text">{lkr(sum(OPEN))}</strong></div>
        <div><small>Collected</small><strong className="good-text">{lkr(sum(['paid']))}</strong></div>
        <div><small>Waived</small><strong>{lkr(sum(['waived']))}</strong></div>
        <div><small>Records</small><strong>{data.length}</strong></div>
      </div>

      <section className="card">
        <h2><Plus size={17} className="text-brand" style={{ verticalAlign: -3, marginRight: 6 }} />Add a due</h2>
        <form className="due-form" onSubmit={add}>
          <label className="label">
            Student reg. no.
            <input className="input" required value={form.regNo} onChange={(e) => setForm({ ...form, regNo: e.target.value })} placeholder="EG/2021/4501" />
            <StudentCheck regNo={form.regNo} />
          </label>
          <label className="label">Amount (LKR)<input className="input" required type="number" min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="450.00" /></label>
          <label className="label grow">Description<input className="input" required maxLength={200} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Overdue book: Engineering Mathematics" /></label>
          <button className="btn btn-primary" disabled={working === 'add'}>{working === 'add' ? <Spin /> : <Plus size={16} />} Add due</button>
        </form>
      </section>

      <section className="card">
        <div className="toolbar">
          <SearchInput value={params.get('q') || ''} onChange={(v) => setParam('q', v)} placeholder="Search student or description" />
          <select className="input select-sm" value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Status">
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <span className="muted small push-right">{shown.length} shown</span>
        </div>
        {shown.length === 0 ? (
          <Empty icon={Wallet} title="No dues">Nothing matches this view.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>{th('student', 'Student')}{th('description', 'Description')}{th('amount', 'Amount')}{th('status', 'Status')}{th('added', 'Added', { className: 'hide-sm' })}<th className="hide-sm">Receipt</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {shown.map((d) => (
                  <tr key={d._id}>
                    <td><Person name={d.student?.name} photo={d.student?.avatarUrl} sub={d.student?.regNo} /></td>
                    <td>{d.description}{d.addedBy?.name && <div className="muted small">by {d.addedBy.name}</div>}</td>
                    <td><strong>{lkr(d.amount)}</strong></td>
                    <td><Badge status={d.status} />{d.paidAt && <div className="muted small">{fmtDate(d.paidAt)}</div>}</td>
                    <td className="hide-sm small">{fmtDate(d.createdAt)}</td>
                    <td className="hide-sm">{d.receiptUrl ? <a className="btn btn-soft btn-sm" href={fileUrl(d.receiptUrl)} target="_blank" rel="noreferrer"><FileText size={13} /> View</a> : <span className="muted">—</span>}</td>
                    <td>
                      <div className="actions end">
                        {d.status === 'receipt-submitted' && (
                          <button className="btn btn-success btn-sm" disabled={!!working} onClick={() => settle(d, { approve: true }, 'marked as paid')}><CircleCheck size={14} /> Approve</button>
                        )}
                        {d.status === 'unpaid' && (
                          <>
                            <button className="btn btn-ghost btn-sm" disabled={!!working} onClick={() => settle(d, { approve: true }, 'marked as paid')}>Paid at counter</button>
                            <button className="btn btn-ghost btn-sm" disabled={!!working} onClick={() => settle(d, { waive: true }, 'waived')}>Waive</button>
                          </>
                        )}
                        {OPEN.includes(d.status) && (
                          <>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ _id: d._id, amount: d.amount, description: d.description, student: d.student, status: d.status })} aria-label="Edit due" title="Edit amount or description"><PencilLine size={14} /></button>
                            <button className="btn btn-ghost btn-sm" onClick={() => remove(d)} aria-label="Delete due" title="Delete (added by mistake)"><Trash2 size={14} /></button>
                          </>
                        )}
                        {!OPEN.includes(d.status) && <span className="muted small">{d.verifiedBy?.name ? `by ${d.verifiedBy.name}` : 'Settled'}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Drawer open={!!edit} onClose={() => setEdit(null)} title="Edit due" subtitle={edit && `${edit.student?.name} · ${edit.student?.regNo}`}>
        {edit && (
          <form className="form-stack" onSubmit={saveEdit}>
            {edit.status === 'receipt-submitted' && <p className="policy-note small">The student has already uploaded a receipt for this due. If you change the amount, check the receipt again before approving it.</p>}
            <label className="label">Amount (LKR)<input className="input" type="number" min="1" step="0.01" required value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></label>
            <label className="label">Description<input className="input" required maxLength={200} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
            <small className="field-hint">The student is notified of the change. Settled dues can't be edited.</small>
            <div className="row-gap">
              <button className="btn btn-primary" disabled={working === 'edit'}>{working === 'edit' ? <Spin /> : <PencilLine size={16} />} Save changes</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
}
