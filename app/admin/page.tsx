'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-client';

type Stats = {
  totals: {
    users: number;
    jobs: number;
    subscribers: number;
    newContact: number;
    analyticsEvents: number;
    searches: number;
    jobsToday: number;
    proUsers: number;
  };
  recentJobs: { id: string; tool_name: string; category: string; status: string; created_at: string }[];
  topAnalytics: { event: string; count: number }[];
  jobsByDay: { date: string; count: number }[];
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch<Stats>('/api/admin/stats')
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" style={{ margin: '60px auto' }} />;
  if (error) return <div className="admin-alert error">{error}</div>;
  if (!stats) return null;

  const maxJobs = Math.max(...stats.jobsByDay.map((d) => d.count), 1);

  return (
    <div>
      <header className="admin-header">
        <div>
          <h1 className="admin-title">Dashboard</h1>
          <p className="muted">Platform health, usage, and growth at a glance.</p>
        </div>
        <span className="pill pill-live">● Live</span>
      </header>

      <div className="admin-stats-grid">
        {[
          { label: 'Total Users', value: stats.totals.users, accent: 'violet' },
          { label: 'Pro Users', value: stats.totals.proUsers, accent: 'gold' },
          { label: 'Jobs Today', value: stats.totals.jobsToday, accent: 'green' },
          { label: 'Total Jobs', value: stats.totals.jobs, accent: 'blue' },
          { label: 'Subscribers', value: stats.totals.subscribers, accent: 'cyan' },
          { label: 'New Contact', value: stats.totals.newContact, accent: 'orange' },
          { label: 'Analytics Events', value: stats.totals.analyticsEvents, accent: 'magenta' },
          { label: 'Search Queries', value: stats.totals.searches, accent: 'slate' },
        ].map((s) => (
          <div key={s.label} className={`admin-stat-card glass accent-${s.accent}`}>
            <span className="muted">{s.label}</span>
            <b>{s.value.toLocaleString()}</b>
          </div>
        ))}
      </div>

      <div className="admin-panels">
        <section className="admin-panel glass">
          <h2>Jobs — last 7 days</h2>
          <div className="admin-bar-chart">
            {stats.jobsByDay.map((d) => (
              <div key={d.date} className="admin-bar-col" title={`${d.date}: ${d.count}`}>
                <div className="admin-bar" style={{ height: `${(d.count / maxJobs) * 100}%` }} />
                <span>{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel glass">
          <h2>Top events (7d)</h2>
          <ul className="admin-rank-list">
            {stats.topAnalytics.length === 0 && <li className="muted">No events yet</li>}
            {stats.topAnalytics.map((e) => (
              <li key={e.event}>
                <span>{e.event}</span>
                <b>{e.count}</b>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="admin-panel glass mt-4">
        <h2>Recent tool runs</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tool</th>
                <th>Category</th>
                <th>Status</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentJobs.map((j) => (
                <tr key={j.id}>
                  <td>{j.tool_name}</td>
                  <td><span className="pill pill-sm">{j.category}</span></td>
                  <td><span className={`status-pill status-${j.status}`}>{j.status}</span></td>
                  <td className="muted">{new Date(j.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
