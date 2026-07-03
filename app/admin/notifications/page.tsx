'use client';

import { AdminPageHeader } from '@/components/admin/AdminPage';

const alerts = [
  { id: 1, type: 'info', text: 'All systems operational', time: 'Just now' },
  { id: 2, type: 'success', text: 'New user signups enabled', time: 'Today' },
  { id: 3, type: 'warn', text: 'Review contact inbox — new messages may need reply', time: 'Today' },
];

export default function AdminNotificationsPage() {
  return (
    <div>
      <AdminPageHeader title="Notifications" subtitle="Admin alerts and system notifications" />
      <div className="admin-panel glass">
        <ul className="admin-rank-list">
          {alerts.map((a) => (
            <li key={a.id}>
              <span><span className={`status-pill status-${a.type === 'warn' ? 'failed' : 'completed'}`}>{a.type}</span> {a.text}</span>
              <span className="muted">{a.time}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
