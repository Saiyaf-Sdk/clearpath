import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Landmark, MapPin, School, Search, X } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { homeFor, useAuth } from '../../context/AuthContext';
import { Empty, ErrorState, Skeleton, UniLogo } from '../../components/ui';
import { facultyPath, rememberedPortal } from '../../utils/portal';

const EASE = [0.22, 1, 0.36, 1];
const short = (name) => name.replace(/^Faculty of\s+/i, '');

// Step 2 of signing in: each faculty has its own offices, staff and portal.
// "Central administration" is for the university admin and the central offices (main library, bursar …).
export default function ChooseFaculty() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') === 'register' ? 'register' : 'login';
  const { data: uni, error, reload } = useFetch(`/universities/${slug}`);
  const [q, setQ] = useState('');

  const faculties = uni?.faculties || [];
  const list = useMemo(() => {
    const term = q.toLowerCase().trim();
    return faculties.filter((f) => !term || f.name.toLowerCase().includes(term) || f.code.toLowerCase().includes(term) || (f.location || '').toLowerCase().includes(term));
  }, [faculties, q]);

  if (user) return <Navigate to={homeFor(user.role)} replace />;
  if (error) {
    return (
      <div className="portal-missing">
        <ErrorState message={error} onRetry={reload} />
        <Link to="/portal" className="btn btn-ghost"><ArrowLeft size={16} /> Choose another university</Link>
      </div>
    );
  }

  const open = (fac) => navigate(facultyPath(slug, fac, next === 'register'));
  const lastFac = rememberedPortal().startsWith(`${slug}/`) ? rememberedPortal().split('/')[1] : '';
  const lastFaculty = lastFac === 'central' ? { slug: 'central', name: 'Central administration' } : faculties.find((f) => f.slug === lastFac);

  return (
    <div className="choose">
      <motion.div className="choose-head" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <div className="choose-uni">
          {uni ? <UniLogo university={uni} size={52} /> : <Skeleton w={52} h={52} r={12} />}
          <div>
            <span className="eyebrow"><School size={14} /> Step 2 of 3</span>
            <strong>{uni?.name || ' '}</strong>
          </div>
        </div>
        <h1>Choose your faculty</h1>
        <p className="muted">
          Every faculty has its own offices and staff. {next === 'register' ? 'Create your account on your own faculty.' : 'Students and faculty staff log in on their faculty; the university admin and central offices use Central administration.'}
        </p>

        {faculties.length > 6 && (
          <div className="choose-search">
            <Search size={18} />
            <input className="input" placeholder="Search by faculty, code or town" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search faculties" />
            {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search"><X size={15} /></button>}
          </div>
        )}

        {lastFaculty && !q && (next === 'login' || lastFaculty.slug !== 'central') && (
          <button type="button" className="choose-last" onClick={() => open(lastFaculty.slug)}>
            <span className="fac-badge">{lastFaculty.slug === 'central' ? <Landmark size={18} /> : lastFaculty.code}</span>
            <span><small>Continue where you left off</small><strong>{lastFaculty.name}</strong></span>
            <ArrowRight size={18} />
          </button>
        )}
      </motion.div>

      {!uni ? (
        <div className="uni-grid">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={86} r={16} />)}</div>
      ) : faculties.length === 0 ? (
        <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
          <Empty icon={School} title="No faculties yet">This university hasn&rsquo;t set up its faculties on ClearPath. Staff can still use Central administration below.</Empty>
        </div>
      ) : list.length === 0 ? (
        <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}><Empty icon={School} title="No faculty found">Try another name or town.</Empty></div>
      ) : (
        <div className="uni-grid">
          {list.map((f, i) => (
            <motion.button
              type="button"
              key={f.slug}
              className="uni-card fac-card"
              onClick={() => open(f.slug)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE, delay: Math.min(i * 0.025, 0.3) }}
            >
              <span className="fac-badge" aria-hidden="true">{f.code}</span>
              <span className="uc-text">
                <strong title={f.name}>{short(f.name)}</strong>
                {f.location && <small><MapPin size={12} style={{ verticalAlign: -2 }} /> {f.location}</small>}
              </span>
              <ArrowRight size={17} className="uc-arrow" />
            </motion.button>
          ))}
        </div>
      )}

      {uni && next === 'login' && (
        <motion.button type="button" className="central-card" onClick={() => open('central')} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: 0.2 }}>
          <span className="fac-badge central"><Landmark size={20} /></span>
          <span className="uc-text">
            <strong>Central administration</strong>
            <small>University admin · Main library · Finance (Bursar) · Student affairs · Hostels · Sports</small>
          </span>
          <ArrowRight size={17} className="uc-arrow" />
        </motion.button>
      )}

      <div className="choose-foot">
        <Link to={`/portal${next === 'register' ? '?next=register' : ''}`} className="auth-link small"><ArrowLeft size={14} style={{ verticalAlign: -2 }} /> Choose another university</Link>
        <span className="muted small">Not sure which faculty? It&rsquo;s the one on your student ID or appointment letter.</span>
      </div>
    </div>
  );
}
