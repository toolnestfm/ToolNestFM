import type { ChatMessage } from '@/lib/ai';

/** Legacy Pollinations text API — free, no API key, works server + browser. */
const TEXT_BASE = 'https://text.pollinations.ai';
const GEN_BASE = 'https://gen.pollinations.ai';
const DEFAULT_MODEL = 'openai';

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/plain, application/json, */*',
};

function buildPrompt(messages: ChatMessage[], _system: string): string {
  void _system; // system goes via the URL param, not the prompt body
  if (messages.length === 1 && messages[0].role === 'user') {
    return messages[0].content.slice(0, 8000);
  }
  const lines: string[] = [];
  for (const m of messages) {
    lines.push(`${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 4000)}`);
  }
  return lines.join('\n\n').slice(0, 8000);
}

/** Primary free path — text.pollinations.ai (reliable, no key). */
async function pollinationsTextGet(
  prompt: string,
  system: string,
  onChunk?: (text: string) => void,
  opts?: { model?: string; temperature?: number; signal?: AbortSignal },
): Promise<string> {
  const params = new URLSearchParams({
    model: opts?.model || DEFAULT_MODEL,
    system: system.slice(0, 2000),
    temperature: String(opts?.temperature ?? 0.7),
  });
  const url = `${TEXT_BASE}/${encodeURIComponent(prompt.slice(0, 8000))}?${params}`;
  const res = await fetch(url, { headers: BROWSER_HEADERS, signal: opts?.signal });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Free AI error (${res.status}): ${err.slice(0, 180)}`);
  }
  const text = (await res.text()).trim();
  if (!text) throw new Error('Free AI returned empty response');
  onChunk?.(text);
  return text;
}

/** Browser-only POST fallback. */
async function pollinationsGenPost(
  messages: ChatMessage[],
  system: string,
  onChunk?: (text: string) => void,
  opts?: { model?: string; temperature?: number; signal?: AbortSignal },
): Promise<string> {
  const prefix = `[Instructions: ${system.slice(0, 2000)}]\n\n`;
  const payload = messages.map((m, i) => ({
    role: m.role,
    content: i === 0 && m.role === 'user' ? prefix + m.content : m.content.slice(0, 16000),
  }));

  const res = await fetch(`${GEN_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { ...BROWSER_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts?.model || 'openai-fast',
      messages: payload,
      stream: false,
      temperature: opts?.temperature ?? 0.7,
    }),
    signal: opts?.signal,
  });

  if (!res.ok) throw new Error(`Free AI error (${res.status})`);

  const raw = await res.text();
  try {
    const json = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('Empty response');
    onChunk?.(content);
    return content;
  } catch {
    const text = raw.trim();
    if (!text) throw new Error('Empty response');
    onChunk?.(text);
    return text;
  }
}

/** Free text — no API key required. */
export async function pollinationsChatComplete(
  messages: ChatMessage[],
  system: string,
  onChunk?: (text: string) => void,
  opts?: { model?: string; temperature?: number; signal?: AbortSignal },
): Promise<string> {
  if (!messages.length) throw new Error('No messages');
  const prompt = buildPrompt(messages, system);
  const errors: string[] = [];

  try {
    return await pollinationsTextGet(prompt, system, onChunk, opts);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'text API failed');
  }

  if (typeof window !== 'undefined') {
    try {
      return await pollinationsGenPost(messages, system, onChunk, opts);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'gen API failed');
    }
  }

  throw new Error(errors.join(' · ') || 'Free AI failed');
}

/** Server-side stream wrapper for /api/ai/chat. */
export async function* pollinationsStreamServer(
  messages: ChatMessage[],
  system: string,
  temperature?: number,
): AsyncGenerator<string> {
  const full = await pollinationsChatComplete(messages, system, undefined, { temperature });
  yield full;
}
