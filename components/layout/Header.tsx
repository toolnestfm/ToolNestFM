'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from '../Icon';
import { useUI } from '../GlobalUI';
import { useAuth } from '@/components/providers/AuthProvider';
import { categories } from '@/data/categories';
import { searchTools } from '@/data/tools';
import { initials, isAdminUser } from '@/lib/auth';

const navLinks: { label: string; href: string; badge?: string }[] = [
  { label: 'Home', href: '/' },
  { label: 'All Tools', href: '/tools' },
  { label: 'AI Tools', href: '/tools/ai', badge: 'NEW' },
  { label: 'PDF', href: '/tools/pdf' },
  { label: 'Image', href: '/tools/image' },
  { label: 'Video', href: '/tools/video' },
  { label: 'Audio', href: '/tools/audio' },
  { label: 'Developer', href: '/tools/developer' },
  { label: 'Text', href: '/tools/text' },
  { label: 'SEO', href: '/tools/seo' },
  { label: 'Business', href: '/tools/business' },
  { label: 'Converter', href: '/tools/file-converter' },
  { label: 'Utilities', href: '/tools/utility' },
];

export default function Header() {
  const { openPalette, openAI, toggleTheme, theme, toast } = useUI();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);

  const submitSearch = () => {
    const results = searchTools(q);
    if (results.length > 0) {
      const first = cat ? results.find((r) => r.category === cat) || results[0] : results[0];
      router.push(`/tools/${first.category}/${first.slug}`);
    } else if (q.trim()) {
      toast(`No tools found for "${q}"`, 'error');
    } else {
      openPalette();
    }
  };

  return (
    <header className="header">
      <div className="header-top">
        <Link href="/" className="logo" aria-label="ToolNest home">
          <span className="logo-mark"><Icon name="hexagon" size={20} strokeWidth={2.2} /></span>
          <span>
            <span className="logo-name">ToolNest</span>
            <div className="logo-tagline">One Platform. Infinite Tools.</div>
          </span>
        </Link>

        <div className="header-search" role="search">
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category filter">
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <input
            value={q}
            placeholder="Search any tool... (PDF to Word, Image Compressor, etc.)"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
            onFocus={openPalette}
            readOnly
            aria-label="Search tools"
          />
          <span className="kbd-hint">⌘K</span>
        </div>

        <div className="header-actions">
          <button className="ai-assistant-btn" onClick={openAI}>
            <Icon name="sparkles" size={15} /> AI Assistant
          </button>
          <button className="lang-btn" aria-label="Language selector">
            <Icon name="globe" size={16} /> English <Icon name="chevron-down" size={13} />
          </button>
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
            <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={17} />
          </button>
          <button className="icon-btn" onClick={() => toast('Notifications: all caught up! 🎉')} aria-label="Notifications">
            <Icon name="bell" size={17} />
            <span className="notif-dot">3</span>
          </button>
          {user ? (
            <>
              {isAdminUser(user) && (
                <Link href="/admin" className="btn btn-ghost btn-sm admin-header-link">
                  <Icon name="crown" size={14} /> Admin
                </Link>
              )}
              <Link href="/dashboard" className="user-chip">
              <span className="user-avatar">{initials(user.fullName)}</span>
              <span className="user-meta">
                <span className="user-name">{user.fullName}</span>
                {(user.plan === 'pro' || user.plan === 'enterprise') && <span className="pill pill-pro">PRO</span>}
              </span>
            </Link>
            </>
          ) : (
            <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
          )}
        </div>
      </div>

      <nav className="nav-row" aria-label="Primary">
        <div className="nav-inner">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className={`nav-link ${pathname === l.href ? 'active' : ''}`}>
              {l.label === 'Home' && <Icon name="grid" size={14} />}
              {l.label}
              {l.badge && <span className="pill pill-nav-new">{l.badge}</span>}
            </Link>
          ))}
          <div style={{ position: 'relative' }}>
            <button className="nav-link" onClick={() => setMoreOpen((o) => !o)}>
              More <Icon name="chevron-down" size={13} />
            </button>
            {moreOpen && (
              <div
                className="glass"
                style={{ position: 'absolute', top: '100%', right: 0, minWidth: 200, padding: 8, zIndex: 50, background: 'var(--bg-surface)' }}
                onMouseLeave={() => setMoreOpen(false)}
              >
                {['security', 'calculator', 'social', 'government'].map((slug) => {
                  const c = categories.find((x) => x.slug === slug)!;
                  return (
                    <Link key={slug} href={`/tools/${slug}`} className="sidebar-item" onClick={() => setMoreOpen(false)}>
                      <Icon name={c.icon} size={15} /> {c.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
