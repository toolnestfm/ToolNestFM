'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-client';

type AuditLog = {
  id: string;
  actor_id: string;
  action: string;
  target: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ logs: AuditLog[]; pages: number }>(`/api/admin/audit?page=${page}`);
      setLogs(data.logs);
      setPages(data.pages);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <header className="admin-header">
        <h1 className="admin-title">Audit Log</h1>
        <p className="muted">Admin actions trail</p>
      </header>

      <div className="admin-panel glass">
        {loading ? <div className="spinner" style={{ margin: '40px auto' }} /> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Action</th><th>Target</th><th>Actor</th><th>Meta</th><th>Time</th></tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td><span className="pill pill-sm">{l.action}</span></td>
                    <td className="mono muted" style={{ fontSize: 11 }}>{l.target?.slice(0, 12) ?? '—'}</td>
                    <td className="mono muted" style={{ fontSize: 11 }}>{l.actor_id.slice(0, 8)}…</td>
                    <td className="mono muted" style={{ fontSize: 10 }}>{JSON.stringify(l.meta).slice(0, 40)}…</td>
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
