'use client';

import { useEffect, useState } from 'react';
import { formatCount } from '@/lib/format-count';

/** Real per-tool usage counter, fed by the jobs table. */
export default function ToolUsageStat({ slug }: { slug: string }) {
  const [uses, setUses] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/stats/public?tool=${encodeURIComponent(slug)}`);
        const json = (await res.json()) as { success: boolean; data?: { toolUses: number | null } };
        if (!cancelled && json.success && typeof json.data?.toolUses === 'number') {
          setUses(json.data.toolUses);
        }
      } catch { /* offline — keep fallback */ }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (uses === null) return <span>Free &amp; unlimited</span>;
  if (uses === 0) return <span>Free &amp; unlimited</span>;
  return <span>Used {formatCount(uses)} time{uses === 1 ? '' : 's'}</span>;
}
