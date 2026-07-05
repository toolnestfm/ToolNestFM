'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  created_at: string;
}

const typeIcon: Record<string, string> = {
  system: 'sparkles',
  job: 'check',
  billing: 'briefcase',
  announcement: 'bell',
};

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function DashboardNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=50');
      const json = (await res.json()) as {
        success: boolean;
        data?: { notifications: Notification[]; unreadCount: number };
      };
      if (json.success && json.data) {
        setItems(json.data.notifications);
        setUnread(json.data.unreadCount);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markAllRead = async () => {
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    setUnread(0);
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
  };

  const markRead = async (id: string) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    });
  };

  const dismiss = async (id: string) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    await fetch('/api/notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    });
    void load();
  };

  const clearRead = async () => {
    await fetch('/api/notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true, readOnly: true }),
    });
    void load();
  };

  return (
    <div className="dash-page">
      <header className="dash-header">
        <div>
          <h1>Notifications</h1>
          <p className="muted">{unread > 0 ? `${unread} unread` : 'All caught up'}</p>
        </div>
        <div className="admin-actions-row" style={{ marginTop: 0 }}>
          {unread > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void markAllRead()}>
              Mark all read
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void clearRead()}>
            Clear read
          </button>
        </div>
      </header>

      <div className="admin-panel glass">
        {loading ? (
          <div className="spinner" style={{ margin: '40px auto' }} />
        ) : items.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 40 }}>No notifications yet.</p>
        ) : (
          <div className="notif-list notif-list-page">
            {items.map((n) => (
              <div key={n.id} className={`notif-item notif-item-row ${n.read ? '' : 'unread'}`}>
                <span className={`notif-item-icon notif-type-${n.type}`}>
                  <Icon name={typeIcon[n.type] ?? 'bell'} size={14} />
                </span>
                <div className="notif-item-body" style={{ flex: 1 }}>
                  {n.href ? (
                    <Link href={n.href} className="notif-item-title" onClick={() => void markRead(n.id)}>
                      {n.title}
                    </Link>
                  ) : (
                    <button type="button" className="notif-item-title notif-title-btn" onClick={() => void markRead(n.id)}>
                      {n.title}
                    </button>
                  )}
                  {n.body && <span className="notif-item-text">{n.body}</span>}
                  <span className="notif-item-time">{timeAgo(n.created_at)}</span>
                </div>
                {!n.read && <span className="notif-unread-dot" />}
                <button
                  type="button"
                  className="icon-btn notif-dismiss"
                  aria-label="Dismiss"
                  onClick={() => void dismiss(n.id)}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
