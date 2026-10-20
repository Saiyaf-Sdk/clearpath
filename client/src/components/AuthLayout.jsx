import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, QrCode, ShieldCheck, Users } from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1];

const DEFAULT_POINTS = [
  { icon: Users, title: 'One request, every department', text: 'Library, Hostel, Finance and more review it in parallel.' },
  { icon: Activity, title: 'Live status', text: 'See exactly who has cleared you and what is outstanding.' },
  { icon: QrCode, title: 'Verified certificate', text: 'Download a PDF with a QR code anyone can check.' },
];

// Shared layout for Log in, Create account, Forgot password and Reset password.
// Left: a short message over the live background. Right: a frosted-glass card with the form.
export default function AuthLayout({ title, text, points = DEFAULT_POINTS, children }) {
  return (
    <div className="auth-shell">
      <motion.aside
        className="auth-intro"
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <Link to="/" className="brand">
          <span className="brand-mark">✓</span> ClearPath
        </Link>
        <h1 className="auth-headline">{title}</h1>
        <p className="auth-lead">{text}</p>
        <ul className="auth-points">
          {points.map((p, i) => (
            <motion.li
              key={p.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.09, duration: 0.5, ease: EASE }}
            >
              <span className="ic"><p.icon size={17} /></span>
              <div>
                <strong>{p.title}</strong>
                <small>{p.text}</small>
              </div>
            </motion.li>
          ))}
        </ul>
        <div className="auth-trust"><ShieldCheck size={15} /> Encrypted passwords · signed sessions · role-based access</div>
      </motion.aside>

      <motion.section
        className="auth-card"
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.65, ease: EASE, delay: 0.08 }}
      >
        {children}
      </motion.section>
    </div>
  );
}

// Animated error message used by all auth forms
export function FormError({ children }) {
  return (
    <motion.div
      className="form-error"
      role="alert"
      initial={{ opacity: 0, height: 0, marginTop: -6 }}
      animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: -6 }}
      transition={{ duration: 0.25 }}
    >
      {children}
    </motion.div>
  );
}
