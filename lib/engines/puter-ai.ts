import type { ChatMessage } from '@/lib/ai';

declare global {
  interface Window {
    puter?: {
      ai: {
        chat: (
          prompt: string | Array<{ role: string; content: string }>,
          options?: { stream?: boolean; model?: string; temperature?: number },
        ) => Promise<
          | { message?: { content?: string } }
          | AsyncIterable<{ type?: string; text?: string; message?: string }>
        >;
      };
    };
  }
}

const PUTER_SCRIPT = 'https://js.puter.com/v2/';
const PUTER_MODELS = ['gpt-5-nano', 'google/gemini-2.0-flash-lite', 'openai/gpt-4o-mini'];

let loadPromise: Promise<void> | null = null;

async function waitForPuter(maxMs = 8000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (window.puter?.ai) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Free AI loader timed out');
}

export function loadPuter(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Puter AI runs in browser only'));
  }
  if (window.puter?.ai) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    if (!document.querySelector(`script[src="${PUTER_SCRIPT}"]`)) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = PUTER_SCRIPT;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Could not load free AI script'));
        document.head.appendChild(script);
      });
    }
    await waitForPuter();
  })();

  return loadPromise;
}

function toPuterMessages(messages: ChatMessage[], system: string) {
  return [
    { role: 'system', content: system.slice(0, 8000) },
    ...messages.map((m) => ({ role: m.role, content: m.content.slice(0, 32000) })),
  ];
}

async function tryPuterModel(
  payload: Array<{ role: string; content: string }>,
  model: string,
  temperature: number,
  onChunk?: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (!window.puter?.ai) throw new Error('Puter not ready');

  // Non-streaming is more reliable with COOP headers
  const resp = await window.puter.ai.chat(payload, { stream: false, model, temperature });

  if (resp && typeof (resp as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    let full = '';
    for await (const part of resp as AsyncIterable<{ type?: string; text?: string; message?: string }>) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (part.type === 'error') throw new Error(part.message || 'Puter error');
      if (part.type === 'text' && part.text) {
        full += part.text;
        onChunk?.(full);
      }
    }
    if (!full.trim()) throw new Error('Empty Puter response');
    return full;
  }

  const text = (resp as { message?: { content?: string } })?.message?.content?.trim() || '';
  if (!text) throw new Error('Empty Puter response');
  onChunk?.(text);
  return text;
}

/** Puter.js browser fallback */
export async function puterChatComplete(
  messages: ChatMessage[],
  system: string,
  onChunk?: (text: string) => void,
  opts?: { temperature?: number; signal?: AbortSignal },
): Promise<string> {
  await loadPuter();
  const payload = toPuterMessages(messages, system);
  const temperature = opts?.temperature ?? 0.7;
  const errors: string[] = [];

  for (const model of PUTER_MODELS) {
    try {
      return await tryPuterModel(payload, model, temperature, onChunk, opts?.signal);
    } catch (e) {
      if (opts?.signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) throw e;
      errors.push(e instanceof Error ? e.message : model);
    }
  }

  throw new Error(errors.join(' · ') || 'Puter failed');
}
