'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import { searchTools, tools } from '@/data/tools';
import { getCategory } from '@/data/categories';
import { getApiKey, setApiKey, getModel, setModel } from '@/lib/ai';
import dynamic from 'next/dynamic';

const AiAssistantCore = dynamic(() => import('@/components/ai/AiAssistantCore'), { ssr: false });

/* ─────────────────────────── Context ─────────────────────────── */

interface Toast { id: number; text: string; kind: 'info' | 'success' | 'error' }

interface UIContextValue {
  openPalette: () => void;
  openAI: () => void;
  openSettings: () => void;
  toggleTheme: () => void;
  theme: string;
  toast: (text: string, kind?: Toast['kind']) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within GlobalUI');
  return ctx;
}

const accentFor = (cat: string): string => `var(--${getCategory(cat)?.accent || 'brand-primary'})`;

/* ─────────────────────────── Provider ─────────────────────────── */

export default function GlobalUI({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('toolnest_theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('toolnest_theme', next);
      return next;
    });
  }, []);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setAiOpen((o) => !o);
        setPaletteOpen(false);
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setAiOpen(false);
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value: UIContextValue = {
    openPalette: () => setPaletteOpen(true),
    openAI: () => setAiOpen(true),
    openSettings: () => setSettingsOpen(true),
    toggleTheme,
    theme,
    toast,
  };

  return (
    <UIContext.Provider value={value}>
      {children}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {aiOpen && (
        <>
          <div className="ai-panel-backdrop" onClick={() => setAiOpen(false)} aria-hidden />
          <AiAssistantCore layout="panel" onClose={() => setAiOpen(false)} onOpenSettings={() => setSettingsOpen(true)} />
        </>
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onSaved={() => toast('AI settings saved', 'success')} />}
      <div className="toast-wrap" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>
        ))}
      </div>
    </UIContext.Provider>
  );
}

/* ─────────────────────── Command Palette (⌘K) ─────────────────────── */

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const results = query.trim() ? searchTools(query).slice(0, 10) : tools.slice(0, 10);

  const go = (slug: string, category: string) => {
    onClose();
    router.push(`/tools/${category}/${slug}`);
  };

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-label="Search tools">
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            role="search"
            value={query}
            placeholder="Search 120+ tools..."
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
              if (e.key === 'Enter' && results[selected]) go(results[selected].slug, results[selected].category);
            }}
          />
          <span className="kbd-hint">ESC</span>
        </div>
        <div className="palette-results">
          {results.length === 0 && (
            <div className="palette-empty">No tools found for &ldquo;{query}&rdquo; — browse all 120+ tools instead.</div>
          )}
          {results.map((t, i) => (
            <button key={t.slug} className={`palette-item ${i === selected ? 'selected' : ''}`} onClick={() => go(t.slug, t.category)}>
              <span className="tool-icon" style={{ width: 30, height: 30, borderRadius: 8, marginBottom: 0, background: accentFor(t.category) }}>
                <Icon name={t.icon} size={15} />
              </span>
              <span>{t.name}</span>
              <span className="p-cat">{getCategory(t.category)?.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── AI Settings Modal ─────────────────────── */

function SettingsModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [key, setKey] = useState('');
  const [model, setModelState] = useState('gemini-2.0-flash');

  useEffect(() => {
    setKey(getApiKey());
    setModelState(getModel());
  }, []);

  const save = () => {
    setApiKey(key);
    setModel(model);
    onSaved();
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-label="AI settings">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>✨ AI Engine Settings</h3>
        <p className="modal-sub">
          <strong>100% Free — no API key needed.</strong> ToolNest AI works free in your browser (Gemini Flash).
          <br /><br />
          <strong>Optional (faster & unlimited):</strong> Paste a free Gemini key from{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>
          {' '}(2 min, no credit card).
        </p>
        <div className="field mb-4">
          <label>Gemini API Key</label>
          <input type="password" value={key} placeholder="AIza..." onChange={(e) => setKey(e.target.value)} />
        </div>
        <div className="field">
          <label>Model</label>
          <select value={model} onChange={(e) => setModelState(e.target.value)}>
            <option value="gemini-2.0-flash">gemini-2.0-flash (fast)</option>
            <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite (fastest)</option>
            <option value="gemini-2.5-flash">gemini-2.5-flash</option>
            <option value="gemini-2.5-pro">gemini-2.5-pro (best)</option>
          </select>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}
