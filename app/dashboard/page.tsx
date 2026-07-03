'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { homepageToolSlugs, getTool } from '@/data/tools';

export default function DashboardPage() {
  const { user } = useAuth();
  const [todayCount, setTodayCount] = useState(0);
  const [credits, setCredits] = useState<number | null>(null);
  const recent = homepageToolSlugs.slice(0, 4).map((s) => getTool(s)).filter(Boolean);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [jobsRes, creditsRes] = await Promise.all([fetch('/api/jobs'), fetch('/api/credits')]);
        const jobs = (await jobsRes.json()) as { success: boolean; data?: { todayCount: number } };
        const cr = (await creditsRes.json()) as { success: boolean; data?: { balance: number } };
        if (cancelled) return;
        if (jobs.success) setTodayCount(jobs.data?.todayCount ?? 0);
        if (cr.success) setCredits(cr.data?.balance ?? 0);
      } catch {
        /* best-effort */
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const storagePct = user ? Math.round((user.storageUsedMb / user.storageLimitMb) * 100) : 0;

  return (
    <div>
      <h1 className="dash-title">Dashboard</h1>
      <p className="muted mb-6">Welcome back{user ? `, ${user.fullName.split(' ')[0]}` : ''}!</p>

      <div className="dash-stats">
        <div className="dash-stat glass">
          <span className="muted">Plan</span>
          <b>{user?.plan === 'pro' ? '👑 Pro' : user?.plan === 'enterprise' ? 'Enterprise' : 'Free'}</b>
          {user?.plan === 'free' && <Link href="/dashboard/billing" className="btn btn-sm btn-primary mt-2">Upgrade to Pro</Link>}
        </div>
        <div className="dash-stat glass">
          <span className="muted">Storage</span>
          <b>{user?.storageUsedMb ?? 0} MB / {user?.storageLimitMb ?? 500} MB</b>
          <div className="progress-track mt-2"><div className="progress-fill" style={{ width: `${storagePct}%` }} /></div>
        </div>
        <div className="dash-stat glass">
          <span className="muted">Tools used today</span>
          <b>{todayCount} / {user?.plan === 'pro' || user?.plan === 'enterprise' ? '∞' : '5 per tool'}</b>
        </div>
        <div className="dash-stat glass">
          <span className="muted">Credits</span>
          <b>{credits === null ? '…' : `${credits.toLocaleString()} ⚡`}</b>
          <Link href="/dashboard/credits" className="btn btn-sm btn-ghost mt-2">Get more</Link>
        </div>
      </div>

      <h2 className="dash-section-title">Quick access</h2>
      <div className="dash-quick">
        {recent.map((t) => t && (
          <Link key={t.slug} href={`/tools/${t.category}/${t.slug}`} className="dash-quick-item glass">
            <b>{t.name}</b>
            <span className="muted">{t.description.slice(0, 50)}…</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
