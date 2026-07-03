'use client';

import { AdminPageHeader } from '@/components/admin/AdminPage';

const reports = [
  { type: 'users', label: 'Users Export', desc: 'All profiles — plan, role, join date' },
  { type: 'jobs', label: 'Jobs Export', desc: 'Tool usage history' },
  { type: 'subscribers', label: 'Newsletter Subscribers', desc: 'Email list with status' },
  { type: 'contact', label: 'Contact Messages', desc: 'Contact form submissions' },
  { type: 'analytics', label: 'Analytics Events', desc: 'Raw event stream' },
];

export default function AdminReportsPage() {
  return (
    <div>
      <AdminPageHeader title="Reports" subtitle="Export CSV reports for analysis and compliance" />
      <div className="admin-quick-grid">
        {reports.map((r) => (
          <a key={r.type} href={`/api/admin/reports?type=${r.type}`} className="admin-quick-card" download>
            <b>{r.label}</b>
            <span className="muted">{r.desc}</span>
            <span className="pill pill-sm mt-2">Download CSV</span>
          </a>
        ))}
      </div>
    </div>
  );
}
