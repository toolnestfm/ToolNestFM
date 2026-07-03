'use client';

import { AdminPageHeader } from '@/components/admin/AdminPage';
import { useAdminSettings } from '@/lib/use-admin-settings';

export default function AdminEmailTemplatesPage() {
  const { settings, loading, save } = useAdminSettings();
  if (loading || !settings) return <div className="spinner" style={{ margin: 60 }} />;

  return (
    <div>
      <AdminPageHeader title="Email Templates" subtitle="Transactional email templates (Resend integration)" />
      <div className="admin-profile-grid">
        {settings.email_templates.map((t, i) => (
          <section key={t.id} className="admin-panel glass">
            <h2>{t.name}</h2>
            <div className="field mb-4">
              <label>Subject</label>
              <input
                defaultValue={t.subject}
                onBlur={(e) => {
                  const next = [...settings.email_templates];
                  next[i] = { ...t, subject: e.target.value };
                  void save({ email_templates: next });
                }}
              />
            </div>
            <div className="field">
              <label>Body</label>
              <textarea
                rows={5}
                defaultValue={t.body}
                onBlur={(e) => {
                  const next = [...settings.email_templates];
                  next[i] = { ...t, body: e.target.value };
                  void save({ email_templates: next });
                }}
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
