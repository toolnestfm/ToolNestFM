'use client';

import { useEffect, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminPage';
import { adminFetch } from '@/lib/admin-client';

type SystemInfo = {
  nodeEnv: string;
  nextVersion: string;
  checks: Record<string, boolean>;
  allGreen: boolean;
  health: { status: string; uptime: number } | null;
  timestamp: string;
};

export default function AdminSystemPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    adminFetch<SystemInfo>('/api/admin/system').then(setInfo).catch(() => {});
  }, []);

  if (!info) return <div className="spinner" style={{ margin: 60 }} />;

  return (
    <div>
      <AdminPageHeader
        title="System"
        subtitle="Health checks and environment status"
        action={<span className={`pill ${info.allGreen ? 'pill-live' : 'status-failed'}`}>{info.allGreen ? '● All checks pass' : '● Issues detected'}</span>}
      />
      <div className="admin-stats-grid">
        <div className="admin-stat-card glass"><span className="muted">Environment</span><b>{info.nodeEnv}</b></div>
        <div className="admin-stat-card glass"><span className="muted">Next.js</span><b>{info.nextVersion}</b></div>
        <div className="admin-stat-card glass"><span className="muted">API Health</span><b>{info.health?.status ?? 'unknown'}</b></div>
        <div className="admin-stat-card glass"><span className="muted">Uptime</span><b>{info.health ? `${Math.floor(info.health.uptime)}s` : '—'}</b></div>
      </div>
      <div className="admin-panel glass">
        <h2>Environment checks</h2>
        <ul className="admin-rank-list">
          {Object.entries(info.checks).map(([key, ok]) => (
            <li key={key}>
              <span>{key}</span>
              <span className={`status-pill ${ok ? 'status-completed' : 'status-failed'}`}>{ok ? 'OK' : 'Missing'}</span>
            </li>
          ))}
        </ul>
        <p className="muted mt-4" style={{ fontSize: 12 }}>Last checked {new Date(info.timestamp).toLocaleString()}</p>
      </div>
    </div>
  );
}
