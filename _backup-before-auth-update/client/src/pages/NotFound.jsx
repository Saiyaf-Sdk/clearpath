import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, LayoutDashboard, LifeBuoy } from 'lucide-react';
import { homeFor, useAuth } from '../context/AuthContext';

export default function NotFound() {
  const { user } = useAuth();
  return (
    <div className="nf">
      <motion.div
        className="nf-code"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
        transition={{ opacity: { duration: 0.4 }, scale: { duration: 0.5 }, y: { duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 } }}
      >
        404
      </motion.div>
      <h1>This page isn't on the clearance list</h1>
      <p>The link may be broken or the page may have moved. Let's get you back on track.</p>
      <div className="hero-cta">
        <Link to="/" className="btn btn-primary"><ArrowLeft size={16} /> Back to home</Link>
        {user && <Link to={homeFor(user.role)} className="btn btn-ghost"><LayoutDashboard size={16} /> Dashboard</Link>}
        <Link to="/help" className="btn btn-ghost"><LifeBuoy size={16} /> Help centre</Link>
      </div>
    </div>
  );
}
