'use client';

import AdSlot from './AdSlot';
import NativeBannerAd from './NativeBannerAd';
import HighPerformanceAd from './HighPerformanceAd';
import { SMARTLINK_URL } from '@/lib/ads/config';
import { AD_UNITS } from '@/lib/ads/units';

/** Ad 1 — directly below the tool workspace. Native banner on desktop,
 *  a compact 320×50 on mobile. */
export function ToolWorkspaceAd() {
  return (
    <>
      <div className="ad-desktop-only">
        <AdSlot minHeight={260}><NativeBannerAd /></AdSlot>
      </div>
      <div className="ad-mobile-only">
        <AdSlot minHeight={60}>
          <HighPerformanceAd
            adKey={AD_UNITS.mobileBanner.key}
            width={AD_UNITS.mobileBanner.width}
            height={AD_UNITS.mobileBanner.height}
          />
        </AdSlot>
      </div>
    </>
  );
}

/** Ad 2 — before the FAQ (desktop leaderboard only). */
export function ToolPreFaqAd() {
  return (
    <div className="ad-desktop-only">
      <AdSlot minHeight={100}>
        <HighPerformanceAd
          adKey={AD_UNITS.leaderboard.key}
          width={AD_UNITS.leaderboard.width}
          height={AD_UNITS.leaderboard.height}
        />
      </AdSlot>
    </div>
  );
}

/** Ad 3 — before the footer. 300×250 on desktop, 320×50 on mobile (2nd mobile ad). */
export function ToolPreFooterAd() {
  return (
    <>
      <div className="ad-desktop-only">
        <AdSlot minHeight={260}>
          <HighPerformanceAd
            adKey={AD_UNITS.sidebarRectangle.key}
            width={AD_UNITS.sidebarRectangle.width}
            height={AD_UNITS.sidebarRectangle.height}
          />
        </AdSlot>
      </div>
      <div className="ad-mobile-only">
        <AdSlot minHeight={60}>
          <HighPerformanceAd
            adKey={AD_UNITS.mobileBanner.key}
            width={AD_UNITS.mobileBanner.width}
            height={AD_UNITS.mobileBanner.height}
          />
        </AdSlot>
      </div>
    </>
  );
}

/** Optional Smartlink — an explicit "more free tools" link, never an auto-redirect. */
export function ToolSmartlink() {
  return (
    <a className="ad-smartlink" href={SMARTLINK_URL} target="_blank" rel="nofollow sponsored noopener">
      Explore more free tools &rarr;
    </a>
  );
}
