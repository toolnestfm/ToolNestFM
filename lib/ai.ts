'use client';

/**
 * Universal AI Engine — always free for users
 * 1. User Gemini key (optional, unlimited)
 * 2. Pollinations gen.pollinations.ai (free, no key)
 * 3. Server /api/ai/chat (Gemini → Groq → OpenRouter → Pollinations)
 * 4. Puter.js browser fallback
 */

export interface ActiveAiProvider {
  provider: 'gemini' | 'groq' | 'openrouter' | 'user-gemini' | 'puter' | 'pollinations';
  model: string;
  label: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Gemini Flash',
  groq: 'Llama 3.3 70B (Groq)',
  openrouter: 'Llama 3.3 70B (Free)',
  'user-gemini': 'Your Gemini',
  pollinations: 'Free GPT',
};

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const KEY_STORAGE = 'toolnest_gemini_key';
const MODEL_STORAGE = 'toolnest_gemini_model';

export function getApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(KEY_STORAGE) || '';
}

export function setApiKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key.trim());
}

export function getModel(): string {
  if (typeof window === 'undefined') return 'gemini-2.0-flash';
  return localStorage.getItem(MODEL_STORAGE) || 'gemini-2.0-flash';
}

export function setModel(model: string): void {
  localStorage.setItem(MODEL_STORAGE, model);
}

export interface AiStreamOptions {
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
  onProvider?: (info: ActiveAiProvider) => void;
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
    || (err instanceof Error && err.message.includes('Aborted'));
}

function isKeyOrQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const s = err.message.toLowerCase();
  return /403|401|429|quota|api key|invalid|expired|billing|permission/.test(s);
}

async function geminiComplete(
  messages: ChatMessage[],
  system: string,
  onChunk?: (text: string) => void,
  opts?: AiStreamOptions,
): Promise<string> {
  const key = getApiKey();
  const model = opts?.model || getModel();
  const body: Record<string, unknown> = {
    system_instruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
  };
  if (opts?.temperature !== undefined) {
    body.generationConfig = { temperature: opts.temperature };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: opts?.signal,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 200)}`);
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';
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
        const json = JSON.parse(payload);
        const text: string = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
        if (text) {
          full += text;
          onChunk?.(full);
        }
      } catch {
        /* partial chunk */
      }
    }
  }
  if (!full.trim()) throw new Error('Gemini returned empty response');
  return full;
}

async function serverGeminiComplete(
  messages: ChatMessage[],
  system: string,
  onChunk?: (text: string) => void,
  opts?: AiStreamOptions,
): Promise<string> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      system,
      model: opts?.model,
      temperature: opts?.temperature,
    }),
    signal: opts?.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    const e = new Error(err.error || `Server AI error (${res.status})`) as Error & { status?: number };
    e.status = res.status;
    throw e;
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream from server AI');
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload) as {
          text?: string;
          error?: string;
          provider?: string;
          model?: string;
        };
        if (json.error) throw new Error(json.error);
        if (json.provider && json.model) {
          opts?.onProvider?.({
            provider: json.provider as ActiveAiProvider['provider'],
            model: json.model,
            label: PROVIDER_LABELS[json.provider] || json.model,
          });
        }
        if (json.text) {
          full = json.text;
          onChunk?.(full);
        }
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e;
      }
    }
  }
  if (!full.trim()) throw new Error('Server AI returned empty response');
  return full;
}

async function freePollinationsComplete(
  messages: ChatMessage[],
  system: string,
  onChunk?: (text: string) => void,
  opts?: AiStreamOptions,
): Promise<string> {
  const { pollinationsChatComplete } = await import('@/lib/engines/pollinations-ai');
  opts?.onProvider?.({ provider: 'pollinations', model: 'openai', label: PROVIDER_LABELS.pollinations });
  return pollinationsChatComplete(messages, system, onChunk, opts);
}

async function freePuterComplete(
  messages: ChatMessage[],
  system: string,
  onChunk?: (text: string) => void,
  opts?: AiStreamOptions,
): Promise<string> {
  const { puterChatComplete } = await import('@/lib/engines/puter-ai');
  opts?.onProvider?.({ provider: 'puter', model: 'gpt-5-nano', label: PROVIDER_LABELS.puter });
  return puterChatComplete(messages, system, onChunk, opts);
}

async function runFreeChain(
  messages: ChatMessage[],
  system: string,
  onChunk?: (text: string) => void,
  opts?: AiStreamOptions,
): Promise<string> {
  const errors: string[] = [];

  try {
    return await freePollinationsComplete(messages, system, onChunk, opts);
  } catch (e) {
    if (isAbort(e)) throw e;
    errors.push(e instanceof Error ? e.message : 'Pollinations failed');
  }

  try {
    return await serverGeminiComplete(messages, system, onChunk, opts);
  } catch (e) {
    if (isAbort(e)) throw e;
    errors.push(e instanceof Error ? e.message : 'Server failed');
  }

  try {
    return await freePuterComplete(messages, system, onChunk, opts);
  } catch (e) {
    if (isAbort(e)) throw e;
    errors.push(e instanceof Error ? e.message : 'Puter failed');
  }

  throw new Error(errors.join(' · ') || 'All free AI providers failed');
}

/** Run an AI completion. Streams via onChunk (receives the FULL text so far). */
export async function aiComplete(
  messages: ChatMessage[],
  system = 'You are ToolNest AI, a helpful assistant inside the ToolNest platform (toolnestfm.com) which offers 120+ online tools. Be concise and helpful.',
  onChunk?: (text: string) => void,
  opts?: AiStreamOptions,
): Promise<string> {
  if (getApiKey()) {
    opts?.onProvider?.({ provider: 'user-gemini', model: opts?.model || getModel(), label: 'Your Gemini' });
    try {
      return await geminiComplete(messages, system, onChunk, opts);
    } catch (err) {
      if (isAbort(err)) throw err;
      if (isKeyOrQuotaError(err)) {
        return runFreeChain(messages, system, onChunk, opts);
      }
      throw err;
    }
  }

  return runFreeChain(messages, system, onChunk, opts);
}

/** Generate an image; returns an object URL of the image blob. */
export async function aiImage(prompt: string, width = 1024, height = 1024): Promise<string> {
  const seed = Math.floor(Math.random() * 1e9);
  const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image generation failed (${res.status}). Please try again.`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
