'use client';

import Link from 'next/link';
import Icon from '@/components/Icon';
import type { AdminNavItem } from '@/lib/admin-nav';

export function AdminPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="admin-header">
      <div>
        <h1 className="admin-title">{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function AdminQuickGrid({ items, title = 'Admin Control Center' }: { items: AdminNavItem[]; title?: string }) {
  return (
    <section className="admin-panel glass mt-4">
      <h2>{title}</h2>
      <p className="muted mb-4" style={{ fontSize: 13 }}>Quick access to all advanced admin pages</p>
      <div className="admin-quick-grid">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="admin-quick-card">
            <span className="admin-quick-icon"><Icon name={item.icon} size={18} /></span>
            <b>{item.label}</b>
            {item.description && <span className="muted">{item.description}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function AdminToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="admin-toggle-row">
      <div>
        <b>{label}</b>
        {description && <p className="muted">{description}</p>}
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function AdminFieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field mb-4">
      <label>{label}</label>
      {children}
    </div>
  );
}
