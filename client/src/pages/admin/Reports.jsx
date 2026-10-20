import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Printer } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { C, ChartTip, useChartTheme } from '../../components/charts';
import { cap, downloadCsv, ErrorState, lkr, PageHeader, PageSkeleton } from '../../components/ui';

const REASON_COLORS = [C.brand, C.brandSoft, C.grey, C.greySoft];

export default function AdminReports() {
  const { data, error, reload } = useFetch('/admin/reports');
  const ct = useChartTheme();

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;

  const reasons = data.byReason.map((r, i) => ({ name: cap(r.reason), value: r.count, fill: REASON_COLORS[i % REASON_COLORS.length] }));
  const totalOutstanding = data.duesPerDepartment.reduce((s, d) => s + d.outstanding, 0);
  const totalCollected = data.duesPerDepartment.reduce((s, d) => s + d.collected, 0);

  const exportAll = () =>
    downloadCsv('clearpath-report.csv', [
      ['Section', 'Item', 'Value 1', 'Value 2'],
      ['Totals', 'Students', data.totals.students, ''],
      ['Totals', 'Requests', data.totals.requests, ''],
      ['Totals', 'Certificates', data.totals.certificates, ''],
      ['Totals', 'Average days to clear', data.avgClearanceDays, ''],
      ['Totals', 'Completion rate (%)', data.completionRate, ''],
      ...Object.entries(data.statusCounts).map(([k, v]) => ['Status', k, v, '']),
      ...data.byFaculty.map((f) => ['Faculty (total, completed)', f.faculty, f.total, f.completed]),
      ...data.byReason.map((r) => ['Reason', r.reason, r.count, '']),
      ...data.duesPerDepartment.map((d) => ['Dues (outstanding, collected)', d.department, d.outstanding, d.collected]),
      ...data.departmentLoad.map((d) => ['Active items (pending, dues)', d.department, d.pending, d.dues]),
    ]);

  return (
    <div className="page">
      <PageHeader
        title="Reports"
        subtitle="Clearance performance across faculties and departments."
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => window.print()}><Printer size={16} /> Print</button>
            <button className="btn btn-primary" onClick={exportAll}><Download size={16} /> Export CSV</button>
          </>
        }
      />

      <div className="summary-strip">
        <div><small>Total requests</small><strong>{data.totals.requests}</strong></div>
        <div><small>Completion rate</small><strong className="good-text">{data.completionRate}%</strong></div>
        <div><small>Avg. days to clear</small><strong>{data.avgClearanceDays}</strong></div>
        <div><small>Dues collected</small><strong className="good-text">{lkr(totalCollected)}</strong></div>
        <div><small>Dues outstanding</small><strong className="warn-text">{lkr(totalOutstanding)}</strong></div>
      </div>

      <div className="grid-2 grid-gap">
        <section className="card chart-card">
          <h2>Requests by faculty</h2>
          <p className="muted small">Total vs. completed</p>
          <ResponsiveContainer width="100%" height={Math.max(240, data.byFaculty.length * 46)}>
            <BarChart data={data.byFaculty} layout="vertical" margin={{ top: 10, right: 16, left: 8, bottom: 0 }} barSize={12} barGap={3}>
              <CartesianGrid horizontal={false} stroke={ct.grid} />
              <XAxis type="number" allowDecimals={false} tick={ct.tick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="faculty" width={150} tick={ct.tick} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: ct.cursor }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="total" name="Requests" fill={C.brandSoft} radius={[0, 5, 5, 0]} />
              <Bar dataKey="completed" name="Completed" fill={C.good} radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="card chart-card">
          <h2>Why students request clearance</h2>
          <p className="muted small">Share of requests by reason</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={reasons} dataKey="value" nameKey="name" innerRadius={55} outerRadius={86} paddingAngle={3} stroke="none">
                {reasons.map((r) => <Cell key={r.name} fill={r.fill} />)}
              </Pie>
              <Tooltip content={<ChartTip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend-list">
            {reasons.map((r) => (
              <div className="legend-row" key={r.name}><span><i style={{ background: r.fill }} />{r.name}</span><strong>{r.value}</strong></div>
            ))}
          </div>
        </section>
      </div>

      <section className="card chart-card">
        <h2>Dues by department</h2>
        <p className="muted small">Money still owed vs. money collected (LKR)</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.duesPerDepartment} margin={{ top: 14, right: 10, left: 10, bottom: 0 }} barGap={4}>
            <CartesianGrid vertical={false} stroke={ct.grid} />
            <XAxis dataKey="department" tick={ct.tick} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={ct.tick} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
            <Tooltip content={<ChartTip valueFormatter={lkr} />} cursor={{ fill: ct.cursor }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="outstanding" name="Outstanding" fill={C.warn} radius={[5, 5, 0, 0]} />
            <Bar dataKey="collected" name="Collected" fill={C.good} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="card">
        <h2>Department workload</h2>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table>
            <thead><tr><th>Department</th><th>Pending now</th><th>Flagged with dues</th><th>Cleared (active requests)</th><th>Outstanding dues</th><th>Collected</th></tr></thead>
            <tbody>
              {data.departmentLoad.map((d) => {
                const money = data.duesPerDepartment.find((x) => x.department === d.department) || {};
                return (
                  <tr key={d.department}>
                    <td><strong>{d.department}</strong></td>
                    <td>{d.pending}</td>
                    <td>{d.dues ? <span className="warn-text">{d.dues}</span> : 0}</td>
                    <td>{d.cleared}</td>
                    <td>{lkr(money.outstanding)}</td>
                    <td>{lkr(money.collected)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
