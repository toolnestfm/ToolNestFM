import { apiErr, apiOk } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const rl = rateLimit(`unsub:${clientIp(req)}`, 5, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return apiErr('Invalid request body', 400);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return apiErr('Valid email address is required', 400);
  }

  const supabase = createAdminClient();
  if (supabase) {
    const { error } = await supabase
      .from('newsletter_subscribers')
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq('email', email);
    if (error) {
      console.error('[newsletter] unsubscribe failed:', error.message);
      return apiErr('Could not unsubscribe — please try again later', 500);
    }
  }

  // Always report success — do not reveal whether the email was subscribed.
  return apiOk({ unsubscribed: true });
}
