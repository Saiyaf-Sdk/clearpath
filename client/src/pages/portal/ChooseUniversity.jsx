import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Building2, Search, ShieldCheck, X } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { homeFor, useAuth } from '../../context/AuthContext';
import { Empty, Skeleton, UniLogo } from '../../components/ui';
import { rememberedPortal } from '../../utils/portal';

const EASE = [0.22, 1, 0.36, 1];

// Step 1 of signing in: every university has its own portal, so people choose theirs first.
export default function ChooseUniversity() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') === 'register' ? 'register' : 'login';
  const { data, error, reload } = useFetch('/universities');
  const [q, setQ] = useState('');
  const last = rememberedPortal();

  const list = useMemo(() => {
    const term = q.toLowerCase().trim();
    return (data || []).filter((u) => !term || u.name.toLowerCase().includes(term) || u.code.toLowerCase().includes(term) || u.domains.some((d) => d.includes(term)));
  }, [data, q]);
  const lastUni = (data || []).find((u) => u.slug === last);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const open = (u) => navigate(`/portal/${u.slug}${next === 'register' ? '/register' : ''}`);

  return (
    <div className="choose">
      <motion.div className="choose-head" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <span className="eyebrow"><Building2 size={14} /> Step 1 of 2</span>
        <h1>Choose your university</h1>
        <p className="muted">Each university has its own ClearPath portal. Pick yours to {next === 'register' ? 'create your account' : 'log in'}.</p>

        <div className="choose-search">
          <Search size={18} />
          <input className="input" autoFocus placeholder="Search by name, code or email domain (e.g. ruh.ac.lk)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search universities" />
          {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search"><X size={15} /></button>}
        </div>

        {lastUni && !q && (
          <button type="button" className="choose-last" onClick={() => open(lastUni)}>
            <UniLogo university={lastUni} size={36} />
            <span><small>Continue where you left off</small><strong>{lastUni.name}</strong></span>
            <ArrowRight size={18} />
          </button>
        )}
      </motion.div>

      {error && (
        <div className="card error-state" style={{ maxWidth: 560, margin: '0 auto' }}>
          <div><strong>Couldn't load the universities</strong><p className="muted small">{error}</p></div>
          <button className="btn btn-ghost btn-sm" onClick={reload}>Try again</button>
        </div>
      )}

      {!data && !error ? (
        <div className="uni-grid">{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} h={86} r={16} />)}</div>
      ) : list.length === 0 && !error ? (
        <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}><Empty icon={Building2} title="No university found">Try another name or email domain.</Empty></div>
      ) : (
        <div className="uni-grid">
          {list.map((u, i) => (
            <motion.button
              type="button"
              key={u.slug}
              className="uni-card"
              onClick={() => open(u)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE, delay: Math.min(i * 0.025, 0.3) }}
            >
              <UniLogo university={u} size={46} />
              <span className="uc-text">
                <strong>{u.name}</strong>
                <small>{u.domains.map((d) => `@${d}`).join(' · ')}</small>
              </span>
              <ArrowRight size={17} className="uc-arrow" />
            </motion.button>
          ))}
        </div>
      )}

      <div className="choose-foot">
        <span className="muted small">Can't find your university? It may not be on ClearPath yet – ask your university's administration.</span>
        <Link to="/platform-login" className="auth-link small"><ShieldCheck size={14} style={{ verticalAlign: -2 }} /> Platform administrator sign-in</Link>
      </div>
    </div>
  );
}
