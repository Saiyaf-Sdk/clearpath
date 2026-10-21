import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ClipboardList, Download, FileText } from 'lucide-react';
import api, { errMsg, fileUrl } from '../../api';
import { useDialog } from '../../context/DialogContext';
import { useShell } from '../../components/app/ShellContext';
import useFetch from '../../hooks/useFetch';
import useSort from '../../hooks/useSort';
import {
  ActivityList, Badge, cap, downloadCsv, Drawer, Empty, ErrorState, fmtDate, fmtDateTime, lkr, MiniProgress, PageHeader, PageSkeleton, Person, SearchInput, Skeleton, Spin,
} from '../../components/ui';

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function AdminRequests() {
  const { prompt } = useDialog();
  const { refresh: refreshBadges } = useShell();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const search = params.get('q') || '';
  const department = params.get('department') || '';
  const openId = params.get('open');
  const depts = useFetch('/departments');
  const list = useFetch('/admin/requests', { params: { status: status || undefined, search: search || undefined, department: department || undefined, deptStatus: department ? 'pending' : undefined } });
  const detail = useFetch(openId ? `/admin/requests/${openId}` : null, { enabled: !!openId });
  const [working, setWorking] = useState('');
  const [downloading, setDownloading] = useState(false);
  const { sorted, th } = useSort(list.data, { key: '', dir: 'asc' }, {
    student: (r) => r.student?.name,
    progress: (r) => (r.items.length ? r.items.filter((i) => i.status === 'cleared').length / r.items.length : 0),
  });

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const override = async (r, it) => {
    if (['cancelled', 'completed'].includes(r.status)) return;
    const action = it.status === 'cleared' ? 'flag' : 'clear';
    const remark = await prompt({
      title: `${action === 'clear' ? 'Clear' : 'Flag'} ${it.department.name}?`,
      message: `Admin override for ${r.student.name}. Use this only when the department can't act (e.g. officer on leave).`,
      defaultValue: action === 'clear' ? 'Admin override' : '',
      confirmText: action === 'clear' ? 'Clear' : 'Flag',
      required: action === 'flag',
    });
    if (remark === null) return;
    setWorking(`${r._id}-${it.department._id}`);
    try {
      const { data: res } = await api.patch(`/clearances/${r._id}/items/${it.department._id}`, { action, remark });
      toast.success(res.certificateNo ? `Completed – certificate ${res.certificateNo} issued` : `${it.department.name} updated`);
      list.refresh();
      if (openId) detail.refresh();
      refreshBadges();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setWorking('');
    }
  };

  const downloadCert = async (r) => {
    setDownloading(true);
    try {
      const res = await api.get(`/certificates/${r._id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `ClearPath-${r.certificate?.certificateNo || r._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error('Could not download the certificate');
    } finally {
      setDownloading(false);
    }
  };

  const exportCsv = () =>
    downloadCsv('clearance-requests.csv', [
      ['Student', 'Reg. no.', 'Faculty', 'Reason', 'Submitted', 'Status', 'Cleared departments', 'Completed', ...(list.data?.[0]?.items || []).map((i) => i.department?.code)],
      ...(list.data || []).map((r) => [r.student?.name, r.student?.regNo, r.student?.faculty, r.reason, fmtDate(r.createdAt), r.status, `${r.items.filter((i) => i.status === 'cleared').length}/${r.items.length}`, r.completedAt ? fmtDate(r.completedAt) : '', ...r.items.map((i) => i.status)]),
    ]);

  if (list.error) return <ErrorState message={list.error} onRetry={list.reload} />;
  const d = detail.data && detail.data._id === openId ? detail.data : null;

  return (
    <div className="page">
      <PageHeader
        title="All requests"
        subtitle="Every clearance request in your university. Click a row for the full history."
        actions={<button className="btn btn-ghost" onClick={exportCsv} disabled={!list.data?.length}><Download size={16} /> Export CSV</button>}
      />

      <section className="card">
        <div className="toolbar">
          <SearchInput value={search} onChange={(v) => setParam('q', v)} placeholder="Search student name or reg. no." />
          <select className="input select-sm" value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Status">
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="input select-sm" value={department} onChange={(e) => setParam('department', e.target.value)} aria-label="Pending at department">
            <option value="">Any department</option>
            {(depts.data || []).map((dp) => <option key={dp._id} value={dp._id}>Pending at {dp.name}</option>)}
          </select>
          {list.data && <span className="muted small push-right">{list.data.length} request{list.data.length !== 1 ? 's' : ''}</span>}
        </div>
        {!list.data ? <PageSkeleton /> : list.data.length === 0 ? <Empty icon={ClipboardList} title="No requests">Nothing matches these filters.</Empty> : (
          <div className="table-wrap">
            <table className="table-click">
              <thead><tr>{th('student', 'Student')}{th('reason', 'Reason', { className: 'hide-sm' })}{th('createdAt', 'Submitted', { className: 'hide-sm' })}<th>Departments</th>{th('progress', 'Progress', { className: 'hide-md' })}{th('status', 'Status')}</tr></thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r._id} onClick={() => setParam('open', r._id)} className={openId === r._id ? 'row-active' : ''}>
                    <td><Person name={r.student?.name} photo={r.student?.avatarUrl} sub={`${r.student?.regNo} · ${r.student?.faculty}`} /></td>
                    <td className="hide-sm">{cap(r.reason)}</td>
                    <td className="hide-sm">{fmtDate(r.createdAt)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="dept-chips">
                        {r.items.map((it) => (
                          <button key={it.department?._id} className={`chip-dept ${it.status}`} title={`${it.department?.name}: ${it.status}${['cancelled', 'completed'].includes(r.status) ? '' : ' – click to override'}`}
                            disabled={working === `${r._id}-${it.department?._id}`} onClick={() => override(r, it)}>
                            {it.department?.code}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="hide-md"><MiniProgress value={r.items.filter((i) => i.status === 'cleared').length} total={r.items.length} /></td>
                    <td><Badge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Drawer open={!!openId} onClose={() => setParam('open', '')} title={d?.student?.name || 'Request'} subtitle={d && `${d.student?.regNo} · ${d.student?.faculty}`}>
        {!d ? (detail.error ? <p className="muted">{detail.error}</p> : <Skeleton h={300} r={14} />) : (
          <>
            <div>
              <div className="section-title">Request</div>
              <dl className="kv">
                <dt>Status</dt><dd><Badge status={d.status} /></dd>
                <dt>Reason</dt><dd>{cap(d.reason)}</dd>
                <dt>Submitted</dt><dd>{fmtDateTime(d.createdAt)}</dd>
                {d.completedAt && (<><dt>Completed</dt><dd>{fmtDateTime(d.completedAt)}</dd></>)}
                <dt>Email</dt><dd>{d.student?.email}</dd>
                {d.note && (<><dt>Student note</dt><dd>{d.note}</dd></>)}
                {d.certificate && (<><dt>Certificate</dt><dd className="mono">{d.certificate.certificateNo}</dd></>)}
              </dl>
              {d.certificate && (
                <button className="btn btn-soft btn-sm" style={{ marginTop: 10 }} onClick={() => downloadCert(d)} disabled={downloading}>{downloading ? <Spin size={14} /> : <FileText size={14} />} Download certificate</button>
              )}
            </div>
            <div>
              <div className="section-title">Departments</div>
              <div className="dept-detail">
                {d.items.map((it) => (
                  <div key={it.department?._id} className="dd-row">
                    <div>
                      <strong>{it.department?.name}</strong>
                      <small className="muted">{it.remark || 'Waiting for review'}{it.actionedBy?.name ? ` · ${it.actionedBy.name}` : ''}{it.actionedAt ? ` · ${fmtDate(it.actionedAt)}` : ''}</small>
                    </div>
                    <div className="row-gap">
                      <Badge status={it.status} />
                      {!['cancelled', 'completed'].includes(d.status) && (
                        <button className="btn btn-ghost btn-sm" disabled={!!working} onClick={() => override(d, it)}>{it.status === 'cleared' ? 'Flag' : 'Clear'}</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="section-title">Dues</div>
              {d.dues.length === 0 ? <p className="muted small">No dues for this student.</p> : (
                <div className="dept-detail">
                  {d.dues.map((due) => (
                    <div key={due._id} className="dd-row">
                      <div><strong>{due.description}</strong><small className="muted">{due.department?.name} · {fmtDate(due.createdAt)}</small></div>
                      <div className="row-gap"><strong>{lkr(due.amount)}</strong><Badge status={due.status} />{due.receiptUrl && <a href={fileUrl(due.receiptUrl)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" aria-label="Open receipt"><FileText size={13} /></a>}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="section-title">History</div>
              <ActivityList items={d.history} empty="No history recorded." />
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}
