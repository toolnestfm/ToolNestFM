'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon';
import { tools } from '@/data/tools';
import { categories } from '@/data/categories';

function CountUp({ target, suffix, decimals = 0 }: { target: number; suffix: string; decimals?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const t0 = performance.now();
          const dur = 1200;
          const tick = (t: number) => {
            const p = Math.min((t - t0) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(target * eased);
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);

  return <span ref={ref}>{val.toFixed(decimals)}{suffix}</span>;
}

export default function StatsBar() {
  const [live, setLive] = useState<{ users: number; jobs: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/stats/public');
        const json = (await res.json()) as { success: boolean; data?: { users: number | null; jobs: number | null } };
        if (!cancelled && json.success && typeof json.data?.users === 'number') {
          setLive({ users: json.data.users, jobs: json.data.jobs ?? 0 });
        }
      } catch { /* stats stay at catalog-only values */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = [
    { icon: 'users', value: live?.users ?? 0, suffix: '', label: 'Registered Users', color: 'var(--brand-primary)' },
    { icon: 'grid', value: tools.length, suffix: '', label: 'Powerful Tools', color: 'var(--accent-ai)' },
    { icon: 'grid', value: categories.length, suffix: '', label: 'Categories', color: 'var(--success-green)' },
    { icon: 'check-circle', value: live?.jobs ?? 0, suffix: '', label: 'Tasks Completed', color: 'var(--accent-dev)' },
    { icon: 'zap', value: 100, suffix: '%', label: 'Free to Use', color: 'var(--accent-calculator)' },
    { icon: 'lock', value: 100, suffix: '%', label: 'Secure & Private', color: 'var(--gold-premium)' },
  ];

  return (
    <div className="container">
      <div className="stats-bar glass">
        {stats.map((s) => (
          <div key={s.label} className="stat">
            <span className="stat-icon" style={{ background: 'color-mix(in srgb, ' + s.color + ' 15%, transparent)', color: s.color }}>
              <Icon name={s.icon} size={20} />
            </span>
            <span className="stat-value"><CountUp key={`${s.label}-${s.value}`} target={s.value} suffix={s.suffix} decimals={0} /></span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
