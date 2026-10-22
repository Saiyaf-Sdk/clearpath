import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, BadgeCheck, Building2, ClipboardList, GraduationCap, Users } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { item, stagger } from '../../components/Page';
import { ChartTip, useChartTheme } from '../../components/charts';
import { actionLabel, ErrorState, PageHeader, PageSkeleton, shortDay, StatCard, timeAgo, UniLogo } from '../../components/ui';

export default function PlatformOverview() {
  const { data, error, reload } = useFetch('/platform/overview');
  const ct = useChartTheme();

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;
  const t = data.totals;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Platform administration"
        title="ClearPath across Sri Lanka"
        subtitle="Every state university portal at a glance."
        actions={<Link to="/platform/universities" className="btn btn-primary">Manage universities <ArrowRight size={16} /></Link>}
      />

      <motion.div className="stats stats-5" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={item}><StatCard icon={Building2} tone="brand" label="Universities" value={t.universities} sub={`${t.activeUniversities} active`} /></motion.div>
        <motion.div variants={item}><StatCard icon={GraduationCap} tone="brand" label="Student accounts" value={t.students} /></motion.div>
        <motion.div variants={item}><StatCard icon={Users} tone="brand" label="Staff accounts" value={t.officers + t.admins + (t.facultyAdmins || 0)} sub={`${t.faculties || 0} faculties · ${t.admins + (t.facultyAdmins || 0)} admins`} /></motion.div>
        <motion.div variants={item}><StatCard icon={ClipboardList} tone="brand" label="Requests" value={t.requests} sub={`${t.active} active`} /></motion.div>
        <motion.div variants={item}><StatCard icon={BadgeCheck} tone="good" label="Certificates" value={t.certificates} /></motion.div>
      </motion.div>

      <div className="grid-main">
        <section className="card chart-card">
          <h2>Requests on the platform</h2>
          <p className="muted small">New clearance requests per day, last 30 days</p>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data.series} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
              <defs><linearGradient id="gPl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ct.brand} stopOpacity={0.3} /><stop offset="100%" stopColor={ct.brand} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke={ct.grid} />
              <XAxis dataKey="date" tickFormatter={shortDay} tick={ct.tick} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tick={ct.tick} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip labelFormatter={shortDay} />} />
              <Area type="monotone" dataKey="requests" name="Requests" stroke={ct.brand} strokeWidth={2} fill="url(#gPl)" />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Latest activity</h2>
            <Link to="/platform/audit" className="btn btn-ghost btn-sm">Audit log</Link>
          </div>
          <ul className="activity">
            {data.recent.map((l) => (
              <li key={l._id}>
                <span className="act-dot t-brand" />
                <div>
                  <div className="act-line"><strong>{l.actor?.name || 'System'}</strong><span>{actionLabel(l.action).toLowerCase()}</span></div>
                  <div className="act-details">{l.university?.code ? `${l.university.code} · ` : ''}{l.details}</div>
                  <small className="muted">{timeAgo(l.createdAt)}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Universities</h2>
            <p className="muted small">Busiest portals first</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>University</th><th>Students</th><th className="hide-sm">Staff</th><th>Requests</th><th className="hide-sm">Completed</th><th>Status</th></tr></thead>
            <tbody>
              {data.universities.map((u) => (
                <tr key={u._id}>
                  <td><div className="person"><UniLogo university={u} size={32} /><div><strong>{u.name}</strong><small>{u.code}</small></div></div></td>
                  <td>{u.students}</td>
                  <td className="hide-sm">{u.staff}</td>
                  <td>{u.requests}</td>
                  <td className="hide-sm">{u.completed}</td>
                  <td>{!u.isActive ? <span className="badge badge-inactive">Inactive</span> : u.staff ? <span className="badge badge-completed">Live</span> : <span className="badge badge-pending">Not set up</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
