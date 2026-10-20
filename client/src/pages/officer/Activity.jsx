import { useState } from 'react';
import { History } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { actionLabel, actionTone, Empty, ErrorState, fmtDateTime, PageHeader, Pager, PageSkeleton, timeAgo } from '../../components/ui';

const TYPES = [
  { value: '', label: 'Everything' },
  { value: 'CLEARANCE_CLEARED', label: 'Clearances' },
  { value: 'CLEARANCE_FLAGGED', label: 'Flags' },
  { value: 'DUE', label: 'Dues' },
  { value: 'CERTIFICATE', label: 'Certificates' },
];

export default function OfficerActivity() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const { data, error, reload } = useFetch('/stats/officer/activity', { params: { page, action: action || undefined } });

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="page">
      <PageHeader title="Activity history" subtitle="Every decision made in your department, newest first. Useful when a student asks what happened." />
      <section className="card">
        <div className="toolbar">
          <div className="seg">
            {TYPES.map((t) => (
              <button key={t.value} className={action === t.value ? 'active' : ''} onClick={() => { setAction(t.value); setPage(1); }}>{t.label}</button>
            ))}
          </div>
        </div>
        {!data ? <PageSkeleton /> : data.items.length === 0 ? (
          <Empty icon={History} title="No activity">Nothing recorded yet for this filter.</Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
                <tbody>
                  {data.items.map((l) => (
                    <tr key={l._id}>
                      <td className="nowrap small" title={fmtDateTime(l.createdAt)}>{fmtDateTime(l.createdAt)}<div className="muted">{timeAgo(l.createdAt)}</div></td>
                      <td><strong>{l.actor?.name || '—'}</strong></td>
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
