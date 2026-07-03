'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(true);

  useEffect(() => {
    if (localStorage.getItem('tn-nav-open') === '0') setNavOpen(false);
  }, []);

  const toggleNav = () =>
    setNavOpen((o) => {
      localStorage.setItem('tn-nav-open', o ? '0' : '1');
      return !o;
    });

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
          <img src="/logo-icon.png" alt="ToolNest" className="logo-img" width={36} height={36} />
          <span>
            <span className="logo-brand">
              <span className="logo-tool">Tool</span>
              <span className="logo-nest">Nest</span>
              <span className="logo-fm">FM</span>
            </span>
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
              <Link href={isAdminUser(user) ? '/admin' : '/dashboard'} className="user-chip">
                <span className="user-avatar">{initials(user.fullName)}</span>
                <span className="user-meta">
                  <span className="user-name">{user.fullName}</span>
                  {isAdminUser(user) ? (
                    <span className="pill pill-admin">ADMIN</span>
                  ) : (
                    (user.plan === 'pro' || user.plan === 'enterprise') && <span className="pill pill-pro">PRO</span>
                  )}
                </span>
              </Link>
            </>
          ) : (
            <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
          )}
        </div>

        <div className="header-mobile-actions">
          <button className="icon-btn" onClick={openPalette} aria-label="Search tools">
            <Icon name="search" size={18} />
          </button>
          <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Icon name="menu" size={20} />
          </button>
        </div>
      </div>

      {menuOpen && createPortal(
        <div className="mobile-menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Menu">
            <div className="mobile-menu-head">
              {user ? (
                <Link href={isAdminUser(user) ? '/admin' : '/dashboard'} className="user-chip" onClick={() => setMenuOpen(false)}>
                  <span className="user-avatar">{initials(user.fullName)}</span>
                  <span className="user-meta">
                    <span className="user-name">{user.fullName}</span>
                    {isAdminUser(user) ? (
                      <span className="pill pill-admin">ADMIN</span>
                    ) : (
                      (user.plan === 'pro' || user.plan === 'enterprise') && <span className="pill pill-pro">PRO</span>
                    )}
                  </span>
                </Link>
              ) : (
                <Link href="/login" className="btn btn-primary btn-sm" onClick={() => setMenuOpen(false)}>Sign in</Link>
              )}
              <button className="icon-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <Icon name="x" size={20} />
              </button>
            </div>

            <button className="ai-assistant-btn mobile-menu-ai" onClick={() => { setMenuOpen(false); openAI(); }}>
              <Icon name="sparkles" size={15} /> AI Assistant
            </button>

            <div className="mobile-menu-links">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`mobile-menu-link ${pathname === l.href ? 'active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                  {l.badge && <span className="pill pill-nav-new">{l.badge}</span>}
                </Link>
              ))}
              {['security', 'calculator', 'social', 'government'].map((slug) => {
                const c = categories.find((x) => x.slug === slug)!;
                return (
                  <Link key={slug} href={`/tools/${slug}`} className="mobile-menu-link" onClick={() => setMenuOpen(false)}>
                    {c.name}
                  </Link>
                );
              })}
            </div>

            <div className="mobile-menu-foot">
              <button className="lang-btn" aria-label="Language selector">
                <Icon name="globe" size={16} /> English
              </button>
              <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
                <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={17} />
              </button>
              <button className="icon-btn" onClick={() => toast('Notifications: all caught up! 🎉')} aria-label="Notifications">
                <Icon name="bell" size={17} />
                <span className="notif-dot">3</span>
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <nav className={`nav-row ${navOpen ? '' : 'nav-collapsed'}`} aria-label="Primary">
        <button
          className="nav-toggle"
          onClick={toggleNav}
          aria-expanded={navOpen}
          aria-label={navOpen ? 'Hide navigation menu' : 'Show navigation menu'}
        >
          <Icon name={navOpen ? 'chevron-up' : 'chevron-down'} size={14} />
          {!navOpen && <span className="nav-toggle-label">Menu</span>}
        </button>
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
