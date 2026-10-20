import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BedDouble, BookOpen, Building2, CircleCheck, CircleX, Clock, FileUp, FlaskConical, Hourglass, Landmark,
  LoaderCircle, Receipt, TriangleAlert, Trophy, Users, X,
} from 'lucide-react';

/* ---------- formatting ---------- */
export const lkr = (n) => `LKR ${Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/* ---------- department icons ---------- */
const DEPT_ICONS = { LIB: BookOpen, HOS: BedDouble, FIN: Landmark, LAB: FlaskConical, SPO: Trophy, SAF: Users };
export const deptIcon = (code) => DEPT_ICONS[code] || Building2;

/* ---------- status badge ---------- */
const STATUS = {
  pending: ['Pending', Clock],
  cleared: ['Cleared', CircleCheck],
  dues: ['Dues found', TriangleAlert],
  'in-progress': ['In progress', Hourglass],
  completed: ['Completed', CircleCheck],
  cancelled: ['Cancelled', CircleX],
  unpaid: ['Unpaid', TriangleAlert],
  'receipt-submitted': ['Receipt submitted', Receipt],
  paid: ['Paid', CircleCheck],
  waived: ['Waived', CircleCheck],
  active: ['Active', CircleCheck],
  inactive: ['Inactive', CircleX],
};

export function Badge({ status }) {
  const [label, Icon] = STATUS[status] || [status, Clock];
  return (
    <span className={`badge badge-${status}`}>
      <Icon size={12} strokeWidth={2.5} /> {label}
    </span>
  );
}

/* ---------- loading ---------- */
export function Skeleton({ h = 16, w = '100%', r = 8, style }) {
  return <span className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} />;
}

export function PageSkeleton() {
  return (
    <div className="dashboard">
      <Skeleton h={34} w={260} />
      <Skeleton h={16} w={180} style={{ marginTop: 10 }} />
      <div className="stats" style={{ marginTop: 24 }}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={96} r={18} />)}
      </div>
      <Skeleton h={280} r={20} style={{ marginTop: 20 }} />
    </div>
  );
}

export function Spin({ size = 16 }) {
  return <LoaderCircle size={size} className="spin" />;
}

/* ---------- empty state ---------- */
export function Empty({ icon: Icon = Building2, title, children }) {
  return (
    <motion.div className="empty" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
      <div className="empty-icon"><Icon size={26} /></div>
      {title && <strong>{title}</strong>}
      {children && <p>{children}</p>}
    </motion.div>
  );
}

/* ---------- animated number ---------- */
export function CountUp({ value, format = (v) => Math.round(v).toLocaleString(), duration = 900 }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const target = Number(value) || 0;
    const start = performance.now();
    const begin = from.current;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(begin + (target - begin) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(shown)}</>;
}

/* ---------- stat card ---------- */
export function StatCard({ icon: Icon, label, value, format, tone = 'brand', sub }) {
  return (
    <motion.div className={`stat tone-${tone}`} whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
      <div className="stat-icon"><Icon size={20} /></div>
      <div className="stat-body">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{typeof value === 'number' ? <CountUp value={value} format={format} /> : value}</strong>
        {sub && <small className="muted">{sub}</small>}
      </div>
    </motion.div>
  );
}

/* ---------- progress ring ---------- */
export function ProgressRing({ value = 0, size = 150, stroke = 12, label = 'cleared' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          style={{ stroke: pct === 100 ? 'var(--good-solid)' : 'var(--brand-solid)', transition: 'stroke 0.4s' }}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (pct / 100) * c }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">
        <strong><CountUp value={pct} />%</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}

/* ---------- linear progress ---------- */
export function ProgressBar({ value }) {
  return (
    <div className="progress">
      <motion.div className="progress-bar" initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  );
}

/* ---------- side drawer ---------- */
export function Drawer({ open, onClose, title, subtitle, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Rendered into <body> so page transitions (transform/filter) never affect its fixed position
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            className="drawer glass-strong"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <div className="drawer-head">
              <div>
                <h3>{title}</h3>
                {subtitle && <p className="muted small">{subtitle}</p>}
              </div>
              <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="drawer-body">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ---------- drag & drop file zone ---------- */
export function Dropzone({ onFile, label = 'Drop your receipt here or click to browse', busy }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);
  return (
    <motion.div
      className={`dropzone ${over ? 'over' : ''}`}
      whileHover={{ scale: 1.01 }}
      onClick={() => !busy && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!busy && e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
      }}
    >
      {busy ? <Spin size={20} /> : <FileUp size={20} />}
      <span>{busy ? 'Uploading…' : label}</span>
      <small className="muted">JPG, PNG or PDF · max 3 MB</small>
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        hidden
        onChange={(e) => {
          if (e.target.files[0]) onFile(e.target.files[0]);
          e.target.value = '';
        }}
      />
    </motion.div>
  );
}

/* ---------- floating-label input ---------- */
export function Field({ icon: Icon, label, right, className = '', ...props }) {
  return (
    <label className={`field ${className}`}>
      {Icon && <Icon size={17} className="field-icon" />}
      <input {...props} placeholder=" " className={`field-input ${Icon ? 'has-icon' : ''} ${right ? 'has-right' : ''}`} />
      <span className="field-label">{label}</span>
      {right && <span className="field-right">{right}</span>}
    </label>
  );
}

/* ---------- animated tabs ---------- */
export function Tabs({ tabs, value, onChange, id = 'tabs' }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.value} className={`tab ${value === t.value ? 'active' : ''}`} onClick={() => onChange(t.value)}>
          {value === t.value && <motion.span layoutId={`${id}-pill`} className="tab-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
          {t.icon && <t.icon size={15} />}
          <span>{t.label}</span>
          {t.count > 0 && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
