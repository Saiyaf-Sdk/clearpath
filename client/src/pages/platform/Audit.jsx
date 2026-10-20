import { useState } from 'react';
import { Activity } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { actionLabel, actionTone, Empty, ErrorState, fmtDateTime, PageHeader, Pager, PageSkeleton, timeAgo } from '../../components/ui';

export default function PlatformAudit() {
  const [page, setPage] = useState(1);
  const [university, setUniversity] = useState('');
  const unis = useFetch('/platform/universities');
  const { data, error, reload } = useFetch('/platform/audit', { params: { page, university: university || undefined } });

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="page">
      <PageHeader title="Platform audit log" subtitle="Actions across every university on ClearPath." />
      <section className="card">
        <div className="toolbar">
          <select className="input select-sm" value={university} onChange={(e) => { setUniversity(e.target.value); setPage(1); }} aria-label="University">
            <option value="">All universities</option>
            {(unis.data || []).map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
        </div>
        {!data ? <PageSkeleton /> : data.items.length === 0 ? <Empty icon={Activity} title="No records" /> : (
          <>
            <div className="table-wrap">
              <table>
                <thead><tr><th>When</th><th>University</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
                <tbody>
                  {data.items.map((l) => (
                    <tr key={l._id}>
                      <td className="nowrap small">{fmtDateTime(l.createdAt)}<div className="muted">{timeAgo(l.createdAt)}</div></td>
                      <td className="small">{l.university?.code || 'Platform'}</td>
                      <td><strong>{l.actor?.name || '—'}</strong><div className="muted small">{l.actor?.role}</div></td>
                      <td><span className={`act-tag t-${actionTone(l.action)}`}>{actionLabel(l.action)}</span></td>
                      <td className="small">{l.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} label="records" />
          </>
        )}
      </section>
    </div>
  );
}
