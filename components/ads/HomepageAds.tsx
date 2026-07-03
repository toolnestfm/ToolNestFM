'use client';

import HighPerformanceAd from './HighPerformanceAd';
import { AD_UNITS } from '@/lib/ads/units';

export function HomepageInlineAd() {
  return (
    <div className="ad-home-inline">
      <HighPerformanceAd
        adKey={AD_UNITS.leaderboard.key}
        width={AD_UNITS.leaderboard.width}
        height={AD_UNITS.leaderboard.height}
      />
    </div>
  );
}

export function FooterLeaderboardAd() {
  return (
    <div className="ad-footer-leaderboard">
      <HighPerformanceAd
        adKey={AD_UNITS.leaderboard.key}
        width={AD_UNITS.leaderboard.width}
        height={AD_UNITS.leaderboard.height}
      />
    </div>
  );
}
