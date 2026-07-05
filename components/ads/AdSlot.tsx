'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';

interface AdSlotProps {
  /** Reserved min-height so the slot never shifts layout (CLS-safe). */
  minHeight: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * Wraps an ad unit: hidden entirely for Pro/Enterprise users, reserves a fixed
 * box to avoid layout shift, and only mounts the ad once it scrolls near the
 * viewport (defers third-party requests for faster initial load).
 */
export default function AdSlot({ minHeight, className, children }: AdSlotProps) {
  const { user, loading } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  const isPro = user?.plan === 'pro' || user?.plan === 'enterprise';

  useEffect(() => {
    // Must depend on `loading`: the slot div only mounts after auth resolves,
    // so the observer has to attach on that re-render — otherwise inView never
    // fires and the ad never mounts.
    if (loading || isPro) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) { setInView(true); obs.disconnect(); }
      },
      { rootMargin: '300px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading, isPro]);

  // Don't reserve space (or flash an ad) for Pro users, and wait for auth to resolve.
  if (loading || isPro) return null;

  // Reserves exactly the ad height (CLS-safe) with no border/box/label/padding —
  // the ad takes only its own size.
  return (
    <div ref={ref} className={`ad-slot ${className ?? ''}`} style={{ minHeight }} aria-hidden>
      {inView && children}
    </div>
  );
}
