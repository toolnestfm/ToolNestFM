export function getAdsterraApiKey(): string {
  return process.env.ADSTERRA_API_KEY ?? '';
}

export const ADSTERRA_API_BASE = 'https://api3.adsterratools.com/publisher';

export const AD_INVOKE_BASE = 'https://www.highperformanceformat.com';
