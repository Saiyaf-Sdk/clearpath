import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Award, CalendarDays, CircleCheck, Clock, GraduationCap, Hourglass, ListChecks, Receipt, Send, TriangleAlert, Wallet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useFetch from '../../hooks/useFetch';
import { item, stagger } from '../../components/Page';
import {
  Badge, cap, daysSince, deptIcon, ErrorState, fmtDate, lkr, PageHeader, PageSkeleton, ProgressRing, StatCard, timeAgo, UniLogo,
} from '../../components/ui';
import { KIND_ICON } from '../../components/app/NotificationBell';
import useStudentData from './useStudentData';

export default function StudentOverview() {
  const { user } = useAuth();
  const s = useStudentData();
  const notes = useFetch('/notifications', { params: { limit: 6 } });

  if (s.loading) return <PageSkeleton />;
  if (s.error) return <ErrorState message={s.error} onRetry={s.retry} />;

  const { active } = s;
  const duesItems = active ? active.items.filter((i) => i.status === 'dues') : [];
  const pendingItems = active ? active.items.filter((i) => i.status === 'pending') : [];
  const first = user.name.split(' ')[0];

  return (
    <div className="page">
      <PageHeader
        eyebrow={user.university?.name}
        title={`Hello, ${first}`}
        subtitle={`${user.regNo} · Faculty of ${user.faculty}`}
        actions={!active || active.status === 'completed' ? null : <Link to="/student/clearance" className="btn btn-primary"><ListChecks size={16} /> View my request</Link>}
      />

      {/* Status hero */}
      <motion.section className="card hero-status" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {!active && (
          <div className="hs-empty">
            <div className="hs-icon"><Send size={24} /></div>
            <div>
              <h2>You haven't started your clearance yet</h2>
              <p className="muted">One request goes to every department at once. You can follow each office's decision here, pay any dues online and download your certificate when everyone has cleared you.</p>
            </div>
            <Link to="/student/clearance" className="btn btn-primary btn-lg">Start clearance <ArrowRight size={17} /></Link>
          </div>
        )}

        {active && (
          <div className="hs-grid">
            <ProgressRing value={s.pct} size={150} />
            <div className="hs-body">
              <div className="row-gap"><Badge status={active.status} /><span className="muted small"><CalendarDays size={13} style={{ verticalAlign: -2 }} /> {cap(active.reason)} clearance · submitted {fmtDate(active.createdAt)}</span></div>
              {active.status === 'completed' ? (
                <>
                  <h2>You are fully cleared</h2>
                  <p className="muted">Every department has cleared you. Your certificate is ready.</p>
                  <div className="row-gap" style={{ marginTop: 12 }}>
                    <Link to="/student/certificate" className="btn btn-success"><Award size={16} /> Get my certificate</Link>
                  </div>
                </>
              ) : (
                <>
                  <h2>{s.cleared} of {s.total} departments have cleared you</h2>
                  <ul className="next-steps">
                    {duesItems.map((it) => (
                      <li key={it.department?._id} className="warn">
                        <TriangleAlert size={16} />
                        <span><strong>{it.department?.name}</strong> needs a payment or item returned. <Link to="/student/dues">Pay and upload the receipt</Link></span>
                      </li>
                    ))}
                    {pendingItems.length > 0 && (
                      <li>
                        <Hourglass size={16} />
                        <span>Waiting for <strong>{pendingItems.map((i) => i.department?.name).join(', ')}</strong> to review your request.</span>
                      </li>
                    )}
                    {duesItems.length === 0 && pendingItems.length === 0 && (
                      <li className="good"><CircleCheck size={16} /><span>All departments are done – your certificate is being issued.</span></li>
                    )}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
      </motion.section>

      <motion.div className="stats" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={item}><StatCard icon={GraduationCap} tone="good" label="Departments cleared" value={active ? `${s.cleared} / ${s.total}` : '—'} /></motion.div>
        <motion.div variants={item}><StatCard icon={Wallet} tone={s.owed > 0 ? 'warn' : 'brand'} label="Outstanding dues" value={s.owed} format={lkr} sub={s.unpaid.length ? `${s.unpaid.length} to pay` : 'Nothing to pay'} /></motion.div>
        <motion.div variants={item}><StatCard icon={Receipt} tone="brand" label="Receipts under review" value={s.review.length} /></motion.div>
        <motion.div variants={item}><StatCard icon={Clock} tone="brand" label={active?.status === 'completed' ? 'Days to clear' : 'Days since submitted'} value={active ? (active.status === 'completed' ? Math.max(1, Math.round((new Date(active.completedAt) - new Date(active.createdAt)) / 864e5)) : daysSince(active.createdAt)) : '—'} /></motion.div>
      </motion.div>

      <div className="grid-main">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Department status</h2>
              <p className="muted small">Live decisions from each office</p>
            </div>
            <Link to="/student/clearance" className="btn btn-ghost btn-sm">Details <ArrowRight size={14} /></Link>
          </div>
          {!active ? (
            <p className="muted small">Departments appear here once you submit a request.</p>
          ) : (
            <div className="dept-mini">
              {active.items.map((it) => {
                const Icon = deptIcon(it.department?.code);
                return (
                  <div key={it.department?._id} className={`dept-mini-row s-${it.status}`}>
                    <span className="dm-icon"><Icon size={16} /></span>
                    <div className="dm-text">
                      <strong>{it.department?.name}</strong>
                      <small>{it.remark || 'Waiting for review'}</small>
                    </div>
                    <Badge status={it.status} />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2>Recent updates</h2>
              <Link to="/notifications" className="btn btn-ghost btn-sm">All</Link>
            </div>
            {!notes.data ? (
              <p className="muted small">Loading…</p>
            ) : notes.data.items.length === 0 ? (
              <p className="muted small">No updates yet.</p>
            ) : (
              <ul className="updates">
                {notes.data.items.map((n) => {
                  const Icon = KIND_ICON[n.kind] || CircleCheck;
                  return (
                    <li key={n._id}>
                      <span className={`bell-kind k-${n.kind}`}><Icon size={14} /></span>
                      <div>
                        <strong>{n.title}</strong>
                        {n.body && <p className="muted small">{n.body}</p>}
                        <small className="muted">{timeAgo(n.createdAt)}</small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card">
            <h2>My details</h2>
            <div className="uni-line">
              <UniLogo university={user.university} size={34} />
              <span>{user.university?.name}</span>
            </div>
            <dl className="kv">
              <dt>Reg. number</dt><dd>{user.regNo}</dd>
              <dt>Faculty</dt><dd>{user.faculty}</dd>
              <dt>Email</dt><dd>{user.email}</dd>
              {user.phone && (<><dt>Phone</dt><dd>{user.phone}</dd></>)}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
