import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Shown once per browser session (the first time someone opens the link).
// Add ?splash to the URL to see it again during a demo.
const KEY = 'cp_splash_seen';

export function shouldShowSplash() {
  try {
    if (new URLSearchParams(window.location.search).has('splash')) return true;
    return sessionStorage.getItem(KEY) !== '1';
  } catch {
    return true;
  }
}

export function markSplashSeen() {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* storage blocked – the splash will simply show again next time */
  }
}

const EASE = [0.22, 1, 0.36, 1];
const CURTAIN = [0.76, 0, 0.24, 1];
const WORD = 'ClearPath';

// Real loading progress (page + fonts), with a short minimum so the intro can finish
function useBootProgress(onDone) {
  const [progress, setProgress] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const minTime = reduce ? 150 : 450;
    const start = performance.now();
    let ready = false;
    let finishedAt = null;
    let value = 0;
    let raf;

    const pageLoaded = new Promise((resolve) => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', resolve, { once: true });
    });
    Promise.all([pageLoaded, document.fonts?.ready ?? Promise.resolve()]).then(() => { ready = true; });
    const safety = setTimeout(() => { ready = true; }, 1500);

    const tick = (now) => {
      const t = now - start;
      const target = ready && t >= minTime ? 100 : Math.min(88, (t / minTime) * 88);
      value += (target - value) * (target === 100 ? 0.28 : 0.16);
      if (target === 100 && value > 99) value = 100;
      setProgress(value);

      if (value === 100) {
        finishedAt = finishedAt ?? now;
        if (now - finishedAt > 120) {
          done.current();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(safety);
    };
  }, []);

  return progress;
}

export default function Splash({ onDone }) {
  const progress = useBootProgress(onDone);
  const reduce = useReducedMotion();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <motion.div
      className="splash"
      initial="hidden"
      animate="show"
      exit="exit"
      role="progressbar"
      aria-label="Loading ClearPath"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      variants={{
        hidden: { clipPath: 'inset(0% 0% 0% 0%)' },
        show: { clipPath: 'inset(0% 0% 0% 0%)' },
        exit: reduce
          ? { opacity: 0, transition: { duration: 0.25 } }
          : { clipPath: 'inset(0% 0% 100% 0%)', transition: { duration: 0.8, ease: CURTAIN, delay: 0.22 } },
      }}
    >
      <motion.div
        className="splash-content"
        variants={{ exit: { opacity: 0, y: -18, transition: { duration: 0.32, ease: 'easeIn' } } }}
      >
        {/* 1. Logo springs in */}
        <motion.div
          className="splash-mark"
          variants={{
            hidden: { scale: 0.4, opacity: 0, rotate: -14 },
            show: { scale: 1, opacity: 1, rotate: 0, transition: { type: 'spring', stiffness: 240, damping: 18 } },
          }}
        >
          {/* 2. Check mark draws itself */}
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <motion.path
              d="M5 12.5l4.5 4.5L19 7.5"
              variants={{
                hidden: { pathLength: 0, opacity: 0 },
                show: { pathLength: 1, opacity: 1, transition: { delay: 0.35, duration: 0.5, ease: EASE, opacity: { delay: 0.35, duration: 0.01 } } },
              }}
            />
          </svg>
          {/* 3. A single light sweep across the logo (CSS) */}
          <span className="splash-shine" />
        </motion.div>

        {/* 4. Letters rise one by one */}
        <div className="splash-word" aria-hidden="true">
          {WORD.split('').map((ch, i) => (
            <span className="splash-ch" key={i}>
              <motion.span
                variants={{ hidden: { y: '110%' }, show: { y: '0%', transition: { delay: 0.55 + i * 0.035, duration: 0.65, ease: EASE } } }}
              >
                {ch}
              </motion.span>
            </span>
          ))}
        </div>

        {/* 5. Hairline that fills with the real loading progress */}
        <motion.div
          className="splash-line"
          variants={{ hidden: { opacity: 0, scaleX: 0.6 }, show: { opacity: 1, scaleX: 1, transition: { delay: 0.9, duration: 0.5, ease: EASE } } }}
        >
          <span style={{ transform: `scaleX(${progress / 100})` }} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
