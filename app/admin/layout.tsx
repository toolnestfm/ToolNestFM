'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AdminLoginForm from '@/components/admin/AdminLoginForm';
import Icon from '@/components/Icon';
import { useAuth } from '@/components/providers/AuthProvider';
import { adminNavSections, isAdminPathActive } from '@/lib/admin-nav';
import { initials, isAdminUser } from '@/lib/auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="admin-login-page">
        <div className="spinner" />
      </div>
    );
  }

  // /admin shows admin login when not signed in (URL stays /admin)
  if (!user) {
    return <AdminLoginForm />;
  }

  // Signed in but not an admin
  if (!isAdminUser(user)) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card glass">
          <div className="admin-login-head">
            <span className="logo-mark admin-mark"><Icon name="lock" size={22} /></span>
            <h1>Access denied</h1>
            <p className="muted">This account does not have admin privileges.</p>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Signed in as <b>{user.email}</b>
            </p>
            <p className="muted" style={{ fontSize: 12 }}>
              Admin access requires an ADMIN or SUPER_ADMIN role. Sign in with your admin email or contact a super admin.
            </p>
          </div>
          <div className="admin-actions-row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void signOut()}>
              Sign out
            </button>
            <Link href="/dashboard" className="btn btn-ghost btn-sm">User Dashboard</Link>
            <Link href="/" className="btn btn-ghost btn-sm">Home</Link>
          </div>
        </div>
      </div>
    );
  }

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
          <button type="button" className="btn btn-ghost btn-sm w-full mt-2" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
