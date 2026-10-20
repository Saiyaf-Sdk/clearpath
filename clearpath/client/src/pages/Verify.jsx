import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { cap, fmtDate, Spinner } from '../components/ui';

export default function Verify() {
  const { certificateNo } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(certificateNo || '');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!certificateNo) return;
    setLoading(true);
    setResult(null);
    api
      .get(`/verify/${encodeURIComponent(certificateNo)}`)
      .then((res) => setResult(res.data))
      .catch((err) => setResult(err.response?.data || { valid: false, message: 'Could not reach the server' }))
      .finally(() => setLoading(false));
  }, [certificateNo]);

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h2>Verify a clearance certificate</h2>
        <p className="muted">Scan the QR code on the certificate or enter its number.</p>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) navigate(`/verify/${input.trim().toUpperCase()}`);
          }}
        >
          <input placeholder="CP-2026-XXXXXXXX" value={input} onChange={(e) => setInput(e.target.value)} />
          <button className="btn btn-primary">Verify</button>
        </form>

        {loading && <Spinner />}
        {result && (
          <div className={`verify-result ${result.valid ? 'ok' : 'bad'}`}>
            <div className="verify-icon">{result.valid ? '✓' : '✕'}</div>
            <h3>{result.message}</h3>
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
          </div>
        )}
      </div>
    </div>
  );
}
