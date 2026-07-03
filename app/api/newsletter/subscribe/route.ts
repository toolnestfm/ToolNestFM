import { apiErr, apiOk } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit';

// Fallback store for local dev without Supabase (not persistent).
const memorySubscribers = new Set<string>();

export async function POST(req: Request) {
  const rl = rateLimit(`newsletter:${clientIp(req)}`, 5, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  let body: { email?: string; source?: string };
  try {
    body = (await req.json()) as { email?: string; source?: string };
  } catch {
    return apiErr('Invalid request body', 400);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return apiErr('Valid email address is required', 400);
  }
  const source = (body.source || 'homepage').slice(0, 50);

  const supabase = createAdminClient();
  if (supabase) {
    const { error } = await supabase
      .from('newsletter_subscribers')
      .upsert({ email, source, unsubscribed_at: null }, { onConflict: 'email' });
    if (error) {
      console.error('[newsletter] insert failed:', error.message);
      return apiErr('Subscription failed — please try again later', 500);
    }
  } else {
    memorySubscribers.add(email);
  }

  return apiOk({ subscribed: true, email, source });
}
