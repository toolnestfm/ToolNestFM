'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface JobRow {
  id: string;
  tool_slug: string;
  tool_name: string;
  category: string;
  status: string;
  created_at: string;
}

const statusLabel: Record<string, string> = {
  used: 'Opened',
  completed: 'Completed',
  failed: 'Failed',
};

export default function HistoryPage() {
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/jobs');
        const json = (await res.json()) as { success: boolean; data?: { jobs: JobRow[] }; error?: string | null };
        if (cancelled) return;
        if (!json.success) throw new Error(json.error || 'Could not load history');
        setJobs(json.data?.jobs ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load history');
          setJobs([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <h1 className="dash-title">Job History</h1>
      <p className="muted mb-6">Your recent tool runs and downloads.</p>

      {jobs === null && (
        <div className="glass dash-empty"><p>Loading history…</p></div>
      )}

      {jobs !== null && error && (
        <div className="glass dash-empty"><p>{error}</p></div>
      )}

      {jobs !== null && !error && jobs.length === 0 && (
        <div className="glass dash-empty">
          <p>No jobs yet. <Link href="/tools">Use a tool</Link> and your history will appear here.</p>
          <p className="muted mt-2">Browser-based tools process locally — only the tool name and time are recorded, never your files.</p>
        </div>
      )}

      {jobs !== null && !error && jobs.length > 0 && (
        <div className="glass" style={{ overflowX: 'auto' }}>
          <table className="history-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>Tool</th>
                <th style={{ padding: '12px 16px' }}>Category</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>When</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} style={{ borderTop: '1px solid var(--border-subtle, #2A2A3C)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <Link href={`/tools/${j.category}/${j.tool_slug}`}>{j.tool_name}</Link>
                  </td>
                  <td style={{ padding: '12px 16px' }} className="muted">{j.category}</td>
                  <td style={{ padding: '12px 16px' }}>{statusLabel[j.status] ?? j.status}</td>
                  <td style={{ padding: '12px 16px' }} className="muted">{new Date(j.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
