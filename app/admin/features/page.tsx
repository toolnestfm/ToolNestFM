'use client';

import { AdminPageHeader, AdminToggleRow } from '@/components/admin/AdminPage';
import { useAdminSettings } from '@/lib/use-admin-settings';
import type { FeatureFlags } from '@/lib/admin-settings';

export default function AdminFeaturesPage() {
  const { settings, loading, save } = useAdminSettings();
  if (loading || !settings) return <div className="spinner" style={{ margin: 60 }} />;

  const f = settings.feature_flags;
  const toggle = (key: keyof FeatureFlags, v: boolean) => void save({ feature_flags: { ...f, [key]: v } });

  return (
    <div>
      <AdminPageHeader title="Feature Flags" subtitle="Toggle platform features without redeploying" />
      <div className="admin-panel glass">
        <AdminToggleRow label="AI Assistant" description="Header AI panel" checked={f.aiAssistant} onChange={(v) => toggle('aiAssistant', v)} />
        <AdminToggleRow label="AI Chat" checked={f.aiChat} onChange={(v) => toggle('aiChat', v)} />
        <AdminToggleRow label="AI Image Generator" checked={f.aiImageGen} onChange={(v) => toggle('aiImageGen', v)} />
        <AdminToggleRow label="Newsletter" checked={f.newsletter} onChange={(v) => toggle('newsletter', v)} />
        <AdminToggleRow label="Blog" checked={f.blog} onChange={(v) => toggle('blog', v)} />
        <AdminToggleRow label="Google OAuth" checked={f.oauthGoogle} onChange={(v) => toggle('oauthGoogle', v)} />
        <AdminToggleRow label="GitHub OAuth" checked={f.oauthGithub} onChange={(v) => toggle('oauthGithub', v)} />
        <AdminToggleRow label="Maintenance mode" description="Show maintenance banner site-wide" checked={f.maintenanceMode} onChange={(v) => toggle('maintenanceMode', v)} />
      </div>
    </div>
  );
}
