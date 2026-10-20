import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { Award, Copy, Download, ExternalLink, Lock, ShieldCheck } from 'lucide-react';
import api, { API_URL } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { cap, ErrorState, fmtDate, PageHeader, PageSkeleton, ProgressBar, Spin, UniLogo } from '../../components/ui';
import useStudentData from './useStudentData';

const CELEBRATED = 'cp_celebrated';

export default function StudentCertificate() {
  const { user } = useAuth();
  const s = useStudentData();
  const [downloading, setDownloading] = useState(false);
  const fired = useRef(false);

  const done = s.requests.find((r) => r.status === 'completed' && r.certificate);
  const cert = done?.certificate;

  // A little celebration the first time a student sees their certificate
  useEffect(() => {
    if (!cert || fired.current) return undefined;
    fired.current = true;
    let seen = '';
    try { seen = localStorage.getItem(CELEBRATED) || ''; } catch { /* ignore */ }
    if (seen === cert.certificateNo) return undefined;
    const t = setTimeout(() => {
      confetti({ particleCount: 120, spread: 75, origin: { y: 0.3 }, colors: ['#4f46e5', '#818cf8', '#c7d2fe', '#10b981'] });
      try { localStorage.setItem(CELEBRATED, cert.certificateNo); } catch { /* ignore */ }
    }, 400);
    return () => clearTimeout(t);
  }, [cert]);

  if (s.loading) return <PageSkeleton />;
  if (s.error) return <ErrorState message={s.error} onRetry={s.retry} />;

  const verifyLink = cert ? `${window.location.origin}/verify/${cert.certificateNo}` : '';

  const download = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/certificates/${done._id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `ClearPath-${cert.certificateNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Certificate downloaded');
    } catch {
      toast.error('Could not download the certificate. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(verifyLink);
      toast.success('Verification link copied');
    } catch {
      toast.error('Could not copy – select the link and copy it manually');
    }
  };

  if (!cert) {
    const { active } = s;
    return (
      <div className="page">
        <PageHeader title="Clearance certificate" subtitle="Your certificate is issued automatically when every department has cleared you." />
        <section className="card locked">
          <div className="locked-icon"><Lock size={26} /></div>
          <h2>Not issued yet</h2>
          {active ? (
            <>
              <p className="muted">{s.cleared} of {s.total} departments have cleared you so far.</p>
              <div style={{ maxWidth: 360, margin: '14px auto 0' }}><ProgressBar value={s.pct} /></div>
              <Link to="/student/clearance" className="btn btn-primary" style={{ marginTop: 18 }}>Check my request</Link>
            </>
          ) : (
            <>
              <p className="muted">Start a clearance request first. Once every department clears you, the certificate appears here.</p>
              <Link to="/student/clearance" className="btn btn-primary" style={{ marginTop: 18 }}>Start clearance</Link>
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Clearance certificate"
        subtitle="Download the official PDF, or share the verification link with an employer or another university."
        actions={<button className="btn btn-primary" onClick={download} disabled={downloading}>{downloading ? <Spin /> : <Download size={16} />} Download PDF</button>}
      />

      <div className="cert-layout">
        <motion.section className="cert-paper" initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 24 }}>
          <div className="cp-head">
            <UniLogo university={user.university} size={54} />
            <div>
              <strong>{user.university?.name}</strong>
              <small>Digital Clearance &amp; No-Dues Certificate</small>
            </div>
          </div>
          <div className="cp-title"><Award size={18} /> Clearance certificate</div>
          <p className="cp-line">This is to certify that</p>
          <h2 className="cp-name">{user.name}</h2>
          <p className="cp-line">Registration No. <strong>{user.regNo}</strong> · Faculty of {user.faculty}</p>
          <p className="cp-line">has been cleared by every university department and has no outstanding dues, for the purpose of <strong>{done.reason}</strong>.</p>
          <div className="cp-depts">
            {done.items.map((it) => (
              <span key={it.department?._id}><ShieldCheck size={13} /> {it.department?.name}</span>
            ))}
          </div>
          <div className="cp-foot">
            <div>
              <small>Certificate number</small>
              <strong className="mono">{cert.certificateNo}</strong>
              <small style={{ marginTop: 6 }}>Issued on {fmtDate(cert.issuedAt)}</small>
            </div>
            <img className="cp-qr" src={`${API_URL}/api/verify/${encodeURIComponent(cert.certificateNo)}/qr.png`} alt="QR code that opens the verification page" />
          </div>
        </motion.section>

        <aside className="stack">
          <section className="card">
            <h2>Share &amp; verify</h2>
            <p className="muted small">Anyone can check this certificate is genuine – no login needed.</p>
            <div className="copy-row">
              <input className="input" readOnly value={verifyLink} onFocus={(e) => e.target.select()} aria-label="Verification link" />
              <button className="btn btn-soft" onClick={copy} aria-label="Copy link"><Copy size={15} /></button>
            </div>
            <a className="btn btn-ghost btn-sm" href={`/verify/${cert.certificateNo}`} target="_blank" rel="noreferrer" style={{ marginTop: 10 }}><ExternalLink size={14} /> Open the verification page</a>
          </section>
          <section className="card">
            <h2>Details</h2>
            <dl className="kv">
              <dt>Purpose</dt><dd>{cap(done.reason)}</dd>
              <dt>Requested</dt><dd>{fmtDate(done.createdAt)}</dd>
              <dt>Completed</dt><dd>{fmtDate(done.completedAt)}</dd>
              <dt>Departments</dt><dd>{done.items.length} cleared</dd>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
