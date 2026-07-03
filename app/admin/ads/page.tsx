'use client';

import { AdminPageHeader, AdminToggleRow } from '@/components/admin/AdminPage';
import { useAdminSettings } from '@/lib/use-admin-settings';
import type { AdsConfig } from '@/lib/admin-settings';

export default function AdminAdsPage() {
  const { settings, loading, save } = useAdminSettings();
  if (loading || !settings) return <div className="spinner" style={{ margin: 60 }} />;

  const ads = settings.ads;
  const toggle = (key: keyof AdsConfig, v: boolean) => void save({ ads: { ...ads, [key]: v } });

  return (
    <div>
      <AdminPageHeader title="Ads" subtitle="Ad zone toggles (non-Pro users)" />
      <div className="admin-panel glass">
        <AdminToggleRow label="Homepage banner" checked={ads.homepageBanner} onChange={(v) => toggle('homepageBanner', v)} />
        <AdminToggleRow label="Tool page sidebar" checked={ads.toolPageSidebar} onChange={(v) => toggle('toolPageSidebar', v)} />
        <AdminToggleRow label="Between tool cards" checked={ads.betweenToolCards} onChange={(v) => toggle('betweenToolCards', v)} />
        <AdminToggleRow label="Dashboard banner" checked={ads.dashboardBanner} onChange={(v) => toggle('dashboardBanner', v)} />
      </div>
    </div>
  );
}
