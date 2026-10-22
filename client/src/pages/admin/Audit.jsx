import { useState } from 'react';
import { Activity, Download } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import {
  actionLabel, actionTone, downloadCsv, Empty, ErrorState, fmtDateTime, PageHeader, Pager, PageSkeleton, SearchInput, timeAgo,
} from '../../components/ui';
import FacultySelect from '../../components/FacultySelect';
import { useAuth } from '../../context/AuthContext';

const TYPES = [
  { value: '', label: 'Everything' },
  { value: 'CLEARANCE', label: 'Clearance' },
  { value: 'DUE', label: 'Dues' },
  { value: 'CERTIFICATE', label: 'Certificates' },
  { value: 'USER', label: 'Users' },
  { value: 'ROSTER', label: 'Student list' },
  { value: 'DEPARTMENT', label: 'Departments' },
];

export default function AdminAudit() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [faculty, setFaculty] = useState('');
  const { user } = useAuth();
  const isUniAdmin = user.role === 'admin';
  const { data, error, reload } = useFetch('/admin/audit', { params: { page, action: action || undefined, search: search || undefined, faculty: faculty || undefined } });

  if (error) return <ErrorState message={error} onRetry={reload} />;

  const exportPage = () =>
    downloadCsv(`audit-log-page-${page}.csv`, [
      ['When', 'Who', 'Role', 'Department', 'Action', 'Details'],
      ...(data?.items || []).map((l) => [fmtDateTime(l.createdAt), l.actor?.name || '', l.actor?.role || '', l.department?.name || '', l.action, l.details || '']),
    ]);

  return (
    <div className="page">
      <PageHeader
        title="Audit log"
        subtitle={isUniAdmin ? 'A permanent record of every action in your university – who did what, and when.' : `Every action in the ${user.facultyInfo?.name || 'faculty'} – who did what, and when.`}
        actions={<button className="btn btn-ghost" onClick={exportPage} disabled={!data?.items?.length}><Download size={16} /> Export page</button>}
      />
      <section className="card">
        <div className="toolbar">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search details (e.g. a reg. no.)" />
          {isUniAdmin && <FacultySelect all central value={faculty} onChange={(v) => { setFaculty(v); setPage(1); }} className="input select-sm" />}
          <div className="seg">
            {TYPES.map((t) => (
              <button key={t.value} className={action === t.value ? 'active' : ''} onClick={() => { setAction(t.value); setPage(1); }}>{t.label}</button>
            ))}
          </div>
        </div>
        {!data ? <PageSkeleton /> : data.items.length === 0 ? <Empty icon={Activity} title="No records">Nothing matches this filter.</Empty> : (
          <>
            <div className="table-wrap">
              <table>
                <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
                <tbody>
                  {data.items.map((l) => (
                    <tr key={l._id}>
                      <td className="nowrap small">{fmtDateTime(l.createdAt)}<div className="muted">{timeAgo(l.createdAt)}</div></td>
                      <td><strong>{l.actor?.name || '—'}</strong><div className="muted small">{l.department?.name || (l.actor?.role ? l.actor.role : '')}</div></td>
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
