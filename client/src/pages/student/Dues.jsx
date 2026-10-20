import { Fragment, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Building2, CircleCheck, FileText, Info, Receipt, Wallet } from 'lucide-react';
import api, { errMsg, fileUrl } from '../../api';
import { useShell } from '../../components/app/ShellContext';
import { item, stagger } from '../../components/Page';
import { Badge, deptIcon, Dropzone, Empty, ErrorState, fmtDate, lkr, PageHeader, PageSkeleton, StatCard } from '../../components/ui';
import useStudentData from './useStudentData';

const OPEN = ['unpaid', 'receipt-submitted'];
const FILTERS = [
  { value: 'open', label: 'To settle' },
  { value: 'settled', label: 'Settled' },
  { value: 'all', label: 'All' },
];

export default function StudentDues() {
  const s = useStudentData();
  const { refresh } = useShell();
  const [uploading, setUploading] = useState(null);
  const [filter, setFilter] = useState('open');

  if (s.loading) return <PageSkeleton />;
  if (s.error) return <ErrorState message={s.error} onRetry={s.retry} />;

  const paidTotal = s.dues.filter((d) => d.status === 'paid').reduce((a, d) => a + d.amount, 0);
  const shown = s.dues.filter((d) => (filter === 'all' ? true : filter === 'open' ? OPEN.includes(d.status) : !OPEN.includes(d.status)));

  const upload = async (dueId, file) => {
    if (file.size > 3 * 1024 * 1024) return toast.error('File is larger than 3 MB');
    const data = new FormData();
    data.append('receipt', file);
    setUploading(dueId);
    try {
      await api.post(`/dues/${dueId}/receipt`, data);
      toast.success('Receipt uploaded. The department will verify it soon.');
      await s.reload();
      refresh();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="page">
      <PageHeader title="Dues & payments" subtitle="Anything you owe a department, and the receipts you have uploaded." />

      <motion.div className="stats stats-3" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={item}><StatCard icon={Wallet} tone={s.owed > 0 ? 'warn' : 'good'} label="Outstanding" value={s.owed} format={lkr} sub={`${s.unpaid.length} unpaid`} /></motion.div>
        <motion.div variants={item}><StatCard icon={Receipt} tone="brand" label="Receipts under review" value={s.review.length} sub="Waiting for the department" /></motion.div>
        <motion.div variants={item}><StatCard icon={CircleCheck} tone="good" label="Paid so far" value={paidTotal} format={lkr} /></motion.div>
      </motion.div>

      <div className="grid-main">
        <section className="card">
          <div className="card-head">
            <h2>Your dues</h2>
            <div className="seg">
              {FILTERS.map((f) => (
                <button key={f.value} className={filter === f.value ? 'active' : ''} onClick={() => setFilter(f.value)}>{f.label}</button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <Empty icon={Wallet} title={filter === 'open' ? 'Nothing to settle' : 'No dues here'}>
              {filter === 'open' ? "You don't owe anything to any department right now." : 'Nothing matches this filter.'}
            </Empty>
          ) : (
            <motion.div className="due-list" variants={stagger} initial="hidden" animate="show">
              {shown.map((d) => {
                const Icon = deptIcon(d.department?.code);
                return (
                  <motion.div className="due-card" key={d._id} variants={item}>
                    <div className="due-top">
                      <div>
                        <div className="due-dept"><Icon size={14} /> {d.department?.name}</div>
                        <strong>{d.description}</strong>
                        <div className="muted small">Added {fmtDate(d.createdAt)}{d.paidAt ? ` · settled ${fmtDate(d.paidAt)}` : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="due-amount">{lkr(d.amount)}</div>
                        <Badge status={d.status} />
                      </div>
                    </div>
                    {d.officerNote && <div className={`note ${d.status === 'unpaid' ? 'note-warn' : ''}`}>Officer: {d.officerNote}</div>}
                    {OPEN.includes(d.status) && (
                      <Dropzone
                        busy={uploading === d._id}
                        label={d.status === 'unpaid' ? 'Drop your payment receipt here or click to upload' : 'Receipt submitted · drop a new file to replace it'}
                        onFile={(f) => upload(d._id, f)}
                      />
                    )}
                    {d.receiptUrl && (
                      <a className="btn btn-soft btn-sm" style={{ alignSelf: 'flex-start' }} href={fileUrl(d.receiptUrl)} target="_blank" rel="noreferrer">
                        <FileText size={14} /> View uploaded receipt
                      </a>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </section>

        <aside className="stack">
          <section className="card">
            <h2><Info size={17} className="text-brand" style={{ verticalAlign: -3, marginRight: 6 }} />How to pay</h2>
            <ol className="steps-list">
              <li>Pay at the department counter, or deposit the amount to the university account at any bank branch.</li>
              <li>Take a clear photo or PDF of the receipt (JPG, PNG or PDF, up to 3 MB).</li>
              <li>Upload it on the due. The department checks it and marks the due as paid.</li>
              <li>When a department has no dues left, it does a final check and clears you.</li>
            </ol>
          </section>
          <section className="card">
            <h2><Building2 size={17} className="text-brand" style={{ verticalAlign: -3, marginRight: 6 }} />By department</h2>
            {s.dues.length === 0 ? (
              <p className="muted small">No dues recorded.</p>
            ) : (
              <dl className="kv">
                {Object.entries(
                  s.dues.filter((d) => OPEN.includes(d.status)).reduce((m, d) => ({ ...m, [d.department?.name]: (m[d.department?.name] || 0) + d.amount }), {})
                ).map(([name, amt]) => (
                  <Fragment key={name}><dt>{name}</dt><dd>{lkr(amt)}</dd></Fragment>
                ))}
                {s.owed === 0 && (<><dt>Outstanding</dt><dd>None</dd></>)}
              </dl>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
