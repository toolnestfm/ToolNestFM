'use client';

import { AdminFieldRow, AdminPageHeader, AdminToggleRow } from '@/components/admin/AdminPage';
import { useAdminSettings } from '@/lib/use-admin-settings';

export default function AdminSettingsPage() {
  const { settings, loading, save } = useAdminSettings();
  if (loading || !settings) return <div className="spinner" style={{ margin: 60 }} />;

  const s = settings.site;

  return (
    <div>
      <AdminPageHeader title="Settings" subtitle="Site-wide configuration" />
      <div className="admin-panel glass" style={{ maxWidth: 560 }}>
        <AdminFieldRow label="Site name">
          <input defaultValue={s.siteName} onBlur={(e) => void save({ site: { ...s, siteName: e.target.value } })} />
        </AdminFieldRow>
        <AdminFieldRow label="Support email">
          <input type="email" defaultValue={s.supportEmail} onBlur={(e) => void save({ site: { ...s, supportEmail: e.target.value } })} />
        </AdminFieldRow>
        <AdminFieldRow label="Max upload (MB)">
          <input type="number" defaultValue={s.maxUploadMb} onBlur={(e) => void save({ site: { ...s, maxUploadMb: Number(e.target.value) } })} />
        </AdminFieldRow>
        <AdminToggleRow label="Allow new signups" checked={s.allowSignups} onChange={(v) => void save({ site: { ...s, allowSignups: v } })} />
      </div>
    </div>
  );
}
