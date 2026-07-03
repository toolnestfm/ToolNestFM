import { apiErr } from '@/lib/api-response';
import { geminiCompleteServer } from '@/lib/gemini/server';
import { readJson, requireApiKey, withCredits } from '@/lib/api-v1';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/summarize — summarize text. 1 credit.
 * Body: { "text": "...", "length"?: "short" | "medium" | "long", "language"?: "English" }
 */
export async function POST(req: Request) {
  const gate = await requireApiKey(req, 30);
  if (!gate.ok) return gate.response;

  const body = await readJson<{ text?: string; length?: string; language?: string }>(req);
  if (!body) return apiErr('Invalid JSON body', 400);

  const text = body.text?.trim();
  if (!text) return apiErr('text is required', 400);
  if (text.length > 100_000) return apiErr('text too large (max 100,000 characters)', 400);
  if (!process.env.GEMINI_API_KEY) return apiErr('AI backend is not configured', 503);

  const length = ['short', 'medium', 'long'].includes(body.length ?? '') ? body.length : 'medium';
  const language = (body.language || 'the same language as the input').slice(0, 40);

  const system = `You are a precise summarizer. Produce a ${length} summary in ${language}. Return only the summary — no preamble.`;

  return withCredits(gate.ctx, 1, async () => {
    const summary = await geminiCompleteServer([{ role: 'user', content: text }], system);
    return { summary };
  });
}
