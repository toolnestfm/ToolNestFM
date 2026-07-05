import { createHmac, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { adjustCredits } from '@/lib/credits';
import { createNotification } from '@/lib/notifications';

/**
 * POST /api/billing/webhook — Stripe webhook handler.
 * Verifies the `stripe-signature` header (HMAC-SHA256) without the Stripe SDK.
 *
 * Handled events:
 *  - checkout.session.completed (subscription) → upgrade profile to PRO
 *  - checkout.session.completed (credits pack) → grant purchased credits
 *  - customer.subscription.deleted             → downgrade profile to FREE
 */

const TOLERANCE_SECONDS = 300;

function verifySignature(payload: string, header: string, secret: string): boolean {
  const parts = new Map(
    header.split(',').map((kv) => {
      const [k, ...rest] = kv.split('=');
      return [k.trim(), rest.join('=')] as const;
    }),
  );
  const timestamp = parts.get('t');
  const signature = parts.get('v1');
  if (!timestamp || !signature) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

interface StripeEvent {
  type: string;
  data: {
    object: {
      id?: string;
      mode?: string;
      client_reference_id?: string | null;
      customer?: string | null;
      subscription?: string | null;
      metadata?: Record<string, string> | null;
    };
  };
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: 'Webhook not configured' }, { status: 503 });

  const payload = await req.text();
  const signature = req.headers.get('stripe-signature') || '';
  if (!verifySignature(payload, signature, secret)) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return Response.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) return Response.json({ error: 'Database not configured' }, { status: 503 });

  const obj = event.data.object;

  if (event.type === 'checkout.session.completed' && obj.client_reference_id) {
    const isCreditsPurchase = obj.metadata?.type === 'credits';

    if (isCreditsPurchase) {
      const credits = Number(obj.metadata?.credits);
      if (Number.isInteger(credits) && credits > 0 && obj.id) {
        // Idempotency: Stripe retries webhooks — never grant the same session twice.
        const { data: existing } = await supabase
          .from('credit_ledger')
          .select('id')
          .eq('reason', 'purchase')
          .eq('meta->>session_id', obj.id)
          .maybeSingle();
        if (!existing) {
          try {
            await adjustCredits(supabase, obj.client_reference_id, credits, 'purchase', undefined, {
              session_id: obj.id,
            });
            void createNotification(supabase, obj.client_reference_id, {
              type: 'billing',
              title: `${credits.toLocaleString()} credits added`,
              body: 'Your credit pack purchase was successful. Use credits for AI tools and API calls.',
              href: '/dashboard/credits',
            });
          } catch (err) {
            console.error('[billing] credit grant failed:', err instanceof Error ? err.message : err);
            return Response.json({ error: 'Credit grant failed' }, { status: 500 });
          }
        }
      }
    } else {
      const { error } = await supabase
        .from('profiles')
        .update({
          plan: 'PRO',
          stripe_customer_id: obj.customer ?? null,
          stripe_subscription_id: obj.subscription ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', obj.client_reference_id);
      if (error) {
        console.error('[billing] upgrade failed:', error.message);
        return Response.json({ error: 'Update failed' }, { status: 500 });
      }
      void createNotification(supabase, obj.client_reference_id, {
        type: 'billing',
        title: 'Welcome to ToolNest Pro 👑',
        body: 'Your Pro subscription is active. Enjoy unlimited tools and premium features.',
        href: '/dashboard/billing',
      });
    }
  }

  if (event.type === 'customer.subscription.deleted' && obj.customer) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', obj.customer)
      .maybeSingle();

    const { error } = await supabase
      .from('profiles')
      .update({ plan: 'FREE', stripe_subscription_id: null, updated_at: new Date().toISOString() })
      .eq('stripe_customer_id', obj.customer);
    if (error) {
      console.error('[billing] downgrade failed:', error.message);
      return Response.json({ error: 'Update failed' }, { status: 500 });
    }

    if (profile?.id) {
      void createNotification(supabase, profile.id, {
        type: 'billing',
        title: 'Pro subscription ended',
        body: 'Your plan is now Free. Resubscribe anytime to restore Pro benefits.',
        href: '/dashboard/billing',
      });
    }
  }

  return Response.json({ received: true });
}
