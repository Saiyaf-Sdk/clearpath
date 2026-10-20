import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import {
  ArrowRightLeft, CalendarDays, Download, ExternalLink, FileText, GraduationCap, CircleHelp, ListChecks,
  LogOut, PartyPopper, Send, Wallet,
} from 'lucide-react';
import api, { errMsg, fileUrl } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { item, stagger } from '../../components/Page';
import { Badge, cap, deptIcon, Dropzone, Empty, fmtDate, lkr, PageSkeleton, ProgressRing, Spin, StatCard } from '../../components/ui';

const REASONS = [
  { value: 'graduation', label: 'Graduation', hint: 'Final transcript / convocation', icon: GraduationCap },
  { value: 'transfer', label: 'Transfer', hint: 'Moving to another university', icon: ArrowRightLeft },
  { value: 'withdrawal', label: 'Withdrawal', hint: 'Leaving the programme', icon: LogOut },
  { value: 'other', label: 'Other', hint: 'Any other reason', icon: CircleHelp },
];

const OPEN = ['unpaid', 'receipt-submitted'];

export default function StudentDashboard() {
  const { user } = useAuth();
  const { confirm } = useDialog();
  const [requests, setRequests] = useState([]);
  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ reason: 'graduation', note: '' });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const celebrated = useRef(false);

  const load = async () => {
    try {
      const [r, d] = await Promise.all([api.get('/clearances/my'), api.get('/dues/my')]);
      setRequests(r.data);
      setDues(d.data);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const active = requests.find((r) => ['pending', 'in-progress', 'completed'].includes(r.status));
  const history = requests.filter((r) => r !== active);
  const outstanding = dues.filter((d) => OPEN.includes(d.status));
  const owed = outstanding.reduce((s, d) => s + d.amount, 0);
  const clearedCount = active ? active.items.filter((i) => i.status === 'cleared').length : 0;
  const pct = active && active.items.length ? Math.round((clearedCount / active.items.length) * 100) : 0;

  // Confetti once when the student opens a completed request
  useEffect(() => {
    if (active?.status === 'completed' && !celebrated.current) {
      celebrated.current = true;
      const t = setTimeout(() => {
        confetti({ particleCount: 140, spread: 80, origin: { y: 0.35 }, colors: ['#4f46e5', '#818cf8', '#c7d2fe', '#10b981'] });
      }, 500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [active?.status]);

  const submitRequest = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/clearances', form);
      toast.success('Request submitted! Every department has been notified.');
      await load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id) => {
    const ok = await confirm({ title: 'Cancel this request?', message: 'You can submit a new one at any time.', confirmText: 'Yes, cancel', tone: 'danger' });
    if (!ok) return;
    try {
      await api.patch(`/clearances/${id}/cancel`);
      toast.success('Request cancelled');
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const uploadReceipt = async (dueId, file) => {
    if (file.size > 3 * 1024 * 1024) return toast.error('File is larger than 3 MB');
    const data = new FormData();
    data.append('receipt', file);
    setUploading(dueId);
    try {
      await api.post(`/dues/${dueId}/receipt`, data);
      toast.success('Receipt uploaded. The department will verify it soon.');
      await load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setUploading(null);
    }
  };

  const downloadCert = async (requestId, certNo) => {
    setDownloading(true);
    try {
      const res = await api.get(`/certificates/${requestId}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `ClearPath-${certNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Certificate downloaded');
    } catch {
      toast.error('Could not download the certificate');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <span className="eyebrow">Student dashboard</span>
          <h1>Hello, {user.name.split(' ')[0]} 👋</h1>
          <p className="muted">{user.regNo} · Faculty of {user.faculty}</p>
        </div>
      </div>

      <motion.div className="stats" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={item}><StatCard icon={ListChecks} tone="brand" label="Request status" value={active ? cap(active.status.replace('-', ' ')) : 'Not started'} /></motion.div>
        <motion.div variants={item}><StatCard icon={GraduationCap} tone="good" label="Departments cleared" value={active ? `${clearedCount} / ${active.items.length}` : '—'} /></motion.div>
        <motion.div variants={item}><StatCard icon={Wallet} tone={owed > 0 ? 'warn' : 'brand'} label="Outstanding dues" value={owed} format={lkr} /></motion.div>
      </motion.div>

      {/* Certificate banner */}
      <AnimatePresence>
        {active?.status === 'completed' && active.certificate && (
          <motion.div className="cert-card" initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 22 }}>
            <div style={{ position: 'relative' }}>
              <span className="cert-badge"><PartyPopper size={14} /> Fully cleared</span>
              <h2 style={{ marginTop: 10 }}>Congratulations, your clearance is complete</h2>
              <p style={{ opacity: 0.9, marginTop: 4 }}>
                Certificate <span className="cert-no">{active.certificate.certificateNo}</span> · issued {fmtDate(active.certificate.issuedAt)}
              </p>
            </div>
            <div className="row-gap" style={{ position: 'relative' }}>
              <button className="btn btn-white btn-lg" onClick={() => downloadCert(active._id, active.certificate.certificateNo)} disabled={downloading}>
                {downloading ? <Spin /> : <Download size={18} />} Download PDF
              </button>
              <a className="btn btn-ghost btn-lg" href={`/verify/${active.certificate.certificateNo}`} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> Verify page
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!active && (
        <motion.section className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h2>Start your clearance</h2>
          <p className="muted">Choose why you need clearance. Your request goes to every department at once.</p>
          <form onSubmit={submitRequest}>
            <div className="reason-grid">
              {REASONS.map((r) => (
                <motion.button
                  type="button"
                  key={r.value}
                  whileTap={{ scale: 0.97 }}
                  className={`reason ${form.reason === r.value ? 'selected' : ''}`}
                  onClick={() => setForm({ ...form, reason: r.value })}
                >
                  <r.icon size={20} />
                  <strong>{r.label}</strong>
                  <small>{r.hint}</small>
                </motion.button>
              ))}
            </div>
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <input className="input" style={{ flex: 1, minWidth: 220 }} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note for departments (optional)" />
              <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? <Spin /> : <Send size={17} />} Submit request</button>
            </div>
          </form>
        </motion.section>
      )}

      {active && (
        <div className="split">
          {/* Progress overview */}
          <motion.section className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="overview" style={{ flexDirection: 'column', textAlign: 'center' }}>
              <ProgressRing value={pct} size={170} />
              <div className="overview-info" style={{ alignItems: 'center' }}>
                <Badge status={active.status} />
                <h2 style={{ marginTop: 4 }}>{cap(active.reason)} clearance</h2>
                <p className="muted small"><CalendarDays size={13} style={{ verticalAlign: -2 }} /> Submitted {fmtDate(active.createdAt)}</p>
                <div className="mini-stats" style={{ justifyContent: 'center' }}>
                  <div className="mini-stat"><strong>{active.items.filter((i) => i.status === 'cleared').length}</strong><span>Cleared</span></div>
                  <div className="mini-stat"><strong>{active.items.filter((i) => i.status === 'pending').length}</strong><span>Pending</span></div>
                  <div className="mini-stat"><strong style={{ color: 'var(--warn)' }}>{active.items.filter((i) => i.status === 'dues').length}</strong><span>Dues</span></div>
                </div>
                {active.status !== 'completed' && active.items.every((i) => i.status !== 'cleared') && (
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => cancel(active._id)}>Cancel request</button>
                )}
              </div>
            </div>
          </motion.section>

          {/* Department timeline */}
          <motion.section className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <div className="card-head">
              <div>
                <h2>Department tracker</h2>
                <p className="muted small">Live status from each office</p>
              </div>
            </div>
            <motion.div className="timeline" variants={stagger} initial="hidden" animate="show">
              {active.items.map((it) => {
                const Icon = deptIcon(it.department?.code);
                return (
                  <motion.div className={`tl-item ${it.status}`} key={it.department?._id} variants={item}>
                    <div className="tl-dot"><Icon size={19} /></div>
                    <div className="tl-content">
                      <div>
                        <strong>{it.department?.name}</strong>
                        <p>{it.remark || (it.status === 'pending' ? 'Waiting for review' : '')}</p>
                        {it.actionedAt && <small className="muted">Updated {fmtDate(it.actionedAt)}</small>}
                      </div>
                      <Badge status={it.status} />
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.section>
        </div>
      )}

      {/* Dues */}
      <section className="card">
        <div className="card-head">
          <div>
            <h2>My dues</h2>
            <p className="muted small">Pay at the department counter or by bank transfer, then upload the receipt here.</p>
          </div>
          {owed > 0 && <span className="badge badge-unpaid">{lkr(owed)} outstanding</span>}
        </div>
        {dues.length === 0 ? (
          <Empty icon={Wallet} title="No dues recorded">You don't owe anything to any department. 🎉</Empty>
        ) : (
          <motion.div className="due-list" variants={stagger} initial="hidden" animate="show">
            {dues.map((d) => {
              const Icon = deptIcon(d.department?.code);
              return (
                <motion.div className="due-card" key={d._id} variants={item} layout>
                  <div className="due-top">
                    <div>
                      <div className="due-dept"><Icon size={14} /> {d.department?.name}</div>
                      <strong>{d.description}</strong>
                      <div className="muted small">Added {fmtDate(d.createdAt)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="due-amount">{lkr(d.amount)}</div>
                      <Badge status={d.status} />
                    </div>
                  </div>
                  {d.officerNote && d.status === 'unpaid' && <div className="note">Officer: {d.officerNote}</div>}
                  {OPEN.includes(d.status) && (
                    <Dropzone
                      busy={uploading === d._id}
                      label={d.status === 'unpaid' ? 'Drop your payment receipt here or click to upload' : 'Receipt submitted · drop a new file to replace it'}
                      onFile={(f) => uploadReceipt(d._id, f)}
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

      {history.length > 0 && (
        <section className="card">
          <h2>Previous requests</h2>
          <div className="row-list" style={{ marginTop: 12 }}>
            {history.map((r) => (
              <div key={r._id} className="row-gap" style={{ justifyContent: 'space-between' }}>
                <span>{cap(r.reason)} · <span className="muted">{fmtDate(r.createdAt)}</span></span>
                <Badge status={r.status} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
