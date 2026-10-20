import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, ShieldCheck } from 'lucide-react';
import api from '../api';
import { cap, fmtDate, Skeleton, UniLogo } from '../components/ui';

// Animated tick / cross that draws itself
function ResultIcon({ ok }) {
  const color = ok ? '#10b981' : '#ef4444';
  return (
    <motion.svg className="check-svg" viewBox="0 0 84 84" initial="hidden" animate="show">
      <motion.circle
        cx="42" cy="42" r="38" fill="none" stroke={color} strokeWidth="5"
        variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { duration: 0.5 } } }}
      />
      {ok ? (
        <motion.path
          d="M26 43 L37 54 L59 31" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"
          variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { delay: 0.45, duration: 0.4 } } }}
        />
      ) : (
        <>
          <motion.path d="M30 30 L54 54" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { delay: 0.45, duration: 0.25 } } }} />
          <motion.path d="M54 30 L30 54" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { delay: 0.65, duration: 0.25 } } }} />
        </>
      )}
    </motion.svg>
  );
}

export default function Verify() {
  const { certificateNo } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(certificateNo || '');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setInput(certificateNo || '');
    if (!certificateNo) {
      setResult(null);
      return;
    }
    setLoading(true);
    setResult(null);
    api
      .get(`/verify/${encodeURIComponent(certificateNo)}`)
      .then((res) => setResult(res.data))
      .catch((err) => setResult(err.response?.data || { valid: false, message: 'Could not reach the server' }))
      .finally(() => setLoading(false));
  }, [certificateNo]);

  return (
    <div className="card verify-card">
      <div className="center">
        <div className="step-icon" style={{ margin: '0 auto 12px' }}><ShieldCheck size={22} /></div>
        <h1>Verify a certificate</h1>
        <p className="muted">Scan the QR code on a ClearPath certificate, or type its number below.</p>
      </div>

      <form
        className="toolbar"
        style={{ marginTop: 18, marginBottom: 0 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) navigate(`/verify/${input.trim().toUpperCase()}`);
        }}
      >
        <div className="search-box" style={{ maxWidth: 'none' }}>
          <Search size={16} />
          <input className="input" placeholder="CP-UOR-2026-XXXXXXXX" value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
        <button className="btn btn-primary">Verify</button>
      </form>

      {loading && <Skeleton h={220} r={20} style={{ marginTop: 18 }} />}

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.certificateNo || result.message}
            className={`verify-result ${result.valid ? 'ok' : 'bad'}`}
            initial={{ opacity: 0, y: 12 }}
            animate={result.valid ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, x: [0, -10, 10, -6, 6, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
          >
            <ResultIcon ok={result.valid} />
            <h3>{result.message}</h3>
            {result.university && (
              <div className="uni-chip" style={{ margin: '10px auto 0' }}>
                <UniLogo university={result.university} size={36} />
                <div style={{ textAlign: 'left' }}>
                  <small>Issued by</small>
                  <strong>{result.university.name}</strong>
                </div>
              </div>
            )}
            {result.student && (
              <dl className="details">
                <dt>Name</dt><dd>{result.student.name}</dd>
                <dt>Registration no.</dt><dd>{result.student.regNo}</dd>
                <dt>Faculty</dt><dd>{result.student.faculty}</dd>
                <dt>Purpose</dt><dd>{cap(result.reason)}</dd>
                <dt>Certificate no.</dt><dd>{result.certificateNo}</dd>
                <dt>Issued on</dt><dd>{fmtDate(result.issuedAt)}</dd>
              </dl>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
