'use client';

import type { ChatMessage } from '@/lib/ai';
import { buildToolNestAiContext } from '@/lib/engines/toolnest-ai-context';

export type ChatPersona = 'general' | 'code' | 'creative' | 'analyst' | 'teacher' | 'pdf';

export interface ChatSettings {
  persona: ChatPersona;
  temperature: number;
  maxContextMessages: number;
  includeToolContext: boolean;
}

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  persona: 'general',
  temperature: 0.7,
  maxContextMessages: 24,
  includeToolContext: true,
};

export interface ChatAttachment {
  id: string;
  name: string;
  kind: 'pdf' | 'text';
  content: string;
  size: number;
  pageCount?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  attachments: ChatAttachment[];
  settings: ChatSettings;
}

export interface PersonaMeta {
  id: ChatPersona;
  label: string;
  icon: string;
  desc: string;
  system: string;
  prompts: string[];
}

const TOOLNEST_CONTEXT =
  'ToolNest (toolnestfm.com) — 128+ tools in one platform. Always link users directly to the exact tool URL; never generic navigation steps.';

export const CHAT_PERSONAS: PersonaMeta[] = [
  {
    id: 'general',
    label: 'General',
    icon: 'bot',
    desc: 'Everyday Q&A & productivity',
    system: `You are ToolNest AI — the in-app assistant on ToolNest. ${TOOLNEST_CONTEXT} Be helpful, accurate, and concise. When recommending a tool, always include a direct markdown link.`,
    prompts: ['Open PDF Converter for me', 'Which tool compresses PDF?', 'Summarize this topic in bullet points', 'Help me plan my week'],
  },
  {
    id: 'code',
    label: 'Code',
    icon: 'code',
    desc: 'Programming & debugging',
    system: `You are ToolNest Code AI — an expert software engineer. ${TOOLNEST_CONTEXT} Write clean, production-ready code with brief explanations. Use fenced code blocks with language tags.`,
    prompts: ['Review this code for bugs', 'Write a TypeScript utility function', 'Convert this to Python', 'Explain this error message'],
  },
  {
    id: 'creative',
    label: 'Creative',
    icon: 'sparkles',
    desc: 'Writing & brainstorming',
    system: `You are ToolNest Creative AI — a versatile writer and ideation partner. ${TOOLNEST_CONTEXT} Match tone to the user's request. Be vivid but not verbose.`,
    prompts: ['Write a catchy product tagline', 'Brainstorm 10 blog titles', 'Rewrite this professionally', 'Create a social media post'],
  },
  {
    id: 'analyst',
    label: 'Analyst',
    icon: 'table',
    desc: 'Data, research & strategy',
    system: `You are ToolNest Analyst AI — a research and strategy expert. ${TOOLNEST_CONTEXT} Structure answers with headers, pros/cons, and actionable recommendations.`,
    prompts: ['SWOT analysis for a SaaS startup', 'Compare iLovePDF vs ToolNest', 'Key metrics for a PDF tool', 'Summarize pros and cons'],
  },
  {
    id: 'teacher',
    label: 'Teacher',
    icon: 'presentation',
    desc: 'Learn & explain concepts',
    system: `You are ToolNest Teacher AI — patient, clear, and structured. ${TOOLNEST_CONTEXT} Use examples, analogies, and step-by-step explanations.`,
    prompts: ['Teach me how OCR works', 'Quiz me on JavaScript basics', 'Explain blockchain simply', 'Create a study outline'],
  },
  {
    id: 'pdf',
    label: 'PDF Expert',
    icon: 'file-text',
    desc: 'Document Q&A & summaries',
    system: `You are ToolNest PDF AI. Answer using ONLY the attached document content when provided. If the answer is not in the document, say so clearly. Cite page references when possible.`,
    prompts: ['Summarize this document', 'List all key dates and amounts', 'What are the action items?', 'Extract tables as markdown'],
  },
];

const SESSIONS_KEY = 'toolnest-ai-chat-sessions';
const ACTIVE_KEY = 'toolnest-ai-chat-active';

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getPersona(id: ChatPersona): PersonaMeta {
  return CHAT_PERSONAS.find((p) => p.id === id) ?? CHAT_PERSONAS[0];
}

export function createSession(partial?: Partial<ChatSession>): ChatSession {
  const now = Date.now();
  return {
    id: uid(),
    title: 'New chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
    attachments: [],
    settings: { ...DEFAULT_CHAT_SETTINGS, ...(partial?.settings ?? {}) },
    ...partial,
  };
}

export function loadSessions(): ChatSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSession[];
    return Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: ChatSession[]): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 50)));
  } catch { /* quota */ }
}

export function loadActiveSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveSessionId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch { /* */ }
}

export function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user');
  if (!first) return 'New chat';
  const t = first.content.trim().replace(/\s+/g, ' ');
  return t.length > 42 ? `${t.slice(0, 42)}…` : t;
}

export function buildSystemPrompt(
  settings: ChatSettings,
  attachments: ChatAttachment[],
  pdfMode: boolean,
  userQuery?: string,
): string {
  const persona = getPersona(pdfMode ? 'pdf' : settings.persona);
  const parts = [persona.system];

  if (settings.includeToolContext && settings.persona !== 'pdf' && !pdfMode) {
    parts.push(buildToolNestAiContext(userQuery));
  }

  if (attachments.length > 0) {
    parts.push('\n--- ATTACHED DOCUMENTS ---');
    for (const att of attachments) {
      parts.push(`\n[${att.name}${att.pageCount ? ` · ${att.pageCount} pages` : ''}]\n${att.content.slice(0, 80_000)}`);
    }
    parts.push('\n--- END DOCUMENTS ---');
  }

  return parts.join('\n');
}

export function trimMessages(messages: ChatMessage[], max: number): ChatMessage[] {
  if (messages.length <= max) return messages;
  return messages.slice(-max);
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function exportSessionMarkdown(session: ChatSession): string {
  const lines = [`# ${session.title}`, `*Exported from ToolNest AI Chat · ${new Date(session.updatedAt).toLocaleString()}*`, ''];
  for (const m of session.messages) {
    lines.push(`## ${m.role === 'user' ? 'You' : 'AI'}`, '', m.content, '');
  }
  return lines.join('\n');
}

export function exportSessionJson(session: ChatSession): string {
  return JSON.stringify(session, null, 2);
}

/** Lightweight markdown → safe HTML for chat bubbles */
export function renderChatMarkdown(text: string): string {
  if (!text) return '';

  const links: string[] = [];
  const src = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    const raw = String(url).trim();
    const href = raw.startsWith('http') || raw.startsWith('/')
      ? raw
      : `https://toolnestfm.com/${raw.replace(/^\//, '')}`;
    const safeLabel = String(label)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const safeHref = href.replace(/"/g, '&quot;');
    const idx = links.length;
    links.push(`<a href="${safeHref}" class="aichat-link" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`);
    return `\x00LNK${idx}\x00`;
  });

  let html = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang, code) => {
    const langClass = lang ? ` data-lang="${lang}"` : '';
    return `<pre class="aichat-code"${langClass}><code>${code.trim()}</code></pre>`;
  });
  html = html.replace(/`([^`\n]+)`/g, '<code class="aichat-inline">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (block) => `<ul class="aichat-list">${block}</ul>`);
  html = html.replace(/\n/g, '<br />');
  html = html.replace(/\x00LNK(\d+)\x00/g, (_m, i) => links[Number(i)] ?? '');
  return html;
}
