'use client';

import { categories } from '@/data/categories';
import { tools } from '@/data/tools';
import { AdminPageHeader } from '@/components/admin/AdminPage';

export default function AdminCategoriesPage() {
  const counts = categories.map((c) => ({
    ...c,
    count: tools.filter((t) => t.category === c.slug).length,
  }));

  return (
    <div>
      <AdminPageHeader title="Categories" subtitle="Browse and manage tool categories (catalog from data layer)" />
      <div className="admin-stats-grid">
        {counts.map((c) => (
          <div key={c.slug} className="admin-stat-card glass">
            <span className="muted">{c.name}</span>
            <b>{c.count} tools</b>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{c.description}</p>
            <a href={`/tools/${c.slug}`} className="btn btn-ghost btn-sm mt-2" target="_blank" rel="noreferrer">View category →</a>
          </div>
        ))}
      </div>
    </div>
  );
}
