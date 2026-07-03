'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-client';

type Event = {
  id: string;
  event: string;
  props: Record<string, unknown>;
  user_id: string | null;
  created_at: string;
};

export default function AdminAnalyticsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [eventFilter, setEventFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (eventFilter) params.set('event', eventFilter);
    try {
      const data = await adminFetch<{ events: Event[]; pages: number }>(`/api/admin/analytics?${params}`);
      setEvents(data.events);
      setPages(data.pages);
    } finally {
      setLoading(false);
    }
  }, [page, eventFilter]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <header className="admin-header">
        <h1 className="admin-title">Analytics</h1>
        <p className="muted">Raw event stream from Universal Analytics Engine</p>
      </header>

      <div className="admin-toolbar glass">
        <input
          className="admin-input"
          placeholder="Filter by event name…"
          value={eventFilter}
          onChange={(e) => { setEventFilter(e.target.value); setPage(1); }}
        />
      </div>

      <div className="admin-panel glass">
        {loading ? <div className="spinner" style={{ margin: '40px auto' }} /> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Event</th><th>Props</th><th>User</th><th>Time</th></tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td><span className="pill pill-ai">{e.event}</span></td>
                    <td className="mono muted" style={{ fontSize: 11, maxWidth: 320 }}>
                      {JSON.stringify(e.props).slice(0, 80)}{JSON.stringify(e.props).length > 80 ? '…' : ''}
                    </td>
                    <td className="muted" style={{ fontSize: 11 }}>{e.user_id ? `${e.user_id.slice(0, 8)}…` : '—'}</td>
                    <td className="muted">{new Date(e.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="admin-pagination">
          <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="muted">Page {page} / {pages}</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
