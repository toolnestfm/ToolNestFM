'use client';

import { useEffect, useRef, useId } from 'react';
import { AD_INVOKE_BASE } from '@/lib/ads/config';

interface HighPerformanceAdProps {
  adKey: string;
  width: number;
  height: number;
  className?: string;
}

export default function HighPerformanceAd({ adKey, width, height, className }: HighPerformanceAdProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const uniqueId = useId();

  useEffect(() => {
    if (loadedRef.current || !containerRef.current) return;
    loadedRef.current = true;

    const container = containerRef.current;

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.text = `
      atOptions = {
        'key' : '${adKey}',
        'format' : 'iframe',
        'height' : ${height},
        'width' : ${width},
        'params' : {}
      };
    `;
    container.appendChild(script);

    const invokeScript = document.createElement('script');
    invokeScript.type = 'text/javascript';
    invokeScript.src = `${AD_INVOKE_BASE}/${adKey}/invoke.js`;
    container.appendChild(invokeScript);

    return () => {
      container.innerHTML = '';
      loadedRef.current = false;
    };
  }, [adKey, width, height]);

  return (
    <div
      ref={containerRef}
      id={`ad-${uniqueId}`}
      className={`ad-container ${className ?? ''}`}
      style={{ width, height, maxWidth: '100%', overflow: 'hidden', margin: '0 auto' }}
      data-ad-key={adKey}
    />
  );
}
