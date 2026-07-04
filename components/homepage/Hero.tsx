'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Icon from '../Icon';
import { useUI } from '../GlobalUI';
import { searchTools } from '@/data/tools';
import { formatCount } from '@/lib/format-count';

const chipMap: Record<string, string> = {
  'PDF to Word': '/tools/pdf/pdf-to-word',
  'Image Compressor': '/tools/image/image-compressor',
  'Background Remover': '/tools/image/background-remover',
  'AI Chat': '/tools/ai/ai-chat',
  'Video Converter': '/tools/video/video-converter',
};

const orbitChips = [
  { icon: 'image', color: 'var(--accent-image)', style: { top: '-6%', left: '18%', animationDelay: '0s' } },
  { icon: 'bot', color: 'var(--accent-ai)', style: { top: '-12%', right: '12%', animationDelay: '0.5s' } },
  { icon: 'file-text', color: 'var(--accent-pdf)', style: { top: '22%', left: '-16%', animationDelay: '1s' } },
  { icon: 'code', color: 'var(--brand-primary)', style: { top: '18%', right: '-16%', animationDelay: '1.5s' } },
  { icon: 'video', color: 'var(--accent-dev)', style: { bottom: '18%', right: '-10%', animationDelay: '2s' } },
  { icon: 'music', color: 'var(--accent-audio)', style: { bottom: '4%', left: '-8%', animationDelay: '2.5s' } },
  { icon: 'type', color: 'var(--accent-dev)', style: { top: '42%', left: '-24%', animationDelay: '3s' } },
];

export default function Hero() {
  const { openAI, toast } = useUI();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [stats, setStats] = useState<{ users: number; jobs: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/stats/public');
        const json = (await res.json()) as { success: boolean; data?: { users: number | null; jobs: number | null } };
        if (!cancelled && json.success && typeof json.data?.users === 'number') {
          setStats({ users: json.data.users, jobs: json.data.jobs ?? 0 });
        }
      } catch { /* keep fallback text */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const search = () => {
    const r = searchTools(q);
    if (r.length > 0) router.push(`/tools/${r[0].category}/${r[0].slug}`);
    else toast(`No tools found for "${q}"`, 'error');
  };

  return (
    <section className="hero">
      <div className="container hero-grid">
        {/* Left */}
        <div className="hero-left">
          <span className="eyebrow"><Icon name="sparkles" size={14} /> Smart Tools Ecosystem</span>
          <h1 className="hero-h1">
            One Platform.<br />
            Infinite Tools.<br />
            <span className="gradient-text">Powered by AI.</span>
          </h1>
          <p className="hero-sub">Everything you need to work faster, smarter and better — all in one place.</p>

          <div className="hero-search" role="search">
            <input
              value={q}
              placeholder="Search any tool or type your task..."
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              aria-label="Search any tool"
            />
            <button className="hero-search-btn" onClick={search} aria-label="Search"><Icon name="search" size={18} /></button>
          </div>

          <div className="chips">
            {Object.entries(chipMap).map(([label, href]) => (
              <Link key={label} href={href} className="chip">{label}</Link>
            ))}
          </div>

          <div className="cta-row">
            <Link href="/tools" className="btn btn-primary">Explore All Tools <Icon name="arrow-right" size={16} /></Link>
            <button className="btn btn-outline" onClick={openAI}><Icon name="sparkles" size={15} /> Try AI Assistant</button>
          </div>

          <div className="social-proof">
            <div className="avatars">
              {['#7c3aed', '#c026d3', '#3b82f6', '#22c55e', '#f97316'].map((c, i) => (
                <span key={i} className="avatar-c" style={{ background: c }}>{'TNAFR'[i]}</span>
              ))}
            </div>
            <div>
              <div className="stars">★★★★★</div>
              <div className="proof-text">
                {stats
                  ? `Trusted by ${formatCount(stats.users)} users · ${formatCount(stats.jobs)} tool runs`
                  : 'Loved by our growing community'}
              </div>
            </div>
          </div>
        </div>

        {/* Center — cube */}
        <div className="hero-visual" aria-hidden="true">
          <div className="cube-glow" />
          <div className="cube-scene">
            <div className="cube-wrap">
              <div className="cube-face" style={{ transform: 'rotateY(0deg) translateZ(110px)' }} />
              <div className="cube-face" style={{ transform: 'rotateY(90deg) translateZ(110px)' }} />
              <div className="cube-face" style={{ transform: 'rotateY(180deg) translateZ(110px)' }} />
              <div className="cube-face" style={{ transform: 'rotateY(270deg) translateZ(110px)' }} />
              <div className="cube-face" style={{ transform: 'rotateX(90deg) translateZ(110px)' }} />
              <div className="cube-face" style={{ transform: 'rotateX(-90deg) translateZ(110px)' }} />
            </div>
            <div className="cube-core" />
            {orbitChips.map((c, i) => (
              <span key={i} className="orbit-chip" style={{ background: c.color, ...c.style }}>
                <Icon name={c.icon} size={22} />
              </span>
            ))}
          </div>
        </div>

        {/* Right — Why ToolNest */}
        <aside className="why-card glass">
          <span className="why-crown"><Icon name="crown" size={26} fill="var(--gold-premium)" strokeWidth={1.5} /></span>
          <h3>Why ToolNest?</h3>
          <ul className="why-list">
            {['120+ Powerful Tools', 'AI-Powered Features', 'Blazing Fast Processing', 'Secure & Private', 'Cloud Storage (100GB)', 'No Ads, Ever'].map((f) => (
              <li key={f}><span className="why-check"><Icon name="check" size={16} strokeWidth={3} /></span> {f}</li>
            ))}
          </ul>
          <button className="btn btn-gold w-full" onClick={() => toast('Pro upgrade coming soon — you already have PRO! 👑', 'success')}>
            <Icon name="crown" size={16} /> Upgrade to Pro
          </button>
          <p className="why-note">No credit card required</p>
        </aside>
      </div>
    </section>
  );
}
