'use client';

import { AdminPageHeader, AdminToggleRow } from '@/components/admin/AdminPage';
import { useAdminSettings } from '@/lib/use-admin-settings';
import type { AdsConfig } from '@/lib/admin-settings';

const ZONE_INFO: { key: keyof AdsConfig; label: string; desc: string }[] = [
  { key: 'ad_header', label: 'Header Banner', desc: 'Top banner above nav (not built yet)' },
  { key: 'ad_sidebar', label: 'Tool Page Sidebar', desc: '300×250 rectangle + 160×600 skyscraper on desktop' },
  { key: 'ad_home_inline', label: 'Homepage Inline', desc: '728×90 leaderboard between tool grid sections' },
  { key: 'ad_footer', label: 'Footer Leaderboard', desc: '728×90 leaderboard above footer' },
  { key: 'ad_tool_bottom', label: 'Tool Page Bottom', desc: '728×90 desktop / 320×50 mobile below tool output' },
  { key: 'ad_blog', label: 'Blog In-Article', desc: 'In-article ads on blog posts (not built yet)' },
];

export default function AdminAdsPage() {
  const { settings, loading, save } = useAdminSettings();
  if (loading || !settings) return <div className="spinner" style={{ margin: 60 }} />;

  const ads = settings.ads;
  const toggle = (key: keyof AdsConfig, v: boolean) => void save({ ads: { ...ads, [key]: v } });

  return (
    <div>
      <AdminPageHeader title="Ads Management" subtitle="Toggle ad zones for non-Pro users. Ads are served via Adsterra." />
      <div className="admin-panel glass">
        {ZONE_INFO.map((z) => (
          <AdminToggleRow
            key={z.key}
            label={z.label}
            checked={ads[z.key]}
            onChange={(v) => toggle(z.key, v)}
          />
        ))}
      </div>
      <div className="admin-panel glass" style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Ad Unit IDs (Adsterra)</h3>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '8px 12px' }}>Placement</th>
              <th style={{ padding: '8px 12px' }}>Size</th>
              <th style={{ padding: '8px 12px' }}>Key</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={{ padding: '6px 12px' }}>Leaderboard</td><td>728×90</td><td className="mono">b1780628...fea58</td></tr>
            <tr><td style={{ padding: '6px 12px' }}>Sidebar Rectangle</td><td>300×250</td><td className="mono">e2efc9b7...6d9b</td></tr>
            <tr><td style={{ padding: '6px 12px' }}>Mobile Banner</td><td>320×50</td><td className="mono">c2bfb926...42f5</td></tr>
            <tr><td style={{ padding: '6px 12px' }}>Sidebar Skyscraper</td><td>160×600</td><td className="mono">4c42e20b...8b0e</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
