/** Canonical app URL — always prefer the live request origin so PKCE cookies match the callback domain. */
export function getAppOrigin(fallbackOrigin?: string): string {
  if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, '');
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return 'http://localhost:3000';
}

export function getAuthCallbackUrl(origin: string, next = '/dashboard'): string {
  return `${origin.replace(/\/$/, '')}/auth/callback?next=${encodeURIComponent(next)}`;
}
