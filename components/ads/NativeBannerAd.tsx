'use client';

import { NATIVE_BANNER } from '@/lib/ads/config';

interface NativeBannerAdProps {
  /** Reserved height to keep layout CLS-safe while the ad fills in. */
  minHeight?: number;
  className?: string;
}

// Adsterra Native Banner loads an async invoke.js that fills a container div by
// id. Running it inside an isolated srcDoc iframe keeps the parent DOM clean,
// avoids duplicate-container-id clashes when placed more than once, and reserves
// a fixed box so it never shifts page content (CLS-safe).
export default function NativeBannerAd({ minHeight = 260, className }: NativeBannerAdProps) {
  const srcDoc = `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent;font-family:system-ui,sans-serif}</style></head><body><script async data-cfasync="false" src="${NATIVE_BANNER.scriptSrc}"></script><div id="${NATIVE_BANNER.containerId}"></div></body></html>`;

  return (
    <iframe
      title="sponsored-native"
      srcDoc={srcDoc}
      className={`ad-native ${className ?? ''}`}
      style={{ width: '100%', minHeight, border: 0, display: 'block', overflow: 'hidden' }}
      scrolling="no"
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      loading="lazy"
    />
  );
}
