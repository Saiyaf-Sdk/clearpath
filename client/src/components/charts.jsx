import { useTheme } from '../context/ThemeContext';

// Colours carry meaning only: brand = activity, green = done/paid, amber = dues, grey = waiting
export const C = {
  brand: '#4f46e5',
  brandSoft: '#a5b4fc',
  good: '#10b981',
  warn: '#f59e0b',
  bad: '#e11d48',
  grey: '#94a3b8',
  greySoft: '#cbd5e1',
};

export function useChartTheme() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return {
    axis: dark ? '#8b95a8' : '#64748b',
    grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)',
    cursor: dark ? 'rgba(165,180,252,0.08)' : 'rgba(79,70,229,0.06)',
    brand: dark ? '#818cf8' : C.brand,
    tick: { fill: dark ? '#8b95a8' : '#64748b', fontSize: 12 },
  };
}

export function ChartTip({ active, payload, label, labelFormatter, valueFormatter = (v) => v }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label !== undefined && <strong>{labelFormatter ? labelFormatter(label) : label}</strong>}
      {payload.map((p) => (
        <div key={p.dataKey || p.name} className="chart-tip-row">
          <i style={{ background: p.color || p.payload?.fill }} />
          <span>{p.name}</span>
          <b>{valueFormatter(p.value)}</b>
        </div>
      ))}
    </div>
  );
}
