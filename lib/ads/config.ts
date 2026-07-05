export function getAdsterraApiKey(): string {
  return process.env.ADSTERRA_API_KEY ?? '';
}

export const ADSTERRA_API_BASE = 'https://api3.adsterratools.com/publisher';

export const AD_INVOKE_BASE = 'https://www.highperformanceformat.com';

/** Native Banner unit (container-div + async invoke.js — a different format
 *  from the atOptions iframe banners). One container id per unit. */
export const NATIVE_BANNER = {
  scriptSrc: 'https://pl27641228.effectivecpmnetwork.com/d00af1ca89d3edeb4709f9260a10c3c2/invoke.js',
  containerId: 'container-d00af1ca89d3edeb4709f9260a10c3c2',
} as const;

/** Smartlink — only used behind explicit "more tools" links, never auto-redirect. */
export const SMARTLINK_URL =
  'https://www.effectivecpmnetwork.com/wcuquimmj?key=c93be2f14420c09fdc86de6937513639';
