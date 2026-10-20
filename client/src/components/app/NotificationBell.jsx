import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import api from '../../api';
import { timeAgo } from '../ui';
import { useShell } from './ShellContext';

export const KIND_ICON = { success: CircleCheck, warning: TriangleAlert, info: Info };

export default function NotificationBell() {
  const { badges, refresh } = useShell();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const ref = useRef(null);
  const unread = badges.unread || 0;

  useEffect(() => {
    if (!open) return undefined;
    api.get('/notifications', { params: { limit: 8 } }).then((r) => setItems(r.data.items)).catch(() => setItems([]));
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = async (n) => {
    setOpen(false);
    if (!n.read) {
      await api.patch(`/notifications/${n._id}/read`).catch(() => {});
      refresh();
    }
    if (n.link) navigate(n.link);
  };

  const readAll = async () => {
    await api.patch('/notifications/read-all').catch(() => {});
    setItems((list) => list?.map((n) => ({ ...n, read: true })));
    refresh();
  };

  return (
    <div className="bell-wrap" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} aria-expanded={open}>
        <Bell size={18} />
        {unread > 0 && <span className="bell-dot">{unread > 9 ? '9+' : unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="bell-panel"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            <div className="bell-head">
              <strong>Notifications</strong>
              {unread > 0 && (
                <button className="link-btn" onClick={readAll}><CheckCheck size={14} /> Mark all read</button>
              )}
            </div>
            <div className="bell-list">
              {!items && <div className="bell-empty">Loading…</div>}
              {items && items.length === 0 && <div className="bell-empty">You're all caught up.</div>}
              {items?.map((n) => {
                const Icon = KIND_ICON[n.kind] || Info;
                return (
                  <button key={n._id} className={`bell-item ${n.read ? '' : 'unread'}`} onClick={() => go(n)}>
                    <span className={`bell-kind k-${n.kind}`}><Icon size={15} /></span>
                    <span className="bell-text">
                      <strong>{n.title}</strong>
                      {n.body && <span>{n.body}</span>}
                      <small>{timeAgo(n.createdAt)}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <Link to="/notifications" className="bell-foot" onClick={() => setOpen(false)}>View all notifications</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
