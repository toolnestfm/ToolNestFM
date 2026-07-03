import { apiErr, apiOk } from '@/lib/api-response';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { getSupabaseEnv } from '@/lib/supabase/env';

/** Credit packs — one-time Stripe payments (inline price_data, no dashboard setup needed). */
const PACKS: Record<string, { credits: number; usdCents: number; label: string }> = {
  starter: { credits: 100, usdCents: 500, label: 'Starter — 100 credits' },
  plus: { credits: 500, usdCents: 2000, label: 'Plus — 500 credits' },
  mega: { credits: 2000, usdCents: 6000, label: 'Mega — 2,000 credits' },
};

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return apiErr('Billing is not configured yet — set STRIPE_SECRET_KEY', 503);
  }
  if (!getSupabaseEnv()) return apiErr('Auth is not configured', 503);

  const { supabase } = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return apiErr('Sign in to buy credits', 401);

  let body: { pack?: string };
  try {
    body = (await req.json()) as { pack?: string };
  } catch {
    return apiErr('Invalid request body', 400);
  }
  const pack = PACKS[body.pack ?? ''];
  if (!pack) return apiErr(`Unknown pack — choose one of: ${Object.keys(PACKS).join(', ')}`, 400);

  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

  const params = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(pack.usdCents),
    'line_items[0][price_data][product_data][name]': `ToolNest Credits — ${pack.label}`,
    'line_items[0][quantity]': '1',
    client_reference_id: user.id,
    customer_email: user.email,
    'metadata[type]': 'credits',
    'metadata[credits]': String(pack.credits),
    success_url: `${origin}/dashboard/credits?checkout=success`,
    cancel_url: `${origin}/dashboard/credits?checkout=cancelled`,
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const session = (await res.json()) as { url?: string; error?: { message?: string } };
  if (!res.ok || !session.url) {
    console.error('[billing] credits checkout failed:', session.error?.message);
    return apiErr('Could not start checkout — please try again later', 502);
  }

  return apiOk({ url: session.url });
}
