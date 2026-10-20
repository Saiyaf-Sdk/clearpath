// Small shared UI pieces

const LABELS = {
  pending: 'Pending',
  cleared: 'Cleared',
  dues: 'Dues found',
  'in-progress': 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  unpaid: 'Unpaid',
  'receipt-submitted': 'Receipt submitted',
  paid: 'Paid',
  waived: 'Waived',
};

export function Badge({ status }) {
  return <span className={`badge badge-${status}`}>{LABELS[status] || status}</span>;
}

export function Alert({ type = 'error', children, onClose }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${type}`}>
      <span>{children}</span>
      {onClose && (
        <button className="alert-close" onClick={onClose} aria-label="Close">×</button>
      )}
    </div>
  );
}

export function Spinner() {
  return <div className="spinner" aria-label="Loading" />;
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export const lkr = (n) => `LKR ${Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
