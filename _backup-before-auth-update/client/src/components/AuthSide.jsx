import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileUp, QrCode, Send, Users } from 'lucide-react';

const steps = [
  [Send, 'Submit one online request'],
  [Users, 'Six departments review in parallel'],
  [FileUp, 'Pay dues and upload receipts'],
  [QrCode, 'Download a QR-verified certificate'],
];

// Deep-indigo side panel used on Login and Register
export default function AuthSide({ title, text }) {
  return (
    <div className="auth-side">
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Link to="/" className="brand">
          <span className="brand-mark">✓</span> ClearPath
        </Link>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <div className="auth-steps">
        {steps.map(([Icon, label], i) => (
          <motion.div
            key={label}
            className="auth-step"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.08, duration: 0.35 }}
          >
            <span className="num"><Icon size={16} /></span>
            <span>{label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
