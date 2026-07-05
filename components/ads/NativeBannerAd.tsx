'use client';

import { NATIVE_BANNER } from '@/lib/ads/config';

interface NativeBannerAdProps {
  /** Fixed box height — bounds the native banner so a single large creative
   *  can't blow up into a giant image (keeps a leaderboard-like strip). */
  height?: number;
  className?: string;
}

// Adsterra Native Banner loads an async invoke.js that fills a container div by
// id. Running it inside an isolated srcDoc iframe keeps the parent DOM clean,
// lets the same unit appear more than once (each iframe is its own document),
// and reserves a fixed box so it never shifts page content (CLS-safe).
export default function NativeBannerAd({ height = 110, className }: NativeBannerAdProps) {
  const srcDoc = `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;font-family:system-ui,sans-serif}</style></head><body><script async data-cfasync="false" src="${NATIVE_BANNER.scriptSrc}"></script><div id="${NATIVE_BANNER.containerId}"></div></body></html>`;

  return (
    <iframe
      title="sponsored-native"
      srcDoc={srcDoc}
      className={`ad-native ${className ?? ''}`}
      style={{ width: '100%', height, border: 0, display: 'block', overflow: 'hidden' }}
      scrolling="no"
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      loading="lazy"
    />
  );
}
