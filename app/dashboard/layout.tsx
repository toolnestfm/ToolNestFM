'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/Icon';
import { useAuth } from '@/components/providers/AuthProvider';
import { initials, isAdminUser } from '@/lib/auth';

const nav = [
  { href: '/dashboard', label: 'Overview', icon: 'grid' },
  { href: '/dashboard/history', label: 'History', icon: 'clock' },
  { href: '/dashboard/credits', label: 'Credits', icon: 'zap' },
  { href: '/dashboard/api-keys', label: 'API Keys', icon: 'key' },
  { href: '/dashboard/billing', label: 'Billing', icon: 'briefcase' },
  { href: '/dashboard/settings', label: 'Settings', icon: 'settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="container section-pad"><div className="spinner" style={{ margin: '80px auto' }} /></div>;
  }

  if (!user) return null;

  return (
    <div className="container dashboard-layout">
      <aside className="dash-sidebar glass">
        <div className="dash-user">
          <span className="user-avatar">{initials(user.fullName)}</span>
          <div>
            <b>{user.fullName}</b>
            <span className={`pill ${user.plan === 'pro' ? 'pill-pro' : ''}`}>{user.plan.toUpperCase()}</span>
          </div>
        </div>
        <nav>
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={`sidebar-item ${pathname === n.href ? 'active' : ''}`}>
              <Icon name={n.icon} size={16} /> {n.label}
            </Link>
          ))}
        </nav>
        {isAdminUser(user) && (
          <Link href="/admin" className="sidebar-item" style={{ marginTop: 8, color: 'var(--gold-premium)' }}>
            <Icon name="crown" size={16} /> Admin Panel
          </Link>
        )}
        <Link href="/tools" className="btn btn-ghost btn-sm w-full mt-4">Browse Tools</Link>
      </aside>
      <div className="dash-main">{children}</div>
    </div>
  );
}
