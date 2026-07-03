'use client';

import { AdminFieldRow, AdminPageHeader } from '@/components/admin/AdminPage';
import { useAdminSettings } from '@/lib/use-admin-settings';

export default function AdminPricingPage() {
  const { settings, loading, save } = useAdminSettings();
  if (loading || !settings) return <div className="spinner" style={{ margin: 60 }} />;

  const p = settings.pricing;
  const setNum = (key: keyof typeof p, val: string) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return;
    void save({ pricing: { ...p, [key]: n } });
  };

  return (
    <div>
      <AdminPageHeader title="Pricing" subtitle="Plan limits and price configuration" />
      <div className="admin-profile-grid">
        <section className="admin-panel glass">
          <h2>Pro Pricing (USD)</h2>
          <AdminFieldRow label="Monthly"><input type="number" step="0.01" defaultValue={p.proMonthlyUsd} onBlur={(e) => setNum('proMonthlyUsd', e.target.value)} /></AdminFieldRow>
          <AdminFieldRow label="Yearly"><input type="number" step="0.01" defaultValue={p.proYearlyUsd} onBlur={(e) => setNum('proYearlyUsd', e.target.value)} /></AdminFieldRow>
        </section>
        <section className="admin-panel glass">
          <h2>Limits</h2>
          <AdminFieldRow label="Free jobs / day"><input type="number" defaultValue={p.freeJobsPerDay} onBlur={(e) => setNum('freeJobsPerDay', e.target.value)} /></AdminFieldRow>
          <AdminFieldRow label="Free storage (MB)"><input type="number" defaultValue={p.freeStorageMb} onBlur={(e) => setNum('freeStorageMb', e.target.value)} /></AdminFieldRow>
          <AdminFieldRow label="Pro storage (GB)"><input type="number" defaultValue={p.proStorageGb} onBlur={(e) => setNum('proStorageGb', e.target.value)} /></AdminFieldRow>
          <AdminFieldRow label="Free max file (MB)"><input type="number" defaultValue={p.freeFileSizeMb} onBlur={(e) => setNum('freeFileSizeMb', e.target.value)} /></AdminFieldRow>
          <AdminFieldRow label="Pro max file (MB)"><input type="number" defaultValue={p.proFileSizeMb} onBlur={(e) => setNum('proFileSizeMb', e.target.value)} /></AdminFieldRow>
        </section>
      </div>
    </div>
  );
}
