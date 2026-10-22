import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRightLeft, Award, CalendarDays, CircleHelp, GraduationCap, ListChecks, LogOut, PencilLine, Send, UserRound } from 'lucide-react';
import api, { errMsg } from '../../api';
import { useDialog } from '../../context/DialogContext';
import { useShell } from '../../components/app/ShellContext';
import { item, stagger } from '../../components/Page';
import { Badge, cap, deptIcon, ErrorState, fmtDate, fmtDateTime, PageHeader, PageSkeleton, ProgressBar, Spin } from '../../components/ui';
import useStudentData from './useStudentData';

const REASONS = [
  { value: 'graduation', label: 'Graduation', hint: 'Final transcript / convocation', icon: GraduationCap },
  { value: 'transfer', label: 'Transfer', hint: 'Moving to another university', icon: ArrowRightLeft },
  { value: 'withdrawal', label: 'Withdrawal', hint: 'Leaving the programme', icon: LogOut },
  { value: 'other', label: 'Other', hint: 'Any other reason', icon: CircleHelp },
];

export default function StudentClearance() {
  const s = useStudentData();
  const { confirm } = useDialog();
  const { refresh } = useShell();
  const [form, setForm] = useState({ reason: 'graduation', note: '' });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // { reason, note } while editing the open request

  if (s.loading) return <PageSkeleton />;
  if (s.error) return <ErrorState message={s.error} onRetry={s.retry} />;

  const { active } = s;
  const canStart = !active || active.status === 'completed';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/clearances', form);
      toast.success('Request submitted. Every department has been notified.');
      setForm({ reason: 'graduation', note: '' });
      await s.reload();
      refresh();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/clearances/${active._id}`, editing);
      toast.success('Request updated');
      setEditing(null);
      await s.reload();
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
      await s.reload();
      refresh();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const startForm = (
    <motion.section className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h2>{active?.status === 'completed' ? 'Start a new clearance request' : 'Start your clearance'}</h2>
      <p className="muted">Choose why you need clearance. Your request goes to every department at once.</p>
      <form onSubmit={submit}>
        <div className="reason-grid">
          {REASONS.map((r) => (
            <button type="button" key={r.value} className={`reason ${form.reason === r.value ? 'selected' : ''}`} onClick={() => setForm({ ...form, reason: r.value })} aria-pressed={form.reason === r.value}>
              <r.icon size={20} />
              <strong>{r.label}</strong>
              <small>{r.hint}</small>
            </button>
          ))}
        </div>
        <label className="label" style={{ marginTop: 6 }}>
          Note for the departments (optional)
          <textarea className="input" rows={3} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. I need the certificate before the convocation on 15 December." />
        </label>
        <div className="row-gap" style={{ marginTop: 14 }}>
          <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? <Spin /> : <Send size={17} />} Submit request</button>
          <span className="muted small">Departments where you already owe something will show "Dues found" straight away.</span>
        </div>
      </form>
    </motion.section>
  );

  return (
    <div className="page">
      <PageHeader title="Clearance request" subtitle="Follow each department's decision on your request." />

      {active && active.status !== 'completed' && (
        <section className="card">
          <div className="req-head">
            <div>
              <div className="row-gap"><Badge status={active.status} /><span className="muted small"><CalendarDays size={13} style={{ verticalAlign: -2 }} /> Submitted {fmtDateTime(active.createdAt)}</span></div>
              <h2 style={{ marginTop: 8 }}>{cap(active.reason)} clearance</h2>
              {active.note && <p className="muted small">Your note: “{active.note}”</p>}
            </div>
            <div className="req-progress">
              <strong>{s.cleared} / {s.total}</strong>
              <span className="muted small">departments cleared</span>
              <ProgressBar value={s.pct} />
            </div>
          </div>
          <div className="row-gap" style={{ marginTop: 12 }}>
            {active.items.every((i) => !i.actionedBy) && !editing && (
              <button className="btn btn-soft btn-sm" onClick={() => setEditing({ reason: active.reason, note: active.note || '' })}><PencilLine size={14} /> Edit request</button>
            )}
            {active.items.every((i) => i.status !== 'cleared') && (
              <button className="btn btn-ghost btn-sm" onClick={() => cancel(active._id)}>Cancel request</button>
            )}
          </div>
          {editing && (
            <form className="edit-request" onSubmit={saveEdit}>
              <label className="label">Reason
                <select className="input" value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })}>
                  {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </label>
              <label className="label">Note for the departments
                <textarea className="input" rows={3} maxLength={500} value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
              </label>
              <small className="field-hint">You can edit your request until the first department reviews it.</small>
              <div className="row-gap">
                <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? <Spin size={14} /> : null} Save changes</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </form>
          )}
        </section>
      )}

      {active?.status === 'completed' && (
        <section className="card done-banner">
          <Award size={22} />
          <div>
            <strong>Your last request is complete</strong>
            <p className="muted small">Completed {fmtDate(active.completedAt)} · certificate {active.certificate?.certificateNo}</p>
          </div>
          <Link to="/student/certificate" className="btn btn-success btn-sm">View certificate</Link>
        </section>
      )}

      {active && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Department tracker</h2>
              <p className="muted small">Each office reviews your request on its own. Remarks from the officer appear here.</p>
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
                      <span className={`office-tag ${it.department?.faculty ? 'fac' : ''}`}>{it.department?.faculty ? 'Faculty office' : 'Central office'}</span>
                      <p>{it.remark || (it.status === 'pending' ? 'Waiting for review' : '')}</p>
                      {it.actionedAt && (
                        <small className="muted">
                          {fmtDateTime(it.actionedAt)}
                          {it.actionedBy?.name && <> · <UserRound size={11} style={{ verticalAlign: -1 }} /> {it.actionedBy.name}</>}
                        </small>
                      )}
                    </div>
                    <div className="tl-side">
                      <Badge status={it.status} />
                      {it.status === 'dues' && <Link to="/student/dues" className="btn btn-soft btn-sm">Pay dues</Link>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </section>
      )}

      {canStart && startForm}

      <section className="card">
        <h2>Request history</h2>
        {s.history.length === 0 ? (
          <p className="muted small" style={{ marginTop: 6 }}>No earlier requests.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead><tr><th>Reason</th><th>Submitted</th><th>Finished</th><th>Departments</th><th>Status</th></tr></thead>
              <tbody>
                {s.history.map((r) => (
                  <tr key={r._id}>
                    <td><strong>{cap(r.reason)}</strong></td>
                    <td>{fmtDate(r.createdAt)}</td>
                    <td>{r.completedAt ? fmtDate(r.completedAt) : '—'}</td>
                    <td>{r.progress ? `${r.progress.cleared}/${r.progress.total} cleared` : '—'}</td>
                    <td><Badge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!active && (
        <p className="muted small center"><ListChecks size={13} style={{ verticalAlign: -2 }} /> Tip: check “Dues &amp; payments” first – paying known dues early makes clearance faster.</p>
      )}
    </div>
  );
}
