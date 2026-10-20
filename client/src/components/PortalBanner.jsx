import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleAlert } from 'lucide-react';
import api from '../api';
import { UniLogo } from './ui';

// Finds the university portal for an email as the user types (e.g. name@ruh.ac.lk → University of Ruhuna)
export function useUniversityFor(email) {
  const [state, setState] = useState({ status: 'idle', university: null });

  useEffect(() => {
    const value = String(email || '').trim().toLowerCase();
    const domain = value.split('@')[1] || '';
    if (!domain.includes('.') || domain.endsWith('.')) {
      setState({ status: 'idle', university: null });
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      api.get('/universities/lookup', { params: { email: value } })
        .then(({ data }) => !cancelled && setState({ status: 'found', university: data }))
        .catch(() => !cancelled && setState({ status: 'unknown', university: null }));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [email]);

  return state;
}

// Shows which university portal the user is entering
export default function PortalBanner({ lookup, staffHint = false }) {
  return (
    <AnimatePresence initial={false} mode="wait">
      {lookup.status === 'found' && (
        <motion.div
          key={lookup.university.id}
          className="portal-banner"
          initial={{ opacity: 0, y: -6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -6, height: 0 }}
          transition={{ duration: 0.25 }}
        >
          <UniLogo university={lookup.university} size={40} />
          <div>
            <strong>{lookup.university.name}</strong>
            <small>You're entering the {lookup.university.shortName} portal</small>
          </div>
        </motion.div>
      )}
      {lookup.status === 'unknown' && !staffHint && (
        <motion.div key="unknown" className="portal-banner unknown" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
          <CircleAlert size={18} style={{ color: 'var(--warn)', flexShrink: 0 }} />
          <div>
            <strong>Not a university email</strong>
            <small>Use the email your university gave you, e.g. name@ruh.ac.lk</small>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
