/**
 * In-memory sliding-window rate limiter.
 * Per-serverless-instance (no Redis needed) — resets on cold start, which is
 * acceptable for abuse protection. Swap the store for Redis/Upstash to make
 * limits global across instances.
 */

interface Bucket {
  timestamps: number[];
}

const store = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/** Allow at most `limit` hits per `windowMs` for the given key. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  // Bounded memory: drop everything if the map grows too large.
  if (store.size > MAX_KEYS) store.clear();

  let bucket = store.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    store.set(key, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  bucket.timestamps.push(now);
  return { allowed: true, remaining: limit - bucket.timestamps.length, retryAfterSeconds: 0 };
}

/** Best-effort client identity: IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

/** Standard 429 response matching the app's API envelope. */
export function rateLimitResponse(retryAfterSeconds: number): Response {
  return Response.json(
    {
      success: false,
      data: null,
      error: 'Too many requests — please slow down and try again shortly.',
      meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
    },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
}
