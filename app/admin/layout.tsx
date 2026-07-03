'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Icon from '@/components/Icon';
import { useAuth } from '@/components/providers/AuthProvider';
import { adminNavSections, isAdminPathActive } from '@/lib/admin-nav';
import { initials, isAdminUser } from '@/lib/auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && !isAdminUser(user)) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return <div className="container section-pad"><div className="spinner" style={{ margin: '80px auto' }} /></div>;
  }

  if (!user || !isAdminUser(user)) return null;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar glass">
        <div className="admin-brand">
          <span className="logo-mark admin-mark"><Icon name="crown" size={18} /></span>
          <div>
            <b>ToolNest Admin</b>
            <span className="muted">Control Center</span>
          </div>
        </div>
        <Link href="/admin/profile" className="admin-user-chip admin-user-link">
          <span className="user-avatar">{initials(user.fullName)}</span>
          <div>
            <b>{user.fullName}</b>
            <span className="pill pill-admin">{user.role.replace('_', ' ').toUpperCase()}</span>
          </div>
        </Link>
        <nav className="admin-nav">
          {adminNavSections.map((section) => (
            <div key={section.title} className="admin-nav-section">
              <span className="admin-nav-label">{section.title}</span>
              {section.items.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`admin-nav-item ${isAdminPathActive(pathname, n.href) ? 'active' : ''}`}
                >
                  <Icon name={n.icon} size={16} /> {n.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <Link href="/dashboard" className="btn btn-ghost btn-sm w-full">← User Dashboard</Link>
          <Link href="/" className="btn btn-ghost btn-sm w-full mt-2">View Site</Link>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
