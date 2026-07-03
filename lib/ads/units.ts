export interface AdUnit {
  key: string;
  width: number;
  height: number;
  zone: string;
  label: string;
}

export const AD_UNITS = {
  leaderboard: {
    key: 'b1780628a1c912b6a395bf47ae9fea58',
    width: 728,
    height: 90,
    zone: 'ad_footer',
    label: 'Leaderboard 728×90',
  },
  sidebarRectangle: {
    key: 'e2efc9b76a67508b450d9bc0abf06d9b',
    width: 300,
    height: 250,
    zone: 'ad_sidebar',
    label: 'Sidebar Rectangle 300×250',
  },
  mobileBanner: {
    key: 'c2bfb926f258a4c01a2aa011ab5b42f5',
    width: 320,
    height: 50,
    zone: 'ad_tool_bottom',
    label: 'Mobile Banner 320×50',
  },
  sidebarSkyscraper: {
    key: '4c42e20bfad33b1c08e5171a0afa8b0e',
    width: 160,
    height: 600,
    zone: 'ad_sidebar',
    label: 'Sidebar Skyscraper 160×600',
  },
} as const satisfies Record<string, AdUnit>;

export type AdUnitName = keyof typeof AD_UNITS;
