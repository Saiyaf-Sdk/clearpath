import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bell, CheckCheck, Info, Trash2 } from 'lucide-react';
import api from '../../api';
import useFetch from '../../hooks/useFetch';
import { useShell } from '../../components/app/ShellContext';
import { KIND_ICON } from '../../components/app/NotificationBell';
import { Empty, ErrorState, fmtDateTime, PageHeader, PageSkeleton, timeAgo } from '../../components/ui';

export default function Notifications() {
  const navigate = useNavigate();
  const { refresh: refreshBadges } = useShell();
  const { data, error, reload, refresh } = useFetch('/notifications', { params: { limit: 100 } });
  const [filter, setFilter] = useState('all');

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;

  const items = data.items.filter((n) => filter === 'all' || !n.read);

  const open = async (n) => {
    if (!n.read) {
      await api.patch(`/notifications/${n._id}/read`).catch(() => {});
      refreshBadges();
    }
    if (n.link) navigate(n.link);
    else refresh();
  };

  const readAll = async () => {
    await api.patch('/notifications/read-all');
    toast.success('All marked as read');
    await refresh();
    refreshBadges();
  };

  const clearRead = async () => {
    await api.delete('/notifications');
    toast.success('Read notifications cleared');
    refresh();
  };

  return (
    <div className="page">
      <PageHeader
        title="Notifications"
        subtitle="Updates about requests, dues and certificates."
        actions={
          <>
            <button className="btn btn-ghost" onClick={clearRead} disabled={!data.items.some((n) => n.read)}><Trash2 size={16} /> Clear read</button>
            <button className="btn btn-primary" onClick={readAll} disabled={!data.unread}><CheckCheck size={16} /> Mark all read</button>
          </>
        }
      />
      <section className="card">
        <div className="toolbar">
          <div className="seg">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
            <button className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')}>Unread {data.unread ? `(${data.unread})` : ''}</button>
          </div>
        </div>
        {items.length === 0 ? (
          <Empty icon={Bell} title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}>You're all caught up.</Empty>
        ) : (
          <div className="notif-list">
            {items.map((n) => {
              const Icon = KIND_ICON[n.kind] || Info;
              return (
                <button key={n._id} className={`notif ${n.read ? '' : 'unread'}`} onClick={() => open(n)}>
                  <span className={`bell-kind k-${n.kind}`}><Icon size={16} /></span>
                  <span className="notif-text">
                    <strong>{n.title}</strong>
                    {n.body && <span>{n.body}</span>}
                  </span>
                  <small className="muted" title={fmtDateTime(n.createdAt)}>{timeAgo(n.createdAt)}</small>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
