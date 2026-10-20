import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Activity, ArrowRight, BadgeCheck, ClipboardList, Clock, GraduationCap, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useFetch from '../../hooks/useFetch';
import { item, stagger } from '../../components/Page';
import { C, ChartTip, useChartTheme } from '../../components/charts';
import { Badge, cap, Empty, ErrorState, fmtDate, lkr, PageHeader, PageSkeleton, Person, shortDay, StatCard } from '../../components/ui';

export const STATUS_COLORS = { pending: C.grey, 'in-progress': C.brand, completed: C.good, cancelled: C.greySoft };

export default function AdminOverview() {
  const { user } = useAuth();
  const { data, error, reload } = useFetch('/admin/reports');
  const ct = useChartTheme();

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;

  const unpaid = (data.dueTotals.unpaid?.total || 0) + (data.dueTotals['receipt-submitted']?.total || 0);
  const collected = data.dueTotals.paid?.total || 0;
  const active = data.statusCounts.pending + data.statusCounts['in-progress'];
  const pie = Object.entries(data.statusCounts).filter(([, v]) => v > 0).map(([k, v]) => ({ key: k, name: cap(k.replace('-', ' ')), value: v, fill: STATUS_COLORS[k] }));

  return (
    <div className="page">
      <PageHeader
        title={user.university?.name || 'University'}
        eyebrow="Admin console"
        subtitle="Where every student's clearance stands, and where they are waiting."
        actions={<Link to="/admin/reports" className="btn btn-ghost">Full reports <ArrowRight size={16} /></Link>}
      />

      <motion.div className="stats stats-5" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={item}><StatCard icon={GraduationCap} tone="brand" label="Student accounts" value={data.totals.students} /></motion.div>
        <motion.div variants={item}><Link to="/admin/requests?status=in-progress" className="stat-link"><StatCard icon={Clock} tone="brand" label="Active requests" value={active} /></Link></motion.div>
        <motion.div variants={item}><StatCard icon={BadgeCheck} tone="good" label="Certificates issued" value={data.totals.certificates} sub={`${data.completionRate}% of requests`} /></motion.div>
        <motion.div variants={item}><StatCard icon={Activity} tone="brand" label="Avg. days to clear" value={data.avgClearanceDays} format={(v) => v.toFixed(1)} /></motion.div>
        <motion.div variants={item}><StatCard icon={Wallet} tone="warn" label="Outstanding dues" value={unpaid} format={lkr} sub={`${lkr(collected)} collected`} /></motion.div>
      </motion.div>

      <div className="grid-main">
        <section className="card chart-card">
          <h2>Requests over the last 30 days</h2>
          <p className="muted small">Submitted vs. completed per day</p>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.series} margin={{ top: 14, right: 10, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={ct.grid} />
              <XAxis dataKey="date" tickFormatter={shortDay} tick={ct.tick} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tick={ct.tick} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip labelFormatter={shortDay} />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="submitted" name="Submitted" stroke={ct.brand} strokeWidth={2.2} dot={false} />
              <Line type="monotone" dataKey="completed" name="Completed" stroke={C.good} strokeWidth={2.2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section className="card chart-card">
          <h2>Requests by status</h2>
          <p className="muted small">All requests</p>
          {pie.length === 0 ? <Empty icon={ClipboardList} title="No requests yet" /> : (
            <>
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie data={pie} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={3} stroke="none">
                      {pie.map((p) => <Cell key={p.key} fill={p.fill} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center"><strong>{data.totals.requests}</strong><small>Total</small></div>
              </div>
              <div className="legend-list">
                {pie.map((p) => (
                  <Link className="legend-row" key={p.key} to={`/admin/requests?status=${p.key}`}>
                    <span><i style={{ background: p.fill }} />{p.name}</span>
                    <strong>{p.value}</strong>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <div className="grid-main">
        <section className="card chart-card">
          <h2>Where students are waiting</h2>
          <p className="muted small">Department items on active requests – long grey or amber bars are bottlenecks</p>
          <ResponsiveContainer width="100%" height={Math.max(240, data.departmentLoad.length * 44)}>
            <BarChart data={data.departmentLoad} layout="vertical" margin={{ top: 12, right: 16, left: 8, bottom: 0 }} barSize={16}>
              <CartesianGrid horizontal={false} stroke={ct.grid} />
              <XAxis type="number" allowDecimals={false} tick={ct.tick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="department" width={140} tick={ct.tick} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: ct.cursor }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="cleared" name="Cleared" stackId="a" fill={C.good} />
              <Bar dataKey="dues" name="Dues found" stackId="a" fill={C.warn} />
              <Bar dataKey="pending" name="Pending" stackId="a" fill={C.brandSoft} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Latest requests</h2>
            <Link to="/admin/requests" className="btn btn-ghost btn-sm">All</Link>
          </div>
          {data.recent.length === 0 ? <p className="muted small">No requests yet.</p> : (
            <div className="attn-list">
              {data.recent.map((r) => (
                <Link key={r._id} to={`/admin/requests?open=${r._id}`} className="attn-row">
                  <Person name={r.student?.name} sub={`${r.student?.regNo} · ${fmtDate(r.createdAt)}`} />
                  <Badge status={r.status} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
