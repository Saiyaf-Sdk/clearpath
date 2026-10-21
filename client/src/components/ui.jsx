import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../api';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BedDouble, BookOpen, Building2, CircleCheck, CircleX, Clock, FileUp, FlaskConical, Hourglass, Landmark,
  LoaderCircle, Receipt, Search, TriangleAlert, Trophy, Users, X,
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
  activated: ['Account created', CircleCheck],
  invited: ['Not registered yet', Clock],
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

/* ---------- password strength ---------- */
export const passwordScore = (pw = '') => {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  return Math.max(1, s);
};

const STRENGTH = ['', 'Weak', 'Fair', 'Good', 'Strong'];

export function PasswordStrength({ value }) {
  const rules = [
    ['At least 8 characters', value.length >= 8],
    ['Upper and lower case letters', /[a-z]/.test(value) && /[A-Z]/.test(value)],
    ['At least one number', /\d/.test(value)],
  ];
  const score = passwordScore(value);
  return (
    <AnimatePresence initial={false}>
      {value && (
        <motion.div className="pw-help" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
          <div className="pw-meter">
            <div className={`strength s${score}`}><i /><i /><i /><i /></div>
            <span>{STRENGTH[score]}</span>
          </div>
          <ul className="pw-rules">
            {rules.map(([label, ok]) => (
              <li key={label} className={ok ? 'ok' : ''}>
                <CircleCheck size={14} /> {label}
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- university logo ---------- */
// Shows the university's uploaded logo, or a clean initials badge until one is uploaded.
const initialsOf = (u) =>
  (u?.code && u.code.length <= 5 ? u.code : (u?.shortName || u?.name || '?').split(' ').filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).join(''))
    .slice(0, 5)
    .toUpperCase();

export function UniLogo({ university, size = 36 }) {
  const [broken, setBroken] = useState(false);
  if (!university) return null;
  const src = university.logoUrl && !broken ? (university.logoUrl.startsWith('http') ? university.logoUrl : `${API_URL}${university.logoUrl}`) : null;
  return (
    <span className={`uni-logo ${src ? 'has-img' : ''}`} style={{ width: size, height: size, fontSize: Math.max(9, size * 0.28) }} title={university.name}>
      {src ? <img src={src} alt={`${university.name} logo`} onError={() => setBroken(true)} /> : initialsOf(university)}
    </span>
  );
}

/* ---------- more formatting ---------- */
export const initials = (name = '') => name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
export const timeAgo = (d) => {
  if (!d) return '';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  return fmtDate(d);
};
export const daysSince = (d) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 864e5));
export const shortDay = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/* ---------- page header ---------- */
export function PageHeader({ title, subtitle, eyebrow, icon: Icon, actions, children }) {
  return (
    <div className="ph">
      <div className="ph-main">
        {Icon && <span className="ph-icon"><Icon size={22} /></span>}
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
          {children}
        </div>
      </div>
      {actions && <div className="ph-actions">{actions}</div>}
    </div>
  );
}

/* ---------- small building blocks ---------- */
// Profile picture, or the person's initials until they upload one
export function Avatar({ name, src, size, className = '' }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const url = src && !broken ? (/^https?:/.test(src) ? src : `${API_URL}${src}`) : null;
  return (
    <span className={`avatar ${url ? 'has-photo' : ''} ${className}`} style={size ? { width: size, height: size, fontSize: size * 0.36 } : undefined}>
      {url ? <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} /> : initials(name)}
    </span>
  );
}

export function Person({ name, sub, photo }) {
  return (
    <div className="person">
      <Avatar name={name} src={photo} />
      <div><strong>{name || '—'}</strong>{sub && <small>{sub}</small>}</div>
    </div>
  );
}

export function MiniProgress({ value = 0, total = 0 }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mini-progress" title={`${value} of ${total} cleared`}>
      <div className="mini-track"><span style={{ width: `${pct}%` }} className={pct === 100 ? 'done' : ''} /></div>
      <small>{value}/{total}</small>
    </div>
  );
}

export function Pager({ page, pages, total, onPage, label = 'items' }) {
  if (pages <= 1) return total ? <div className="pager"><span className="muted small">{total} {label}</span></div> : null;
  return (
    <div className="pager">
      <span className="muted small">Page {page} of {pages} · {total} {label}</span>
      <div className="row-gap">
        <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', delay = 300 }) {
  const [text, setText] = useState(value || '');
  const first = useRef(true);
  useEffect(() => setText(value || ''), [value]);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return undefined;
    }
    const t = setTimeout(() => { if (text !== (value || '')) onChange(text); }, delay);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="search-box">
      <Search size={16} />
      <input className="input" placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} aria-label={placeholder} />
      {text && <button type="button" className="search-clear" onClick={() => { setText(''); onChange(''); }} aria-label="Clear search"><X size={14} /></button>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card error-state">
      <TriangleAlert size={22} />
      <div>
        <strong>Couldn't load this data</strong>
        <p className="muted small">{message}</p>
      </div>
      {onRetry && <button className="btn btn-ghost btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

/* ---------- CSV export ---------- */
export function downloadCsv(filename, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- audit log wording ---------- */
const ACTIONS = {
  CLEARANCE_SUBMITTED: ['Submitted a clearance request', 'brand'],
  CLEARANCE_CANCELLED: ['Cancelled a request', 'muted'],
  CLEARANCE_CLEARED: ['Cleared a student', 'good'],
  CLEARANCE_FLAGGED: ['Flagged dues', 'warn'],
  CERTIFICATE_ISSUED: ['Certificate issued', 'good'],
  DUE_ADDED: ['Added a due', 'warn'],
  DUE_PAID: ['Marked a due as paid', 'good'],
  DUE_WAIVED: ['Waived a due', 'good'],
  DUE_UNPAID: ['Rejected a receipt', 'bad'],
  DUE_DELETED: ['Deleted a due', 'muted'],
  DUE_UPDATED: ['Edited a due', 'warn'],
  ROSTER_UPDATED: ['Edited a student record', 'muted'],
  CLEARANCE_UPDATED: ['Edited a request', 'muted'],
  RECEIPT_UPLOADED: ['Uploaded a receipt', 'brand'],
  STUDENT_REGISTERED: ['Created an account', 'brand'],
  PASSWORD_CHANGED: ['Changed password', 'muted'],
  PASSWORD_RESET_REQUESTED: ['Requested a password reset', 'muted'],
  PASSWORD_RESET_COMPLETED: ['Reset password', 'muted'],
  USER_CREATED: ['Created a user', 'brand'],
  USER_UPDATED: ['Updated a user', 'muted'],
  USER_DELETED: ['Deleted a user', 'bad'],
  DEPARTMENT_CREATED: ['Added a department', 'brand'],
  DEPARTMENT_UPDATED: ['Updated a department', 'muted'],
  DEPARTMENT_DELETED: ['Deleted a department', 'bad'],
  ROSTER_ADDED: ['Added a student to the list', 'brand'],
  ROSTER_IMPORTED: ['Imported the student list', 'brand'],
  ROSTER_REMOVED: ['Removed a student from the list', 'muted'],
  UNIVERSITY_CREATED: ['Added a university', 'brand'],
  UNIVERSITY_UPDATED: ['Updated a university', 'muted'],
  UNIVERSITY_LOGO_UPDATED: ['Uploaded a university logo', 'brand'],
  UNIVERSITY_LOGO_REMOVED: ['Removed a university logo', 'muted'],
  UNIVERSITY_ADMIN_CREATED: ['Added a university admin', 'brand'],
};
export const actionLabel = (a) => ACTIONS[a]?.[0] || cap(String(a || '').toLowerCase().replace(/_/g, ' '));
export const actionTone = (a) => ACTIONS[a]?.[1] || 'muted';

export function ActivityList({ items, empty = 'No activity yet', showActor = true }) {
  if (!items?.length) return <p className="muted small" style={{ padding: '8px 0' }}>{empty}</p>;
  return (
    <ul className="activity">
      {items.map((l) => (
        <li key={l._id}>
          <span className={`act-dot t-${actionTone(l.action)}`} />
          <div>
            <div className="act-line">
              {showActor && <strong>{l.actor?.name || 'System'}</strong>}
              <span>{showActor ? actionLabel(l.action).replace(/^./, (c) => c.toLowerCase()) : actionLabel(l.action)}</span>
            </div>
            {l.details && <div className="act-details">{l.details}</div>}
            <small className="muted" title={fmtDateTime(l.createdAt)}>{timeAgo(l.createdAt)}</small>
          </div>
        </li>
      ))}
    </ul>
  );
}
