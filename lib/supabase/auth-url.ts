/** Canonical app URL for OAuth redirects (Vercel production or local dev). */
export function getAppOrigin(fallbackOrigin?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, '');
  return 'http://localhost:3000';
}

export function getAuthCallbackUrl(origin: string, next = '/dashboard'): string {
  return `${origin.replace(/\/$/, '')}/auth/callback?next=${encodeURIComponent(next)}`;
}
