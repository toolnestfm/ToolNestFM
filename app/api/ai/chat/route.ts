import { apiErr } from '@/lib/api-response';
import type { ChatMessage } from '@/lib/ai';
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { createAdminClient } from '@/lib/supabase/admin';
import { adjustCredits, InsufficientCreditsError } from '@/lib/credits';

import { buildToolNestDefaultSystem } from '@/lib/engines/toolnest-ai-context';

const BURST_LIMIT = 12;              // per minute per IP
const FREE_DAILY_LIMIT = 50;        // server messages/day — then auto-falls back to free client AI
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
  // Signed-in users past the free limit can keep going by spending 1 credit per message.
  const { userId, plan } = await getCallerPlan();
  if (plan !== 'PRO' && plan !== 'ENTERPRISE') {
    const identity = userId ? `user:${userId}` : `ip:${ip}`;
    const daily = rateLimit(`ai:daily:${identity}`, FREE_DAILY_LIMIT, DAY_MS);
    if (!daily.allowed) {
      const admin = userId ? createAdminClient() : null;
      if (admin && userId) {
        try {
          await adjustCredits(admin, userId, -1, 'ai_chat');
        } catch (err) {
          if (err instanceof InsufficientCreditsError) {
            return apiErr(
              'Daily free AI limit reached and you have no credits left. Get credits at /dashboard/credits, upgrade to Pro, or add your own Gemini API key in AI Settings.',
              429,
            );
          }
          return apiErr('Credit check failed — try again', 500);
        }
      } else {
        return apiErr(
          'Daily server AI limit reached — switching to free browser AI automatically. Or add your own Gemini key in AI Settings for unlimited.',
          429,
        );
      }
    }
  }

  try {
    const body = (await req.json()) as {
      messages?: ChatMessage[];
      system?: string;
      model?: string;
      temperature?: number;
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

    if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY && !process.env.OPENROUTER_API_KEY) {
      // No server keys — Pollinations free fallback still works in streamWithFallback
    }

    const model = body.model && /^[a-z0-9./:_-]{1,80}$/i.test(body.model) ? body.model : undefined;

    const lastUser = [...(body.messages ?? [])].reverse().find((m) => m.role === 'user')?.content;
    const system = (body.system || buildToolNestDefaultSystem(lastUser)).slice(0, 16_000);
    const encoder = new TextEncoder();
    const { streamWithFallback } = await import('@/lib/gemini/free-providers');

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let providerSent = false;
          for await (const chunk of streamWithFallback(body.messages!, system, model, body.temperature)) {
            if (!providerSent) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ provider: chunk.provider, model: chunk.model })}\n\n`));
              providerSent = true;
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.text })}\n\n`));
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
