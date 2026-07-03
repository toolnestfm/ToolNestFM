import { apiErr } from '@/lib/api-response';
import type { ChatMessage } from '@/lib/ai';
import { geminiStreamServer } from '@/lib/gemini/server';
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

const DEFAULT_SYSTEM =
  'You are ToolNest AI, a helpful assistant inside the ToolNest platform (toolnestfm.com) which offers 120+ online tools. Be concise and helpful.';

const BURST_LIMIT = 8;               // per minute per IP
const FREE_DAILY_LIMIT = 10;         // messages/day for free/anonymous users
const DAY_MS = 24 * 60 * 60 * 1000;

async function getCallerPlan(): Promise<{ userId: string | null; plan: string }> {
  if (!getSupabaseEnv()) return { userId: null, plan: 'FREE' };
  try {
    const { supabase } = await createRouteHandlerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { userId: null, plan: 'FREE' };
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle();
    return { userId: user.id, plan: profile?.plan ?? 'FREE' };
  } catch {
    return { userId: null, plan: 'FREE' };
  }
}

export async function POST(req: Request) {
  const ip = clientIp(req);

  // Burst protection for everyone.
  const burst = rateLimit(`ai:burst:${ip}`, BURST_LIMIT, 60_000);
  if (!burst.allowed) return rateLimitResponse(burst.retryAfterSeconds);

  // Daily quota — Pro/Enterprise unlimited, everyone else 10/day.
  const { userId, plan } = await getCallerPlan();
  if (plan !== 'PRO' && plan !== 'ENTERPRISE') {
    const identity = userId ? `user:${userId}` : `ip:${ip}`;
    const daily = rateLimit(`ai:daily:${identity}`, FREE_DAILY_LIMIT, DAY_MS);
    if (!daily.allowed) {
      return apiErr(
        'Daily free AI limit reached (10 messages). Upgrade to Pro for unlimited AI, or add your own Gemini API key in AI Settings.',
        429,
      );
    }
  }

  try {
    const body = (await req.json()) as {
      messages?: ChatMessage[];
      system?: string;
      model?: string;
    };

    if (!body.messages?.length) {
      return apiErr('messages array is required', 400);
    }
    if (body.messages.length > 50) {
      return apiErr('Conversation too long — start a new chat', 400);
    }
    const totalChars = body.messages.reduce((n, m) => n + (m.content?.length || 0), 0);
    if (totalChars > 100_000) {
      return apiErr('Message content too large', 400);
    }

    if (!process.env.GEMINI_API_KEY) {
      return apiErr('Server AI is not configured', 503);
    }

    // Model name goes into the Gemini URL — strict allowlist pattern only.
    const model = body.model && /^gemini-[a-z0-9.-]{1,40}$/.test(body.model) ? body.model : undefined;

    const system = (body.system || DEFAULT_SYSTEM).slice(0, 4000);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const text of geminiStreamServer(body.messages!, system, model)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : 'AI generation failed';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch {
    return apiErr('Invalid request body', 400);
  }
}
