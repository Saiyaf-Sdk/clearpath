import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { CircleCheck, CircleX, ExternalLink, FileText, Receipt } from 'lucide-react';
import api, { errMsg, fileUrl } from '../../api';
import { useDialog } from '../../context/DialogContext';
import { useShell } from '../../components/app/ShellContext';
import useFetch from '../../hooks/useFetch';
import { item, stagger } from '../../components/Page';
import { Badge, Empty, ErrorState, fmtDateTime, lkr, PageHeader, PageSkeleton, Person, Spin, timeAgo } from '../../components/ui';

const isImage = (d) => /\.(png|jpe?g)$/i.test(d.receiptName || d.receiptUrl || '');

export default function OfficerReceipts() {
  const { prompt } = useDialog();
  const { refresh: refreshBadges } = useShell();
  const { data, error, reload, refresh } = useFetch('/dues/department');
  const [working, setWorking] = useState('');

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;

  const waiting = data.filter((d) => d.status === 'receipt-submitted').sort((a, b) => new Date(a.receiptAt || a.updatedAt) - new Date(b.receiptAt || b.updatedAt));
  const recent = data.filter((d) => ['paid', 'waived'].includes(d.status) && d.verifiedBy).slice(0, 8);

  const verify = async (d, approve) => {
    let note = '';
    if (!approve) {
      note = await prompt({ title: 'Reject this receipt?', message: `${d.student?.name} will be asked to upload it again.`, defaultValue: 'Receipt unclear, please upload it again', confirmText: 'Reject receipt', required: true });
      if (note === null) return;
    }
    setWorking(d._id);
    try {
      const { data: res } = await api.patch(`/dues/${d._id}/verify`, { approve, note });
      if (approve) toast.success(res.reopened ? `Paid. ${d.student?.name} has no dues left – clear them on the Requests page.` : 'Receipt approved – due marked as paid');
      else toast.success('Receipt rejected – the student has been told');
      await refresh();
      refreshBadges();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setWorking('');
    }
  };

  return (
    <div className="page">
      <PageHeader title="Receipts to verify" subtitle="Students uploaded these payment receipts. Check each one against your records, then approve or reject it." />

      {waiting.length === 0 ? (
        <section className="card"><Empty icon={Receipt} title="No receipts waiting">When a student uploads a receipt it appears here.</Empty></section>
      ) : (
        <motion.div className="receipt-grid" variants={stagger} initial="hidden" animate="show">
          {waiting.map((d) => (
            <motion.article key={d._id} className="card receipt-card" variants={item}>
              <div className="rc-head">
                <Person name={d.student?.name} sub={d.student?.regNo} />
                <span className="due-amount">{lkr(d.amount)}</span>
              </div>
              <p className="rc-desc">{d.description}</p>
              <a className="rc-preview" href={fileUrl(d.receiptUrl)} target="_blank" rel="noreferrer" title="Open the receipt in a new tab">
                {isImage(d) ? <img src={fileUrl(d.receiptUrl)} alt={`Receipt from ${d.student?.name}`} loading="lazy" /> : (
                  <span className="rc-file"><FileText size={30} /><span>{d.receiptName || 'Receipt.pdf'}</span><small>Click to open <ExternalLink size={11} /></small></span>
                )}
              </a>
              <small className="muted" title={fmtDateTime(d.receiptAt || d.updatedAt)}>Uploaded {timeAgo(d.receiptAt || d.updatedAt)} · due added {timeAgo(d.createdAt)}</small>
              <div className="rc-actions">
                <button className="btn btn-danger btn-sm" disabled={!!working} onClick={() => verify(d, false)}><CircleX size={15} /> Reject</button>
                <button className="btn btn-success btn-sm" disabled={!!working} onClick={() => verify(d, true)}>{working === d._id ? <Spin size={14} /> : <CircleCheck size={15} />} Approve</button>
              </div>
            </motion.article>
          ))}
        </motion.div>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Recently settled</h2>
          <Link to="/officer/dues?status=paid" className="btn btn-ghost btn-sm">Dues register</Link>
        </div>
        {recent.length === 0 ? (
          <p className="muted small">Nothing settled yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Due</th><th>Amount</th><th>Status</th><th className="hide-sm">Verified by</th><th className="hide-sm">When</th></tr></thead>
              <tbody>
                {recent.map((d) => (
                  <tr key={d._id}>
                    <td><Person name={d.student?.name} sub={d.student?.regNo} /></td>
                    <td className="small">{d.description}</td>
                    <td><strong>{lkr(d.amount)}</strong></td>
                    <td><Badge status={d.status} /></td>
                    <td className="hide-sm small">{d.verifiedBy?.name || '—'}</td>
                    <td className="hide-sm small muted">{timeAgo(d.paidAt || d.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
