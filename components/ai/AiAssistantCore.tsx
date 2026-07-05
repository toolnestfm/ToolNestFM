'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { useUI } from '@/components/GlobalUI';
import { aiComplete, getApiKey, getModel, type ActiveAiProvider, type ChatMessage } from '@/lib/ai';
import { extractPdfText } from '@/lib/pdf';
import { formatBytes } from '@/lib/download';
import {
  buildSystemPrompt,
  CHAT_PERSONAS,
  createSession,
  DEFAULT_CHAT_SETTINGS,
  deriveTitle,
  estimateTokens,
  exportSessionJson,
  exportSessionMarkdown,
  getPersona,
  loadActiveSessionId,
  loadSessions,
  renderChatMarkdown,
  saveActiveSessionId,
  saveSessions,
  trimMessages,
  uid,
  type ChatAttachment,
  type ChatPersona,
  type ChatSession,
  type ChatSettings,
} from '@/lib/engines/ai-chat-engine';

export interface AiAssistantCoreProps {
  layout: 'page' | 'panel';
  isPdfTool?: boolean;
  title?: string;
  onClose?: () => void;
  onOpenSettings?: () => void;
}

export default function AiAssistantCore({
  layout,
  isPdfTool = false,
  title,
  onClose,
  onOpenSettings,
}: AiAssistantCoreProps) {
  const { toast, openSettings: openGlobalSettings } = useUI();
  const openSettings = onOpenSettings ?? openGlobalSettings;

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(layout === 'page');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [attachBusy, setAttachBusy] = useState(false);
  const [activeProvider, setActiveProvider] = useState<ActiveAiProvider | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const session = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const persona = getPersona(isPdfTool ? 'pdf' : (session?.settings.persona ?? 'general'));
  const displayTitle = title ?? (isPdfTool ? 'AI PDF Assistant' : layout === 'panel' ? 'AI Assistant' : 'AI Chat Assistant');

  useEffect(() => {
    const loaded = loadSessions();
    const active = loadActiveSessionId();
    if (loaded.length) {
      setSessions(loaded);
      setActiveId(active && loaded.some((s) => s.id === active) ? active : loaded[0].id);
    } else {
      const initial = createSession({
        settings: { ...DEFAULT_CHAT_SETTINGS, persona: isPdfTool ? 'pdf' : 'general' },
      });
      setSessions([initial]);
      setActiveId(initial.id);
    }
  }, [isPdfTool]);

  useEffect(() => {
    if (!sessions.length || !activeId) return;
    saveSessions(sessions);
    saveActiveSessionId(activeId);
  }, [sessions, activeId]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: layout === 'panel' ? 'auto' : 'smooth' });
  }, [session?.messages, layout]);

  const patchSession = useCallback((id: string, patch: Partial<ChatSession>) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s)));
  }, []);

  const newChat = () => {
    const s = createSession({
      settings: { ...DEFAULT_CHAT_SETTINGS, persona: isPdfTool ? 'pdf' : 'general' },
    });
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
    setInput('');
    setHistoryOpen(false);
  };

  const deleteChat = (id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (!next.length) {
        const s = createSession();
        setActiveId(s.id);
        return [s];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  };

  const attachFile = async (file: File) => {
    if (!session) return;
    setAttachBusy(true);
    try {
      let att: ChatAttachment;
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const pages = await extractPdfText(file);
        att = {
          id: uid(), name: file.name, kind: 'pdf',
          content: pages.join('\n\n').slice(0, 80_000), size: file.size, pageCount: pages.length,
        };
      } else if (file.type.startsWith('text/') || /\.(txt|md|csv|html|json)$/i.test(file.name)) {
        att = { id: uid(), name: file.name, kind: 'text', content: (await file.text()).slice(0, 80_000), size: file.size };
      } else {
        toast('Supported: PDF, TXT, MD, CSV, HTML', 'error');
        return;
      }
      patchSession(session.id, {
        attachments: [...session.attachments, att],
        settings: { ...session.settings, persona: 'pdf' },
      });
      toast(`${file.name} attached`, 'success');
    } catch {
      toast('Could not read file', 'error');
    } finally {
      setAttachBusy(false);
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  };

  const sendMessage = async (textOverride?: string, historyBase?: ChatMessage[]) => {
    const text = (textOverride ?? input).trim();
    if (!text || busy || !session) return;
    if (isPdfTool && session.attachments.length === 0) {
      toast('Attach a PDF first', 'error');
      return;
    }

    setInput('');
    const userMsg: ChatMessage = { role: 'user', content: text };
    const base = historyBase ?? session.messages;
    const history = [...base, userMsg];
    const chatTitle = base.length === 0 ? deriveTitle([userMsg]) : session.title;

    patchSession(session.id, { title: chatTitle, messages: [...history, { role: 'assistant', content: '…' }] });
    setBusy(true);
    abortRef.current = new AbortController();

    const system = buildSystemPrompt(session.settings, session.attachments, isPdfTool, text);
    const context = trimMessages(history, session.settings.maxContextMessages);

    try {
      const full = await aiComplete(
        context, system,
        (streamed) => patchSession(session.id, { messages: [...history, { role: 'assistant', content: streamed }] }),
        { temperature: session.settings.temperature, model: getModel(), signal: abortRef.current.signal, onProvider: setActiveProvider },
      );
      patchSession(session.id, { messages: [...history, { role: 'assistant', content: full }] });
    } catch (err) {
      if (abortRef.current?.signal.aborted) {
        patchSession(session.id, { messages: history });
      } else {
        patchSession(session.id, {
          messages: [...history, { role: 'assistant', content: `⚠️ ${err instanceof Error ? err.message : 'Error'}` }],
        });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const regenerate = async () => {
    if (!session || busy) return;
    const msgs = [...session.messages];
    if (msgs.length < 2 || msgs[msgs.length - 1].role !== 'assistant') return;
    const trimmed = msgs.slice(0, -1);
    patchSession(session.id, { messages: [...trimmed, { role: 'assistant', content: '…' }] });
    setBusy(true);
    abortRef.current = new AbortController();
    const lastUser = [...trimmed].reverse().find((m) => m.role === 'user')?.content;
    const system = buildSystemPrompt(session.settings, session.attachments, isPdfTool, lastUser);
    const context = trimMessages(trimmed, session.settings.maxContextMessages);
    try {
      const full = await aiComplete(
        context, system,
        (streamed) => patchSession(session.id, { messages: [...trimmed, { role: 'assistant', content: streamed }] }),
        { temperature: session.settings.temperature, model: getModel(), signal: abortRef.current.signal, onProvider: setActiveProvider },
      );
      patchSession(session.id, { messages: [...trimmed, { role: 'assistant', content: full }] });
    } catch (err) {
      if (!abortRef.current?.signal.aborted) {
        patchSession(session.id, {
          messages: [...trimmed, { role: 'assistant', content: `⚠️ ${err instanceof Error ? err.message : 'Error'}` }],
        });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast('Copied', 'success');
    } catch {
      toast('Copy failed', 'error');
    }
  };

  const exportChat = (format: 'md' | 'json') => {
    if (!session) return;
    const blob = new Blob(
      [format === 'md' ? exportSessionMarkdown(session) : exportSessionJson(session)],
      { type: format === 'md' ? 'text/markdown' : 'application/json' },
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `toolnest-chat-${session.id.slice(0, 8)}.${format === 'md' ? 'md' : 'json'}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const setPersona = (p: ChatPersona) => {
    if (!session || isPdfTool) return;
    patchSession(session.id, { settings: { ...session.settings, persona: p } });
  };

  const updateSettings = (patch: Partial<ChatSettings>) => {
    if (!session) return;
    patchSession(session.id, { settings: { ...session.settings, ...patch } });
  };

  const tokenEst = session
    ? estimateTokens(session.messages.map((m) => m.content).join('') + session.attachments.map((a) => a.content).join(''))
    : 0;

  if (!session) return null;

  const personaStrip = !isPdfTool && (
    <div className="aichat-personas">
      {CHAT_PERSONAS.filter((p) => p.id !== 'pdf').map((p) => (
        <button key={p.id} type="button"
          className={`aichat-persona-chip ${session.settings.persona === p.id ? 'active' : ''}`}
          onClick={() => setPersona(p.id)} title={p.desc}>
          <Icon name={p.icon} size={13} /> {p.label}
        </button>
      ))}
    </div>
  );

  const settingsPanel = settingsOpen && (
    <div className="aichat-settings-panel">
      <label>Temperature <span>{session.settings.temperature.toFixed(1)}</span>
        <input type="range" min={0} max={1} step={0.1} value={session.settings.temperature}
          onChange={(e) => updateSettings({ temperature: +e.target.value })} />
      </label>
      <label>Context messages <span>{session.settings.maxContextMessages}</span>
        <input type="range" min={6} max={40} step={2} value={session.settings.maxContextMessages}
          onChange={(e) => updateSettings({ maxContextMessages: +e.target.value })} />
      </label>
      <label className="pdfconv-toggle">
        <input type="checkbox" checked={session.settings.includeToolContext}
          onChange={(e) => updateSettings({ includeToolContext: e.target.checked })} />
        ToolNest tool recommendations
      </label>
      <div className="aichat-settings-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => exportChat('json')}>Export JSON</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={openSettings}>API key & model</button>
      </div>
    </div>
  );

  const attachmentsBlock = (isPdfTool || session.attachments.length > 0) && (
    <div className="aichat-attachments">
      {isPdfTool && !session.attachments.length && (
        <div className="aichat-attach-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void attachFile(f); }}>
          <Icon name="upload" size={20} />
          <span>Drop PDF or click to attach</span>
        </div>
      )}
      {session.attachments.map((att) => (
        <div key={att.id} className="aichat-attach-chip">
          <Icon name="file-text" size={14} />
          <span>{att.name}</span>
          <em>{att.pageCount ? `${att.pageCount}p` : formatBytes(att.size)}</em>
          <button type="button" onClick={() => patchSession(session.id, { attachments: session.attachments.filter((a) => a.id !== att.id) })}>
            <Icon name="x" size={12} />
          </button>
        </div>
      ))}
      {!isPdfTool && (
        <button type="button" className="btn btn-outline btn-sm" disabled={attachBusy} onClick={() => fileRef.current?.click()}>
          <Icon name="folder" size={14} /> Attach
        </button>
      )}
    </div>
  );

  const messagesBlock = (
    <div className={`aichat-messages ${layout === 'panel' ? 'aichat-messages-panel' : ''}`} ref={bodyRef}>
      {session.messages.length === 0 && (
        <div className="aichat-welcome">
          <div className="aichat-welcome-icon"><Icon name="bot" size={layout === 'panel' ? 24 : 32} /></div>
          <h3>{persona.label} mode</h3>
          <p className="muted">{persona.desc}</p>
          <div className="aichat-prompts">
            {persona.prompts.slice(0, layout === 'panel' ? 3 : 4).map((p) => (
              <button key={p} type="button" className="aichat-prompt-chip" onClick={() => void sendMessage(p)} disabled={busy}>{p}</button>
            ))}
          </div>
        </div>
      )}
      {session.messages.map((m, i) => (
        <div key={i} className={`aichat-bubble-wrap ${m.role}`}>
          <div className={`aichat-bubble ${m.role}`}>
            {m.role === 'assistant' && m.content !== '…' ? (
              <div className="aichat-md" dangerouslySetInnerHTML={{ __html: renderChatMarkdown(m.content) }} />
            ) : (
              <span>{m.content}</span>
            )}
          </div>
          {m.role === 'assistant' && m.content !== '…' && (
            <div className="aichat-bubble-actions">
              <button type="button" onClick={() => void copyMessage(m.content)} title="Copy"><Icon name="copy" size={12} /></button>
              {i === session.messages.length - 1 && (
                <button type="button" onClick={() => void regenerate()} title="Regenerate" disabled={busy}>
                  <Icon name="refresh" size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      {busy && <div className="aichat-typing"><span /><span /><span /></div>}
    </div>
  );

  const inputBlock = (
    <div className="aichat-input-area">
      <div className="aichat-input-row">
        {!isPdfTool && (
          <button type="button" className="aichat-attach-btn" onClick={() => fileRef.current?.click()} disabled={attachBusy} aria-label="Attach">
            <Icon name="link" size={16} />
          </button>
        )}
        <textarea value={input} rows={1}
          placeholder={isPdfTool ? 'Ask about your PDF…' : `Message ${persona.label} AI…`}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
          disabled={busy} />
        {busy ? (
          <button type="button" className="aichat-send stop" onClick={stopGeneration} aria-label="Stop"><Icon name="ban" size={16} /></button>
        ) : (
          <button type="button" className="aichat-send" onClick={() => void sendMessage()} disabled={!input.trim()} aria-label="Send">
            <Icon name="send" size={17} />
          </button>
        )}
      </div>
      <div className="aichat-input-meta">
        <span className="pdfword-privacy-badge" style={{ margin: 0, padding: '4px 10px', fontSize: 11 }}>
          <Icon name="shield" size={12} />
          {getApiKey() ? 'Your Gemini · unlimited' : activeProvider ? `100% Free · ${activeProvider.label}` : '100% Free AI'}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={openSettings}>
          {getApiKey() ? 'AI Settings' : 'Free Gemini key →'}
        </button>
      </div>
    </div>
  );

  const fileInput = (
    <input ref={fileRef} type="file" hidden
      accept={isPdfTool ? 'application/pdf' : 'application/pdf,.txt,.md,.csv,.html,.json'}
      onChange={(e) => { const f = e.target.files?.[0]; if (f) void attachFile(f); e.target.value = ''; }} />
  );

  const headerActions = (
    <div className="aichat-header-actions">
      <button type="button" className="btn btn-ghost btn-sm" onClick={newChat} title="New chat"><Icon name="sparkles" size={14} /></button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => exportChat('md')} title="Export"><Icon name="download" size={14} /></button>
      <button type="button" className={`btn btn-ghost btn-sm ${settingsOpen ? 'active' : ''}`} onClick={() => setSettingsOpen((v) => !v)} title="Settings">
        <Icon name="settings" size={14} />
      </button>
    </div>
  );

  if (layout === 'panel') {
    return (
      <div className="ai-panel-advanced" role="dialog" aria-label="AI Assistant">
        <div className="ai-panel-head">
          <span className="aichat-avatar sm"><Icon name="sparkles" size={15} /></span>
          <div className="ai-panel-head-meta">
            <b>{displayTitle}</b>
            <span className="muted">{activeProvider?.label || (getApiKey() ? 'Your Gemini' : 'Free AI')} · ~{tokenEst.toLocaleString()} tok</span>
          </div>
          <div className="ai-panel-head-actions">
            <div className="ai-panel-history-wrap">
              <button type="button" className="icon-btn" onClick={() => setHistoryOpen((v) => !v)} aria-label="Chat history">
                <Icon name="clock" size={16} />
              </button>
              {historyOpen && (
                <div className="ai-panel-history-menu">
                  <button type="button" className="ai-panel-history-new" onClick={newChat}><Icon name="sparkles" size={13} /> New chat</button>
                  {sessions.map((s) => (
                    <div key={s.id} className={`ai-panel-history-item ${s.id === activeId ? 'active' : ''}`}>
                      <button type="button" onClick={() => { setActiveId(s.id); setHistoryOpen(false); }}>{s.title}</button>
                      <button type="button" className="del" onClick={() => deleteChat(s.id)} aria-label="Delete"><Icon name="x" size={11} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="icon-btn" onClick={() => setSettingsOpen((v) => !v)} aria-label="Settings"><Icon name="settings" size={16} /></button>
            <Link href="/tools/ai/ai-chat" className="icon-btn" title="Open full chat" onClick={onClose}><Icon name="scaling" size={16} /></Link>
            {onClose && (
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={17} /></button>
            )}
          </div>
        </div>

        {personaStrip}
        {settingsPanel}
        {attachmentsBlock}
        {fileInput}
        {messagesBlock}
        {inputBlock}
      </div>
    );
  }

  return (
    <div className="aichat-shell">
      <aside className={`aichat-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="aichat-sidebar-head">
          <button type="button" className="btn btn-primary btn-sm aichat-new-btn" onClick={newChat}>
            <Icon name="sparkles" size={14} /> New chat
          </button>
          <button type="button" className="icon-btn" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle sidebar">
            <Icon name="menu" size={16} />
          </button>
        </div>
        <div className="aichat-session-list">
          {sessions.map((s) => (
            <div key={s.id} className={`aichat-session-item ${s.id === activeId ? 'active' : ''}`}>
              <button type="button" className="aichat-session-btn" onClick={() => setActiveId(s.id)}>
                <Icon name="type" size={14} /><span>{s.title}</span>
              </button>
              <button type="button" className="aichat-session-del" onClick={() => deleteChat(s.id)} aria-label="Delete">
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="aichat-main">
        <header className="aichat-header">
          <div className="aichat-header-left">
            <span className="aichat-avatar"><Icon name="sparkles" size={18} /></span>
            <div>
              <b>{displayTitle}</b>
              <span className="muted">
                {activeProvider?.label || (getApiKey() ? 'Your Gemini' : 'Free AI')} · ~{tokenEst.toLocaleString()} tokens
              </span>
            </div>
          </div>
          {headerActions}
        </header>
        {personaStrip}
        {settingsPanel}
        {attachmentsBlock}
        {fileInput}
        {messagesBlock}
        {inputBlock}
      </div>
    </div>
  );
}
