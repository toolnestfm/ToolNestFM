import type { ChatMessage } from '@/lib/ai';

export type FreeLlmProvider = 'gemini' | 'groq' | 'openrouter' | 'pollinations';

export interface ProviderInfo {
  id: FreeLlmProvider;
  model: string;
  label: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://toolnestfm.com';

/** Parse OpenAI-compatible SSE stream; yields cumulative text. */
async function* parseOpenAiSseStream(res: Response): AsyncGenerator<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream');
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: string }; message?: { content?: string } }[];
          error?: { message?: string };
        };
        if (json.error?.message) throw new Error(json.error.message);
        const delta =
          json.choices?.[0]?.delta?.content ??
          json.choices?.[0]?.message?.content ??
          '';
        if (delta) {
          full += delta;
          yield full;
        }
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e;
      }
    }
  }
}

function toOpenAiMessages(messages: ChatMessage[], system: string) {
  return [
    { role: 'system' as const, content: system },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
}

export async function* groqStreamServer(
  messages: ChatMessage[],
  system: string,
  temperature?: number,
): AsyncGenerator<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not configured');

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: toOpenAiMessages(messages, system),
      temperature: temperature ?? 0.7,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error (${res.status}): ${err.slice(0, 200)}`);
  }

  yield* parseOpenAiSseStream(res);
}

export async function* openRouterStreamServer(
  messages: ChatMessage[],
  system: string,
  temperature?: number,
): AsyncGenerator<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not configured');

  const model = process.env.OPENROUTER_FREE_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': APP_URL,
      'X-Title': 'ToolNest',
    },
    body: JSON.stringify({
      model,
      messages: toOpenAiMessages(messages, system),
      temperature: temperature ?? 0.7,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error (${res.status}): ${err.slice(0, 200)}`);
  }

  yield* parseOpenAiSseStream(res);
}

export function getAvailableProviders(): ProviderInfo[] {
  const out: ProviderInfo[] = [];
  if (process.env.GEMINI_API_KEY) {
    out.push({ id: 'gemini', model: process.env.GEMINI_MODEL || 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' });
  }
  if (process.env.GROQ_API_KEY) {
    out.push({ id: 'groq', model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq)' });
  }
  if (process.env.OPENROUTER_API_KEY) {
    const m = process.env.OPENROUTER_FREE_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
    out.push({ id: 'openrouter', model: m, label: 'Llama 3.3 70B (Free)' });
  }
  out.push({ id: 'pollinations', model: 'openai', label: 'Free GPT (Pollinations)' });
  return out;
}

export async function* streamWithFallback(
  messages: ChatMessage[],
  system: string,
  model?: string,
  temperature?: number,
): AsyncGenerator<{ text: string; provider: FreeLlmProvider; model: string }> {
  const errors: string[] = [];

  if (process.env.GROQ_API_KEY) {
    try {
      const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
      for await (const text of groqStreamServer(messages, system, temperature)) {
        yield { text, provider: 'groq', model: groqModel };
      }
      return;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Groq failed');
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    try {
      const orModel = process.env.OPENROUTER_FREE_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
      for await (const text of openRouterStreamServer(messages, system, temperature)) {
        yield { text, provider: 'openrouter', model: orModel };
      }
      return;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'OpenRouter failed');
    }
  }

  try {
    const { pollinationsStreamServer } = await import('@/lib/engines/pollinations-ai');
    for await (const text of pollinationsStreamServer(messages, system, temperature)) {
      yield { text, provider: 'pollinations', model: 'openai' };
    }
    return;
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'Pollinations failed');
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const { geminiStreamServer } = await import('./server');
      const geminiModel = model && model.startsWith('gemini-') ? model : (process.env.GEMINI_MODEL || 'gemini-2.0-flash');
      for await (const text of geminiStreamServer(messages, system, geminiModel, temperature)) {
        yield { text, provider: 'gemini', model: geminiModel };
      }
      return;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Gemini failed');
    }
  }

  throw new Error(
    errors.length
      ? `All AI providers failed: ${errors.join(' · ')}`
      : 'No AI provider configured. Add a free Gemini key in AI Settings (aistudio.google.com) or ask admin to set GEMINI_API_KEY / GROQ_API_KEY on the server.',
  );
}
