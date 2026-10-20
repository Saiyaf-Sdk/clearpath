import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, CircleCheck, Clock, Gauge, HandCoins, Receipt, TriangleAlert, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useFetch from '../../hooks/useFetch';
import { item, stagger } from '../../components/Page';
import { C, ChartTip, useChartTheme } from '../../components/charts';
import {
  ActivityList, cap, deptIcon, ErrorState, lkr, PageHeader, PageSkeleton, Person, shortDay, StatCard,
} from '../../components/ui';

const turnaround = (h) => (h === null || h === undefined ? '—' : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} days`);

export default function OfficerOverview() {
  const { user } = useAuth();
  const { data, error, reload } = useFetch('/stats/officer');
  const ct = useChartTheme();
  const DeptIcon = deptIcon(user.department?.code);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;

  const { counts, dues } = data;

  return (
    <div className="page">
      <PageHeader
        icon={DeptIcon}
        eyebrow="Department desk"
        title={data.department.name}
        subtitle={`Signed in as ${user.name}`}
        actions={<Link to="/officer/requests?status=pending" className="btn btn-primary">Review pending <ArrowRight size={16} /></Link>}
      />

      <motion.div className="stats" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={item}><Link to="/officer/requests?status=pending" className="stat-link"><StatCard icon={Clock} tone="brand" label="Awaiting your review" value={counts.pending} /></Link></motion.div>
        <motion.div variants={item}><Link to="/officer/requests?status=dues" className="stat-link"><StatCard icon={TriangleAlert} tone="warn" label="Flagged with dues" value={counts.dues} /></Link></motion.div>
        <motion.div variants={item}><Link to="/officer/receipts" className="stat-link"><StatCard icon={Receipt} tone="brand" label="Receipts to verify" value={counts.receiptsToVerify} /></Link></motion.div>
        <motion.div variants={item}><StatCard icon={CircleCheck} tone="good" label="Cleared this week" value={counts.clearedThisWeek} sub={`${counts.clearedTotal} cleared in total`} /></motion.div>
      </motion.div>

      <div className="grid-main">
        <section className="card chart-card">
          <div className="card-head">
            <div>
              <h2>Last 14 days</h2>
              <p className="muted small">New requests received vs. students your department cleared</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.series} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ct.brand} stopOpacity={0.28} /><stop offset="100%" stopColor={ct.brand} stopOpacity={0} /></linearGradient>
                <linearGradient id="gClr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.good} stopOpacity={0.28} /><stop offset="100%" stopColor={C.good} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={ct.grid} />
              <XAxis dataKey="date" tickFormatter={shortDay} tick={ct.tick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
              <YAxis allowDecimals={false} tick={ct.tick} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip labelFormatter={shortDay} />} cursor={{ stroke: ct.grid }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="received" name="Received" stroke={ct.brand} strokeWidth={2} fill="url(#gRec)" />
              <Area type="monotone" dataKey="cleared" name="Cleared" stroke={C.good} strokeWidth={2} fill="url(#gClr)" />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        <section className="card">
          <h2>Money &amp; speed</h2>
          <div className="metric-list">
            <div className="metric">
              <span className="metric-icon warn"><Wallet size={17} /></span>
              <div><small>Outstanding dues</small><strong>{lkr(dues.outstanding)}</strong><span className="muted small">{dues.outstandingCount} open</span></div>
            </div>
            <div className="metric">
              <span className="metric-icon good"><HandCoins size={17} /></span>
              <div><small>Collected</small><strong>{lkr(dues.collected)}</strong><span className="muted small">{dues.collectedCount} paid{dues.waived ? ` · ${lkr(dues.waived)} waived` : ''}</span></div>
            </div>
            <div className="metric">
              <span className="metric-icon brand"><Gauge size={17} /></span>
              <div><small>Average time to clear</small><strong>{turnaround(data.avgTurnaroundHours)}</strong><span className="muted small">From request to your decision (90 days)</span></div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid-2 grid-gap">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Waiting the longest</h2>
              <p className="muted small">Oldest requests still pending in your department</p>
            </div>
            <Link to="/officer/requests?status=pending&sort=oldest" className="btn btn-ghost btn-sm">All pending</Link>
          </div>
          {data.attention.length === 0 ? (
            <p className="muted small">Nothing pending – great work.</p>
          ) : (
            <div className="attn-list">
              {data.attention.map((r) => (
                <Link key={r._id} to={`/officer/requests?open=${r._id}`} className="attn-row">
                  <Person name={r.student?.name} sub={`${r.student?.regNo} · ${cap(r.reason)}`} />
                  <span className={`wait-chip ${r.waitingDays >= 5 ? 'late' : ''}`}>{r.waitingDays === 0 ? 'Today' : `${r.waitingDays} day${r.waitingDays > 1 ? 's' : ''}`}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Recent activity</h2>
              <p className="muted small">What your department did lately</p>
            </div>
            <Link to="/officer/activity" className="btn btn-ghost btn-sm">History</Link>
          </div>
          <ActivityList items={data.recent} />
        </section>
      </div>
    </div>
  );
}
