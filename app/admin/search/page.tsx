'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-client';

type Log = { id: string; query: string; results_count: number; created_at: string };

export default function AdminSearchPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [popular, setPopular] = useState<{ query: string; count: number }[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set('q', q);
    try {
      const data = await adminFetch<{ logs: Log[]; pages: number; popular: { query: string; count: number }[] }>(
        `/api/admin/search?${params}`,
      );
      setLogs(data.logs);
      setPages(data.pages);
      setPopular(data.popular);
    } finally {
      setLoading(false);
    }
  }, [page, q]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <header className="admin-header">
        <h1 className="admin-title">Search Logs</h1>
        <p className="muted">What users are searching for</p>
      </header>

      <div className="admin-panels">
        <section className="admin-panel glass">
          <h2>Top searches (30d)</h2>
          <ul className="admin-rank-list">
            {popular.length === 0 && <li className="muted">No data</li>}
            {popular.map((p) => (
              <li key={p.query}><span>{p.query}</span><b>{p.count}</b></li>
            ))}
          </ul>
        </section>
      </div>

      <div className="admin-toolbar glass mt-4">
        <input className="admin-input" placeholder="Filter query…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>

      <div className="admin-panel glass">
        {loading ? <div className="spinner" style={{ margin: '40px auto' }} /> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Query</th><th>Results</th><th>Time</th></tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{l.query}</td>
                    <td>{l.results_count}</td>
                    <td className="muted">{new Date(l.created_at).toLocaleString()}</td>
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
