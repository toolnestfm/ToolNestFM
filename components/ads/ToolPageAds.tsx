'use client';

import HighPerformanceAd from './HighPerformanceAd';
import { AD_UNITS } from '@/lib/ads/units';

export default function ToolPageAds() {
  return (
    <>
      {/* Desktop: bottom leaderboard (728x90) */}
      <div className="ad-tool-bottom-desktop">
        <HighPerformanceAd
          adKey={AD_UNITS.leaderboard.key}
          width={AD_UNITS.leaderboard.width}
          height={AD_UNITS.leaderboard.height}
        />
      </div>

      {/* Mobile: bottom banner (320x50) */}
      <div className="ad-tool-bottom-mobile">
        <HighPerformanceAd
          adKey={AD_UNITS.mobileBanner.key}
          width={AD_UNITS.mobileBanner.width}
          height={AD_UNITS.mobileBanner.height}
        />
      </div>
    </>
  );
}

export function ToolPageSidebarAds() {
  return (
    <div className="ad-tool-sidebar">
      <HighPerformanceAd
        adKey={AD_UNITS.sidebarRectangle.key}
        width={AD_UNITS.sidebarRectangle.width}
        height={AD_UNITS.sidebarRectangle.height}
      />
      <HighPerformanceAd
        adKey={AD_UNITS.sidebarSkyscraper.key}
        width={AD_UNITS.sidebarSkyscraper.width}
        height={AD_UNITS.sidebarSkyscraper.height}
        className="ad-skyscraper"
      />
    </div>
  );
}
