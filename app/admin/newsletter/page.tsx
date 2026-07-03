'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-client';

type Subscriber = {
  id: string;
  email: string;
  source: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
};

export default function AdminNewsletterPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), active: String(activeOnly) });
    try {
      const data = await adminFetch<{ subscribers: Subscriber[]; pages: number; total: number }>(
        `/api/admin/newsletter?${params}`,
      );
      setSubscribers(data.subscribers);
      setPages(data.pages);
    } finally {
      setLoading(false);
    }
  }, [page, activeOnly]);

  useEffect(() => { void load(); }, [load]);

  const exportCsv = () => {
    const rows = [['email', 'source', 'subscribed_at', 'status'], ...subscribers.map((s) => [
      s.email,
      s.source ?? '',
      s.subscribed_at,
      s.unsubscribed_at ? 'unsubscribed' : 'active',
    ])];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'newsletter-subscribers.csv';
    a.click();
  };

  return (
    <div>
      <header className="admin-header">
        <div>
          <h1 className="admin-title">Newsletter</h1>
          <p className="muted">Subscriber list & export</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={exportCsv}>Export CSV</button>
      </header>

      <div className="admin-toolbar glass">
        <label className="admin-check">
          <input type="checkbox" checked={activeOnly} onChange={(e) => { setActiveOnly(e.target.checked); setPage(1); }} />
          Active subscribers only
        </label>
      </div>

      <div className="admin-panel glass">
        {loading ? <div className="spinner" style={{ margin: '40px auto' }} /> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Email</th><th>Source</th><th>Subscribed</th><th>Status</th></tr>
              </thead>
              <tbody>
                {subscribers.map((s) => (
                  <tr key={s.id}>
                    <td>{s.email}</td>
                    <td className="muted">{s.source || '—'}</td>
                    <td className="muted">{new Date(s.subscribed_at).toLocaleDateString()}</td>
                    <td>
                      <span className={`status-pill ${s.unsubscribed_at ? 'status-failed' : 'status-completed'}`}>
                        {s.unsubscribed_at ? 'Unsubscribed' : 'Active'}
                      </span>
                    </td>
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
