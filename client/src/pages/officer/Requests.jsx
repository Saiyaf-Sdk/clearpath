import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CircleCheck, ClipboardList, Download, FileText, Plus, TriangleAlert } from 'lucide-react';
import api, { errMsg, fileUrl } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { useShell } from '../../components/app/ShellContext';
import useFetch from '../../hooks/useFetch';
import {
  Badge, cap, daysSince, downloadCsv, Drawer, Empty, ErrorState, fmtDate, fmtDateTime, lkr, MiniProgress, PageHeader, PageSkeleton, Person, SearchInput, Spin,
} from '../../components/ui';

const OPEN = ['unpaid', 'receipt-submitted'];
const isImage = (url = '', name = '') => /\.(png|jpe?g)$/i.test(name || url);
const FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'dues', label: 'Dues found' },
  { value: 'cleared', label: 'Cleared' },
];

export default function OfficerRequests() {
  const { user } = useAuth();
  const { confirm, prompt } = useDialog();
  const { refresh: refreshBadges } = useShell();
  const dept = user.department;
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const q = (params.get('q') || '').toLowerCase();
  const sort = params.get('sort') || 'newest';
  const openId = params.get('open');
  const { data, error, reload, refresh } = useFetch('/clearances/department');
  const [working, setWorking] = useState('');
  const [selected, setSelected] = useState([]);
  const [dueForm, setDueForm] = useState({ amount: '', description: '' });

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const rows = data || [];
  const counts = useMemo(() => {
    const c = { '': rows.length, pending: 0, dues: 0, cleared: 0 };
    rows.forEach((r) => { if (r.item) c[r.item.status] += 1; });
    return c;
  }, [rows]);

  const shown = rows
    .filter((r) => (!status || r.item?.status === status) && (!q || r.student?.name?.toLowerCase().includes(q) || r.student?.regNo?.toLowerCase().includes(q)))
    .sort((a, b) => (sort === 'oldest' ? 1 : -1) * (new Date(a.createdAt) - new Date(b.createdAt)));

  const openDues = (r) => r.dues.filter((d) => OPEN.includes(d.status));
  const clearable = (r) => r.item?.status !== 'cleared' && r.overallStatus !== 'completed' && openDues(r).length === 0;
  const current = rows.find((r) => r._id === openId);

  const after = async () => {
    await refresh();
    refreshBadges();
  };

  /* ---------- actions ---------- */
  const act = async (r, action) => {
    const remark = await prompt({
      title: action === 'clear' ? `Clear ${r.student.name}?` : `Flag ${r.student.name}?`,
      message: action === 'clear' ? 'Add an optional remark the student will see.' : 'Tell the student what is outstanding.',
      defaultValue: action === 'clear' ? 'All items returned' : '',
      placeholder: action === 'clear' ? 'Remark' : 'e.g. Lab coat not returned',
      confirmText: action === 'clear' ? 'Clear student' : 'Flag issue',
      required: action === 'flag',
    });
    if (remark === null) return;
    setWorking(`${action}-${r._id}`);
    try {
      const { data: res } = await api.patch(`/clearances/${r._id}/items/${dept._id}`, { action, remark });
      toast.success(res.certificateNo ? `${r.student.name} is fully cleared – certificate ${res.certificateNo} issued` : `${r.student.name} ${action === 'clear' ? 'cleared' : 'flagged'}`);
      await after();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setWorking('');
    }
  };

  const bulkClear = async () => {
    const list = rows.filter((r) => selected.includes(r._id) && clearable(r));
    if (!list.length) return;
    const ok = await confirm({ title: `Clear ${list.length} student${list.length > 1 ? 's' : ''}?`, message: 'Each student is cleared with the remark "Cleared – no dues".', confirmText: 'Clear all' });
    if (!ok) return;
    setWorking('bulk');
    let done = 0;
    for (const r of list) {
      try {
        await api.patch(`/clearances/${r._id}/items/${dept._id}`, { action: 'clear', remark: 'Cleared – no dues' }); // eslint-disable-line no-await-in-loop
        done += 1;
      } catch (err) {
        toast.error(`${r.student.name}: ${errMsg(err)}`);
      }
    }
    toast.success(`${done} student${done !== 1 ? 's' : ''} cleared`);
    setSelected([]);
    setWorking('');
    await after();
  };

  const addDue = async (e) => {
    e.preventDefault();
    setWorking('add-due');
    try {
      await api.post('/dues', { ...dueForm, regNo: current.student.regNo });
      toast.success(`Due added for ${current.student.name}`);
      setDueForm({ amount: '', description: '' });
      await after();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setWorking('');
    }
  };

  const verify = async (d, body, label) => {
    let note = '';
    if (body.approve === false) {
      note = await prompt({ title: 'Reject this receipt?', message: 'The student will be asked to upload it again.', defaultValue: 'Receipt unclear, please upload it again', confirmText: 'Reject receipt' });
      if (note === null) return;
    }
    setWorking(`due-${d._id}`);
    try {
      const { data: res } = await api.patch(`/dues/${d._id}/verify`, { ...body, note });
      toast.success(res.reopened ? `Due ${label}. No dues left – you can clear the student now.` : `Due ${label}`);
      await after();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setWorking('');
    }
  };

  const exportCsv = () => {
    downloadCsv(`${dept?.code || 'dept'}-requests.csv`, [
      ['Student', 'Reg. no.', 'Faculty', 'Reason', 'Submitted', 'Department status', 'Remark', 'Open dues (LKR)', 'Overall progress'],
      ...shown.map((r) => [r.student?.name, r.student?.regNo, r.student?.faculty, r.reason, fmtDate(r.createdAt), r.item?.status, r.item?.remark || '', openDues(r).reduce((s, d) => s + d.amount, 0), `${r.progress?.cleared}/${r.progress?.total}`]),
    ]);
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;

  const selectable = shown.filter(clearable);
  const allChecked = selectable.length > 0 && selectable.every((r) => selected.includes(r._id));

  return (
    <div className="page">
      <PageHeader
        title="Clearance requests"
        subtitle={`Every student request that needs a decision from ${dept?.name}.`}
        actions={<button className="btn btn-ghost" onClick={exportCsv}><Download size={16} /> Export CSV</button>}
      />

      <section className="card">
        <div className="toolbar">
          <SearchInput value={params.get('q') || ''} onChange={(v) => setParam('q', v)} placeholder="Search name or reg. no." />
          <div className="filter-chips">
            {FILTERS.map((f) => (
              <button key={f.value} className={`filter-chip ${status === f.value ? 'active' : ''}`} onClick={() => setParam('status', f.value)}>
                <span>{f.label}</span>
                <span className="count">{counts[f.value]}</span>
              </button>
            ))}
          </div>
          <select className="input select-sm" value={sort} onChange={(e) => setParam('sort', e.target.value === 'newest' ? '' : e.target.value)} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Waiting longest</option>
          </select>
        </div>

        {selected.length > 0 && (
          <div className="bulk-bar">
            <span><strong>{selected.length}</strong> selected</span>
            <button className="btn btn-success btn-sm" disabled={working === 'bulk'} onClick={bulkClear}>{working === 'bulk' ? <Spin /> : <CircleCheck size={15} />} Clear selected</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected([])}>Cancel</button>
          </div>
        )}

        {shown.length === 0 ? (
          <Empty icon={ClipboardList} title="Nothing here">No requests match this view.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table-click">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" aria-label="Select all clearable" checked={allChecked} disabled={!selectable.length}
                      onChange={(e) => setSelected(e.target.checked ? selectable.map((r) => r._id) : [])} />
                  </th>
                  <th>Student</th>
                  <th className="hide-sm">Reason</th>
                  <th className="hide-sm">Submitted</th>
                  <th className="hide-md">Open dues</th>
                  <th className="hide-md">Overall</th>
                  <th>Your decision</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const open = openDues(r);
                  return (
                    <tr key={r._id} onClick={() => setParam('open', r._id)} className={openId === r._id ? 'row-active' : ''}>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Select ${r.student?.name}`} disabled={!clearable(r)} checked={selected.includes(r._id)}
                          onChange={(e) => setSelected((list) => (e.target.checked ? [...list, r._id] : list.filter((x) => x !== r._id)))} />
                      </td>
                      <td><Person name={r.student?.name} sub={`${r.student?.regNo} · ${r.student?.faculty}`} /></td>
                      <td className="hide-sm">{cap(r.reason)}</td>
                      <td className="hide-sm"><span title={fmtDateTime(r.createdAt)}>{fmtDate(r.createdAt)}</span><div className="muted small">{daysSince(r.createdAt) === 0 ? 'today' : `${daysSince(r.createdAt)} d ago`}</div></td>
                      <td className="hide-md">{open.length ? <span className="warn-text">{lkr(open.reduce((s, d) => s + d.amount, 0))}</span> : <span className="muted">None</span>}</td>
                      <td className="hide-md"><MiniProgress value={r.progress?.cleared} total={r.progress?.total} /></td>
                      <td><Badge status={r.item?.status} /></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="actions end">
                          {r.overallStatus !== 'completed' && r.item?.status !== 'cleared' && (
                            <button className="btn btn-success btn-sm" disabled={!!working || open.length > 0} title={open.length ? 'Settle the open dues first' : 'Clear this student'} onClick={() => act(r, 'clear')}>
                              {working === `clear-${r._id}` ? <Spin size={14} /> : <CircleCheck size={14} />} Clear
                            </button>
                          )}
                          {r.overallStatus !== 'completed' && r.item?.status !== 'dues' && (
                            <button className="btn btn-ghost btn-sm" disabled={!!working} onClick={() => act(r, 'flag')}>Flag</button>
                          )}
                          {r.overallStatus === 'completed' && <span className="muted small">Completed</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Student detail drawer – the address (?open=…) keeps it open after a refresh */}
      <Drawer
        open={!!current}
        onClose={() => setParam('open', '')}
        title={current?.student?.name}
        subtitle={current && `${current.student?.regNo} · ${current.student?.faculty}`}
      >
        {current && (
          <>
            <div>
              <div className="section-title">Request</div>
              <dl className="kv">
                <dt>Reason</dt><dd>{cap(current.reason)}</dd>
                <dt>Submitted</dt><dd>{fmtDateTime(current.createdAt)}</dd>
                <dt>Email</dt><dd>{current.student?.email}</dd>
                {current.student?.phone && (<><dt>Phone</dt><dd>{current.student.phone}</dd></>)}
                <dt>{dept?.name}</dt><dd><Badge status={current.item?.status} /></dd>
                {current.item?.remark && (<><dt>Remark</dt><dd>{current.item.remark}</dd></>)}
                {current.note && (<><dt>Student note</dt><dd>{current.note}</dd></>)}
                <dt>Overall</dt><dd><Badge status={current.overallStatus} /> <span className="muted small">{current.progress?.cleared}/{current.progress?.total} cleared</span></dd>
              </dl>
            </div>

            <div>
              <div className="section-title">Other departments</div>
              <div className="dept-chips">
                {current.otherDepartments?.map((o) => (
                  <span key={o.code} className={`chip-dept ${o.status}`} title={`${o.name}: ${o.status}`}>{o.name}</span>
                ))}
              </div>
            </div>

            <div>
              <div className="section-title">Dues in {dept?.name}</div>
              {current.dues.length === 0 ? (
                <p className="muted small">No dues recorded for this student.</p>
              ) : (
                <div className="due-list">
                  {current.dues.map((d) => (
                    <div className="due-card" key={d._id}>
                      <div className="due-top">
                        <div><strong>{d.description}</strong><div className="muted small">Added {fmtDate(d.createdAt)}</div></div>
                        <div style={{ textAlign: 'right' }}><div className="due-amount">{lkr(d.amount)}</div><Badge status={d.status} /></div>
                      </div>
                      {d.receiptUrl && (isImage(d.receiptUrl, d.receiptName) ? (
                        <a className="receipt-preview" href={fileUrl(d.receiptUrl)} target="_blank" rel="noreferrer"><img src={fileUrl(d.receiptUrl)} alt="Payment receipt" /></a>
                      ) : (
                        <a className="btn btn-soft btn-sm" style={{ alignSelf: 'flex-start' }} href={fileUrl(d.receiptUrl)} target="_blank" rel="noreferrer"><FileText size={14} /> Open receipt (PDF)</a>
                      ))}
                      {OPEN.includes(d.status) && (
                        <div className="actions">
                          {d.status === 'receipt-submitted' ? (
                            <>
                              <button className="btn btn-success btn-sm" disabled={!!working} onClick={() => verify(d, { approve: true }, 'marked as paid')}>Approve receipt</button>
                              <button className="btn btn-danger btn-sm" disabled={!!working} onClick={() => verify(d, { approve: false }, 'receipt rejected')}>Reject</button>
                            </>
                          ) : (
                            <>
                              <button className="btn btn-ghost btn-sm" disabled={!!working} onClick={() => verify(d, { approve: true }, 'marked as paid')}>Paid at counter</button>
                              <button className="btn btn-ghost btn-sm" disabled={!!working} onClick={() => verify(d, { waive: true }, 'waived')}>Waive</button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {current.overallStatus !== 'completed' && (
              <form onSubmit={addDue}>
                <div className="section-title">Add a due for this student</div>
                <div className="grid-2">
                  <input className="input" required type="number" min="1" step="0.01" placeholder="Amount (LKR)" value={dueForm.amount} onChange={(e) => setDueForm({ ...dueForm, amount: e.target.value })} />
                  <input className="input" required placeholder="Description" value={dueForm.description} onChange={(e) => setDueForm({ ...dueForm, description: e.target.value })} />
                </div>
                <button className="btn btn-soft btn-sm" style={{ marginTop: 10 }} disabled={working === 'add-due'}>{working === 'add-due' ? <Spin size={14} /> : <Plus size={14} />} Add due</button>
              </form>
            )}
          </>
        )}
        {current && current.overallStatus !== 'completed' && (
          <div className="drawer-actions drawer-sticky">
            {current.item?.status !== 'dues' && (
              <button className="btn btn-danger" disabled={!!working} onClick={() => act(current, 'flag')}><TriangleAlert size={16} /> Flag issue</button>
            )}
            {current.item?.status !== 'cleared' && (
              <button className="btn btn-success" disabled={!!working || openDues(current).length > 0} title={openDues(current).length ? 'Settle the open dues first' : ''} onClick={() => act(current, 'clear')}>
                {working === `clear-${current._id}` ? <Spin /> : <CircleCheck size={16} />} Clear student
              </button>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
