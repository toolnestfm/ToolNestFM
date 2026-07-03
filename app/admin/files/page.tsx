'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminPage';
import { adminFetch } from '@/lib/admin-client';

type Job = {
  id: string;
  user_id: string;
  tool_slug: string;
  tool_name: string;
  category: string;
  status: string;
  created_at: string;
};

export default function AdminFilesPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    try {
      const data = await adminFetch<{ jobs: Job[]; pages: number }>(`/api/admin/jobs?${params}`);
      setJobs(data.jobs);
      setPages(data.pages);
    } finally {
      setLoading(false);
    }
  }, [page, status, q]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <AdminPageHeader title="Files & Jobs" subtitle="Job queue monitor and processing history (R2 file manager — coming soon)" />
      <div className="admin-stats-grid" style={{ marginBottom: 16 }}>
        <div className="admin-stat-card glass"><span className="muted">Cloud Storage</span><b>R2</b><p className="muted" style={{ fontSize: 12 }}>Signed URLs · 24h free retention</p></div>
        <div className="admin-stat-card glass"><span className="muted">Queue</span><b>BullMQ</b><p className="muted" style={{ fontSize: 12 }}>Heavy jobs offloaded to workers</p></div>
      </div>
      <div className="admin-toolbar glass">
        <input className="admin-input" placeholder="Filter tool…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className="admin-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="used">used</option>
          <option value="completed">completed</option>
          <option value="failed">failed</option>
        </select>
      </div>
      <div className="admin-panel glass">
        {loading ? <div className="spinner" style={{ margin: '40px auto' }} /> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Tool</th><th>Category</th><th>Status</th><th>User</th><th>Time</th></tr></thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td><b>{j.tool_name}</b></td>
                    <td><span className="pill pill-sm">{j.category}</span></td>
                    <td><span className={`status-pill status-${j.status}`}>{j.status}</span></td>
                    <td className="mono muted" style={{ fontSize: 11 }}>{j.user_id.slice(0, 8)}…</td>
                    <td className="muted">{new Date(j.created_at).toLocaleString()}</td>
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
