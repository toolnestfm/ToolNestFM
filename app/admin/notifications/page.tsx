'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminPage';
import { useUI } from '@/components/GlobalUI';
import { adminFetch } from '@/lib/admin-client';

type Broadcast = {
  id: string;
  actor_id: string | null;
  title: string;
  body: string | null;
  href: string | null;
  target_type: string;
  target_value: string | null;
  sent_count: number;
  created_at: string;
};

type Stats = {
  totalNotifications: number;
  unreadNotifications: number;
  totalUsers: number;
};

export default function AdminNotificationsPage() {
  const { toast } = useUI();
  const [stats, setStats] = useState<Stats | null>(null);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [href, setHref] = useState('');
  const [target, setTarget] = useState<'all' | 'FREE' | 'PRO' | 'ENTERPRISE'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ broadcasts: Broadcast[]; stats: Stats; pages: number }>(
        `/api/admin/notifications?page=${page}`,
      );
      setBroadcasts(data.broadcasts);
      setStats(data.stats);
      setPages(data.pages || 1);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Load failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => { void load(); }, [load]);

  const send = async () => {
    if (!title.trim()) { toast('Title is required', 'error'); return; }
    setSending(true);
    try {
      const data = await adminFetch<{ sent: number; target: string }>('/api/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({ title, body, href, target: target === 'all' ? 'all' : target }),
      });
      toast(`Sent to ${data.sent} user${data.sent === 1 ? '' : 's'} (${data.target})`, 'success');
      setTitle('');
      setBody('');
      setHref('');
      setPage(1);
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Send failed', 'error');
    } finally {
      setSending(false);
    }
  };

  const targetLabel = (b: Broadcast) => {
    if (b.target_type === 'all') return 'All users';
    if (b.target_type === 'plan') return `${b.target_value} plan`;
    if (b.target_type === 'user') return `User ${b.target_value?.slice(0, 8)}…`;
    return b.target_type;
  };

  return (
    <div>
      <AdminPageHeader
        title="Notifications"
        subtitle="Broadcast announcements to users — delivered instantly in their notification bell"
      />

      {stats && (
        <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="admin-stat-card glass accent-blue">
            <span className="muted">Total users</span>
            <b>{stats.totalUsers.toLocaleString()}</b>
          </div>
          <div className="admin-stat-card glass accent-green">
            <span className="muted">Notifications sent (all time)</span>
            <b>{stats.totalNotifications.toLocaleString()}</b>
          </div>
          <div className="admin-stat-card glass accent-orange">
            <span className="muted">Unread across platform</span>
            <b>{stats.unreadNotifications.toLocaleString()}</b>
          </div>
        </div>
      )}

      <div className="admin-panels">
        <div className="admin-panel glass">
          <h2>Send broadcast</h2>
          <div className="field mb-4">
            <label>Title</label>
            <input className="admin-input w-full" placeholder="e.g. New AI tools launched!" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field mb-4">
            <label>Message</label>
            <textarea className="admin-textarea w-full" rows={4} placeholder="Optional details…" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="field mb-4">
            <label>Link (optional)</label>
            <input className="admin-input w-full" placeholder="/tools/ai/ai-chat" value={href} onChange={(e) => setHref(e.target.value)} />
          </div>
          <div className="field mb-4">
            <label>Audience</label>
            <select className="admin-select w-full" value={target} onChange={(e) => setTarget(e.target.value as typeof target)}>
              <option value="all">All users</option>
              <option value="FREE">Free plan only</option>
              <option value="PRO">Pro plan only</option>
              <option value="ENTERPRISE">Enterprise only</option>
            </select>
          </div>
          <button type="button" className="btn btn-primary btn-sm" disabled={sending || !title.trim()} onClick={() => void send()}>
            {sending ? 'Sending…' : 'Send notification'}
          </button>
        </div>

        <div className="admin-panel glass">
          <h2>Broadcast history</h2>
          {loading ? (
            <div className="spinner" style={{ margin: '24px auto' }} />
          ) : broadcasts.length === 0 ? (
            <p className="muted">No broadcasts yet. Send your first announcement.</p>
          ) : (
            <ul className="admin-rank-list">
              {broadcasts.map((b) => (
                <li key={b.id}>
                  <span>
                    <b>{b.title}</b>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {targetLabel(b)} · {b.sent_count} delivered
                    </div>
                  </span>
                  <span className="muted">{new Date(b.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
          {pages > 1 && (
            <div className="admin-pagination">
              <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <span className="muted">Page {page} / {pages}</span>
              <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
