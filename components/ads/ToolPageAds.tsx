'use client';

import AdSlot from './AdSlot';
import HighPerformanceAd from './HighPerformanceAd';
import { SMARTLINK_URL } from '@/lib/ads/config';
import { AD_UNITS } from '@/lib/ads/units';

/** Clean fixed 728×90 leaderboard — a predictable horizontal strip that can
 *  never balloon into a giant creative. */
function Leaderboard() {
  return (
    <HighPerformanceAd
      adKey={AD_UNITS.leaderboard.key}
      width={AD_UNITS.leaderboard.width}
      height={AD_UNITS.leaderboard.height}
    />
  );
}

function MobileBanner() {
  return (
    <HighPerformanceAd
      adKey={AD_UNITS.mobileBanner.key}
      width={AD_UNITS.mobileBanner.width}
      height={AD_UNITS.mobileBanner.height}
    />
  );
}

/** Ad 1 — top of the tool, above the workspace. 728×90 desktop / 320×50 mobile. */
export function ToolTopAd() {
  return (
    <>
      <div className="ad-desktop-only"><AdSlot minHeight={104}><Leaderboard /></AdSlot></div>
      <div className="ad-mobile-only"><AdSlot minHeight={62}><MobileBanner /></AdSlot></div>
    </>
  );
}

/** Ad 2 — below the primary action / workspace. 728×90 (desktop only). */
export function ToolMidAd() {
  return (
    <div className="ad-desktop-only"><AdSlot minHeight={104}><Leaderboard /></AdSlot></div>
  );
}

/** Ad 3 — before the footer. 728×90 desktop / 320×50 mobile (2nd mobile ad). */
export function ToolPreFooterAd() {
  return (
    <>
      <div className="ad-desktop-only"><AdSlot minHeight={104}><Leaderboard /></AdSlot></div>
      <div className="ad-mobile-only"><AdSlot minHeight={62}><MobileBanner /></AdSlot></div>
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
