import { apiErr, apiOk } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const rl = rateLimit(`contact:${clientIp(req)}`, 3, 10 * 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  let body: { name?: string; email?: string; message?: string };
  try {
    body = (await req.json()) as { name?: string; email?: string; message?: string };
  } catch {
    return apiErr('Invalid request body', 400);
  }

  const name = body.name?.trim().slice(0, 100);
  const email = body.email?.trim().toLowerCase();
  const message = body.message?.trim().slice(0, 5000);

  if (!name) return apiErr('Name is required', 400);
  if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return apiErr('Valid email address is required', 400);
  }
  if (!message) return apiErr('Message is required', 400);

  const supabase = createAdminClient();
  if (supabase) {
    const { error } = await supabase.from('contact_messages').insert({ name, email, message });
    if (error) {
      console.error('[contact] insert failed:', error.message);
      return apiErr('Could not send your message — please email hello@toolnestfm.com', 500);
    }
  }
  // Without Supabase configured we still return success so the form works in dev.

  return apiOk({ sent: true });
}
