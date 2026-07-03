'use client';

import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin/AdminPage';

const posts = [
  { slug: 'compress-pdf-without-quality-loss', title: 'How to Compress a PDF Without Losing Quality', category: 'PDF', date: 'Jun 15, 2025' },
  { slug: 'best-ai-writing-tools-2025', title: '10 Best AI Writing Tools in 2025', category: 'AI', date: 'Jun 8, 2025' },
  { slug: 'passport-photo-requirements-india', title: 'Passport Photo Requirements for India (2025 Guide)', category: 'Government', date: 'May 28, 2025' },
  { slug: 'remove-background-free', title: 'Remove Image Backgrounds for Free — Complete Guide', category: 'Image', date: 'May 20, 2025' },
  { slug: 'seo-checklist-2025', title: 'On-Page SEO Checklist for 2025', category: 'SEO', date: 'May 12, 2025' },
];

export default function AdminBlogPage() {
  return (
    <div>
      <AdminPageHeader title="Blog CMS" subtitle="Manage blog posts (static catalog — full CMS coming in Phase 2)" />
      <div className="admin-panel glass">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Title</th><th>Category</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.slug}>
                  <td><b>{p.title}</b></td>
                  <td><span className="pill pill-sm">{p.category}</span></td>
                  <td className="muted">{p.date}</td>
                  <td>
                    <Link href={`/blog/${p.slug}`} className="btn btn-ghost btn-sm" target="_blank">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
