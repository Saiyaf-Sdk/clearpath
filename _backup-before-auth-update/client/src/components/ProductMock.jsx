import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BadgeCheck, CircleCheck, Lock } from 'lucide-react';
import { Badge, deptIcon } from './ui';

const DEPTS = [
  ['LIB', 'Library'],
  ['HOS', 'Hostel'],
  ['FIN', 'Finance Division'],
  ['LAB', 'Faculty Laboratories'],
  ['SPO', 'Sports Division'],
  ['SAF', 'Student Affairs'],
];

function MiniRing({ pct }) {
  const size = 118;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (pct / 100) * c }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{ stroke: pct === 100 ? 'var(--good-solid)' : 'var(--brand-solid)', transition: 'stroke 0.4s' }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">
        <strong>{pct}%</strong>
        <small>cleared</small>
      </div>
    </div>
  );
}

// A self-playing preview of the student dashboard: departments clear one by one,
// then the certificate is issued, then it loops.
export default function ProductMock() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? 7 : 0);

  useEffect(() => {
    if (reduce) return undefined;
    const t = setInterval(() => setStep((s) => (s >= 9 ? 0 : s + 1)), 1400);
    return () => clearInterval(t);
  }, [reduce]);

  const cleared = Math.min(step, DEPTS.length);
  const pct = Math.round((cleared / DEPTS.length) * 100);
  const done = cleared === DEPTS.length;
  const last = cleared > 0 ? DEPTS[cleared - 1][1] : null;

  return (
    <div className="mock-wrap">
      <div className="mock">
        <div className="mock-bar">
          <div className="mock-dots"><i /><i /><i /></div>
          <div className="mock-url"><Lock size={11} /> clearpath.app/student</div>
        </div>
        <div className="mock-body">
          <div className="mock-side">
            <MiniRing pct={pct} />
            <div>
              <div className="mock-greet">Hello, Kasun</div>
              <Badge status={done ? 'completed' : cleared ? 'in-progress' : 'pending'} />
            </div>
          </div>
          <div className="mock-rows">
            {DEPTS.map(([code, name], i) => {
              const Icon = deptIcon(code);
              const status = i < cleared ? 'cleared' : 'pending';
              const review = i === cleared && !done;
              return (
                <div key={code} className={`mock-row ${status} ${review ? 'review' : ''}`}>
                  <span className="ic">{status === 'cleared' ? <CircleCheck size={16} /> : <Icon size={16} />}</span>
                  <span>{name}</span>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={status}
                      style={{ marginLeft: 'auto' }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Badge status={status} />
                    </motion.span>
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notification pop-ups that follow the demo */}
      <AnimatePresence mode="wait">
        {last && !done && (
          <motion.div
            key={last}
            className="mock-toast t1"
            initial={{ opacity: 0, y: 14, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.3 }}
          >
            <span className="ic"><CircleCheck size={17} /></span>
            <div><strong>{last} cleared you</strong><small>Just now · email sent</small></div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {done && (
          <motion.div
            className="mock-toast t2 brand"
            initial={{ opacity: 0, y: 14, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.35 }}
          >
            <span className="ic"><BadgeCheck size={17} /></span>
            <div><strong>Certificate issued</strong><small>CP-2026-8F3A21C9 · QR verified</small></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
