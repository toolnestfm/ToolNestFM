'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { Tool } from '@/data/tools';
import Icon from '@/components/Icon';
import { ErrorBox, ShareButton, useToolPhase, type ResultFile } from '../shared';
import { useUI } from '@/components/GlobalUI';
import { formatBytes, downloadBlob } from '@/lib/download';
import { recordJob } from '@/lib/jobs';
import {
  analyzePdfLayout,
  type PdfProfile,
} from '@/lib/engines/pdf-layout-analyzer';
import {
  convertPdfBatchToWord,
  DEFAULT_PDF_TO_WORD_OPTIONS,
  loadPdfToWordSession,
  savePdfToWordSession,
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  type ConversionMode,
  type PdfToWordOptions,
  type PdfToWordResult,
} from '@/lib/engines/pdf-to-word-engine';
import { GOV_PRESETS, type GovPresetId } from '@/lib/engines/gov-pdf-presets';
import { isPdfEncrypted } from '@/lib/engines/merge-pdf-engine';

const ShareModal = dynamic(() => import('../ShareModal'), { ssr: false });

const STEPS = ['Upload', 'Analyze', 'Options', 'Convert', 'Review'] as const;
type Step = 0 | 1 | 2 | 3 | 4;

const OCR_LANG_OPTIONS = [
  { id: 'ben+eng', label: 'Bengali + English' },
  { id: 'hin+eng', label: 'Hindi + English' },
  { id: 'eng', label: 'English' },
  { id: 'ben+eng+hin', label: 'Bengali + Hindi + English' },
  { id: 'tam+eng', label: 'Tamil + English' },
  { id: 'tel+eng', label: 'Telugu + English' },
];

function Steps({ current }: { current: number }) {
  return (
    <div className="pdfconv-steps" aria-label="PDF to Word progress">
      {STEPS.map((s, i) => (
        <div key={s} className={`pdfconv-step ${i < current ? 'done' : ''} ${i === current ? 'active' : ''}`}>
          <span className="pdfconv-step-dot">
            {i < current ? <Icon name="check" size={12} /> : i + 1}
          </span>
          <span className="pdfconv-step-label">{s}</span>
          {i < STEPS.length - 1 && <span className="pdfconv-step-line" aria-hidden />}
        </div>
      ))}
    </div>
  );
}

function ProgressRing({ progress, label }: { progress: number; label: string }) {
  const pct = Math.round(progress * 100);
  const r = 52;
  const circ = 2 * Math.PI * r;
  return (
    <div className="pdfconv-progress-ring-wrap">
      <svg className="pdfconv-progress-ring" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke="var(--brand-primary)" strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.3s', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        />
      </svg>
      <div className="pdfconv-progress-text"><b>{pct}%</b><span>{label}</span></div>
    </div>
  );
}

function FabDropdown({
  open,
  anchorRef,
  wide,
  children,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, transform: 'none' as string });

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const menuW = wide ? 280 : 240;
      const gap = 10;
      let left = r.right + gap;
      let top = r.top;
      let transform = 'none';
      if (left + menuW > window.innerWidth - 12) left = Math.max(12, r.left - menuW - gap);
      if (top + 280 > window.innerHeight - 12) {
        top = r.top;
        transform = 'translateY(calc(-100% - 8px))';
      }
      setPos({ top, left, transform });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchorRef, wide]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`mergepdf-fab-menu mergepdf-fab-menu-portal ${wide ? 'mergepdf-fab-menu-wide' : ''}`}
      style={{ top: pos.top, left: pos.left, transform: pos.transform }}
      role="menu"
    >
      {children}
    </div>,
    document.body,
  );
}

function FabRail({
  options,
  setOptions,
  onShare,
  onOpenAi,
}: {
  options: PdfToWordOptions;
  setOptions: (o: PdfToWordOptions) => void;
  onShare?: () => void;
  onOpenAi: () => void;
}) {
  const [openMenu, setOpenMenu] = useState<'settings' | 'history' | 'ai' | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const aiRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (railRef.current?.contains(t)) return;
      if ((t as Element).closest?.('.mergepdf-fab-menu-portal')) return;
      setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const toggle = (menu: 'settings' | 'history' | 'ai') => {
    setOpenMenu((m) => (m === menu ? null : menu));
  };

  return (
    <div ref={railRef} className="mergepdf-fab-rail" aria-label="Quick actions">
      <div ref={aiRef} className="mergepdf-fab-wrap">
        <button type="button" className={`mergepdf-fab mergepdf-fab-ai ${openMenu === 'ai' ? 'active' : ''}`} title="AI Assistant" onClick={() => toggle('ai')}>
          <Icon name="sparkles" size={18} />
        </button>
        <FabDropdown open={openMenu === 'ai'} anchorRef={aiRef}>
          <p className="mergepdf-fab-menu-title"><Icon name="sparkles" size={14} /> AI Assistant</p>
          <button type="button" className="mergepdf-fab-menu-item" onClick={() => { setOpenMenu(null); onOpenAi(); }}>
            <Icon name="wand" size={15} /> Fix layout with AI
          </button>
          <Link className="mergepdf-fab-menu-item" href="/tools/ai/ai-chat"><Icon name="bot" size={15} /> Full AI Chat</Link>
        </FabDropdown>
      </div>
      <div ref={historyRef} className="mergepdf-fab-wrap">
        <button type="button" className={`mergepdf-fab ${openMenu === 'history' ? 'active' : ''}`} title="History" onClick={() => toggle('history')}>
          <Icon name="clock" size={18} />
        </button>
        <FabDropdown open={openMenu === 'history'} anchorRef={historyRef}>
          <p className="mergepdf-fab-menu-title"><Icon name="clock" size={14} /> History</p>
          <Link className="mergepdf-fab-menu-item" href="/dashboard/history"><Icon name="file-text" size={15} /> Conversion jobs</Link>
          <Link className="mergepdf-fab-menu-item" href="/dashboard"><Icon name="grid" size={15} /> Dashboard</Link>
        </FabDropdown>
      </div>
      <div ref={settingsRef} className="mergepdf-fab-wrap">
        <button type="button" className={`mergepdf-fab ${openMenu === 'settings' ? 'active' : ''}`} title="Settings" onClick={() => toggle('settings')}>
          <Icon name="settings" size={18} />
        </button>
        <FabDropdown open={openMenu === 'settings'} anchorRef={settingsRef} wide>
          <p className="mergepdf-fab-menu-title"><Icon name="settings" size={14} /> Defaults</p>
          <label className="pdfconv-toggle">
            <input type="checkbox" checked={options.aiIndicRepair} onChange={(e) => setOptions({ ...options, aiIndicRepair: e.target.checked })} />
            AI Indic text repair
          </label>
          <label className="pdfconv-toggle">
            <input type="checkbox" checked={options.deskew} onChange={(e) => setOptions({ ...options, deskew: e.target.checked })} />
            Deskew scans
          </label>
          <p className="mergepdf-fab-menu-note"><Icon name="shield" size={11} /> 100% browser processing</p>
        </FabDropdown>
      </div>
      {onShare && (
        <div className="mergepdf-fab-wrap">
          <button type="button" className="mergepdf-fab" title="Share" onClick={onShare}><Icon name="share" size={18} /></button>
        </div>
      )}
    </div>
  );
}

function ConfidencePanel({ result }: { result: PdfToWordResult }) {
  const c = result.confidence;
  const bars = [
    { label: 'Text coverage', value: c.textCoverage },
    { label: 'Tables', value: c.tableIntegrity },
    { label: 'Images', value: c.imagePlacement },
    { label: 'Fonts', value: c.fontAccuracy },
    { label: 'OCR', value: c.ocrConfidence },
    { label: 'Indic repair', value: c.indicRepair },
  ];
  return (
    <div className="pdfword-confidence">
      <div className="pdfword-confidence-score">
        <b>{c.overall}</b>
        <span>Confidence Score</span>
      </div>
      <div className="pdfword-confidence-bars">
        {bars.map((b) => (
          <div key={b.label} className="pdfword-conf-row">
            <span>{b.label}</span>
            <div className="pdfword-conf-track"><div style={{ width: `${b.value}%` }} /></div>
            <em>{b.value}%</em>
          </div>
        ))}
      </div>
      <ul className="pdfword-conf-issues">
        {c.issues.map((issue) => <li key={issue}>{issue}</li>)}
      </ul>
    </div>
  );
}

export default function PdfToWordRunner({ tool }: { tool: Tool }) {
  const { toast, openAI } = useUI();
  const { phase, setPhase, error, fail, reset } = useToolPhase();

  const [step, setStep] = useState<Step>(0);
  const [files, setFiles] = useState<File[]>([]);
  const [profile, setProfile] = useState<PdfProfile | null>(null);
  const [options, setOptions] = useState<PdfToWordOptions>(DEFAULT_PDF_TO_WORD_OPTIONS);
  const [password, setPassword] = useState('');
  const [passwordNeeded, setPasswordNeeded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [convertProgress, setConvertProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<PdfToWordResult | null>(null);
  const [batchResults, setBatchResults] = useState<PdfToWordResult[]>([]);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputName, setOutputName] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [excludedPages, setExcludedPages] = useState<Set<number>>(new Set());
  const [logOpen, setLogOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const prev = loadPdfToWordSession();
    if (prev) {
      setOptions(prev.options);
      toast(`Previous session: ${prev.fileNames.join(', ')} — re-upload to continue`, 'info');
    }
  }, [toast]);

  useEffect(() => {
    if (!files.length) return;
    savePdfToWordSession({
      fileNames: files.map((f) => f.name),
      options,
      step,
      savedAt: Date.now(),
    });
  }, [files, options, step]);

  const addFiles = useCallback(async (incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter((f) => f.type.includes('pdf') || f.name.toLowerCase().endsWith('.pdf'));
    if (!arr.length) {
      toast('Please select PDF files only', 'error');
      return;
    }
    setFiles((prev) => (tool.multiple ? [...prev, ...arr] : arr.slice(0, 1)));
    for (const f of arr.slice(0, 1)) {
      const enc = await isPdfEncrypted(f);
      setPasswordNeeded(enc);
    }
  }, [toast, tool.multiple]);

  const runAnalyze = async () => {
    const file = files[0];
    if (!file) return;
    setAnalyzing(true);
    setAnalyzeProgress(0);
    try {
      const p = await analyzePdfLayout(file, password || undefined, (d, t) => {
        setAnalyzeProgress(d / t);
      });
      setProfile(p);
      setOptions((o) => ({
        ...o,
        mode: o.mode === 'smart' ? p.recommendedMode : o.mode,
        ocrLangs: p.recommendedOcrLangs,
        govPreset: (p.govPresetSuggestion as GovPresetId) ?? o.govPreset,
      }));
      setExcludedPages(new Set());
      setStep(1);
    } catch (e) {
      fail(e);
      toast(e instanceof Error ? e.message : 'Analysis failed', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const runConvert = async () => {
    if (!files.length) return;
    setPhase('working');
    setStep(3);
    setConvertProgress(0);
    setStatus('Starting conversion...');
    try {
      const pageRange =
        excludedPages.size > 0 && profile
          ? profile.pages
              .filter((p) => !excludedPages.has(p.pageIndex))
              .map((p) => p.pageIndex + 1)
              .join(',')
          : options.pageRange;

      const opts: PdfToWordOptions = { ...options, password: password || undefined, pageRange };

      const { blob, filename, results } = await convertPdfBatchToWord(
        files,
        opts,
        (fi, p, s) => {
          setConvertProgress((fi + p) / files.length);
          setStatus(files.length > 1 ? `File ${fi + 1}/${files.length}: ${s}` : s);
        },
      );

      setOutputBlob(blob);
      setOutputName(filename);
      setBatchResults(results);
      setResult(results[0] ?? null);
      setStep(4);
      setPhase('done');
      void recordJob(tool.slug, 'completed');
    } catch (e) {
      fail(e);
      setStep(2);
    }
  };

  const resetAll = () => {
    reset();
    setStep(0);
    setFiles([]);
    setProfile(null);
    setResult(null);
    setBatchResults([]);
    setOutputBlob(null);
    setPassword('');
    setPasswordNeeded(false);
    setExcludedPages(new Set());
  };

  const resultFile: ResultFile | null = outputBlob
    ? { name: outputName, blob: outputBlob }
    : null;

  const fab = (
    <FabRail
      options={options}
      setOptions={setOptions}
      onShare={resultFile ? () => setShareOpen(true) : undefined}
      onOpenAi={() => openAI()}
    />
  );

  /* ── Step 0: Upload ── */
  if (step === 0) {
    return (
      <div className="pdfconv-layout mergepdf-upload-layout">
        <Steps current={0} />
        <div
          className={`pdfconv-drop ${dragOver ? 'drag-active' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void addFiles(e.dataTransfer.files); }}
          role="button"
          tabIndex={0}
        >
          <Icon name="upload" size={32} />
          <b>Drop PDF files here or click to browse</b>
          <span>DOCX with layout, tables, OCR &amp; Indic AI repair · 100% private</span>
        </div>
        <input ref={inputRef} type="file" hidden accept={tool.accept} multiple={tool.multiple} onChange={(e) => { void addFiles(e.target.files ?? []); e.target.value = ''; }} />

        <div className="mergepdf-fab-inline">{fab}</div>

        <div className="mergepdf-feature-badges">
          {['Drag & Drop', 'Batch', 'OCR', 'Indic AI', 'Layout'].map((b) => (
            <span key={b}>{b}</span>
          ))}
        </div>

        {files.length > 0 && (
          <div className="pdfconv-filebar">
            <span className="pdfconv-filebar-icon"><Icon name="file-text" size={20} /></span>
            <div className="pdfconv-filebar-meta">
              <b>{files.map((f) => f.name).join(', ')}</b>
              <span className="muted">{files.length} file(s) · {formatBytes(files.reduce((s, f) => s + f.size, 0))}</span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFiles([])}>Clear</button>
          </div>
        )}

        {passwordNeeded && (
          <div className="pdfword-password">
            <label htmlFor="pdfword-pw">PDF password</label>
            <input id="pdfword-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter owner password" />
          </div>
        )}

        {phase === 'error' && <ErrorBox message={error} onRetry={reset} />}

        <div className="pdfword-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!files.length || analyzing}
            onClick={() => void runAnalyze()}
          >
            {analyzing ? 'Analyzing...' : 'Analyze & Continue →'}
          </button>
        </div>

        {analyzing && <ProgressRing progress={analyzeProgress} label="Analyzing PDF..." />}
      </div>
    );
  }

  /* ── Step 1: Analyze profile ── */
  if (step === 1 && profile) {
    return (
      <div className="pdfconv-layout">
        <Steps current={1} />
        <div className="pdfword-profile">
          <h3>Document Profile</h3>
          <div className="mergepdf-report">
            <div className="mergepdf-report-cell"><b>{profile.pageCount}</b><span>Pages</span></div>
            <div className="mergepdf-report-cell"><b className="capitalize">{profile.docType}</b><span>Type</span></div>
            <div className="mergepdf-report-cell"><b>{profile.tablesDetected}</b><span>Tables</span></div>
            <div className="mergepdf-report-cell"><b>{profile.languages.join(', ')}</b><span>Languages</span></div>
          </div>
          <p className="muted">
            Recommended: <strong>{MODE_LABELS[profile.recommendedMode]}</strong>
            {profile.govPresetSuggestion && (
              <> · Gov preset: <strong>{profile.govPresetSuggestion}</strong></>
            )}
          </p>
          <div className="pdfconv-thumbs">
            {profile.pages.slice(0, 8).map((p) => (
              <figure
                key={p.pageIndex}
                className={`pdfconv-thumb ${excludedPages.has(p.pageIndex) ? 'excluded' : ''}`}
                onClick={() => {
                  setExcludedPages((prev) => {
                    const next = new Set(prev);
                    if (next.has(p.pageIndex)) next.delete(p.pageIndex);
                    else next.add(p.pageIndex);
                    return next;
                  });
                }}
              >
                {p.thumb && <img src={p.thumb} alt={`Page ${p.pageIndex + 1}`} />}
                <figcaption>Page {p.pageIndex + 1}{excludedPages.has(p.pageIndex) ? ' ✕' : ''}</figcaption>
              </figure>
            ))}
            {profile.pages.length > 8 && <div className="pdfconv-thumb-more">+{profile.pages.length - 8} more</div>}
          </div>
          <p className="muted" style={{ fontSize: 12 }}>Click thumbnails to exclude pages from conversion.</p>
        </div>
        <div className="pdfword-privacy-badge">
          <Icon name="shield" size={16} /> Privacy Ledger: 0 bytes uploaded · analysis ran in your browser
        </div>
        <div className="pdfword-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
          <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>Configure Options →</button>
        </div>
      </div>
    );
  }

  /* ── Step 2: Options ── */
  if (step === 2) {
    return (
      <div className="pdfconv-layout">
        <Steps current={2} />
        <div className="pdfword-options-grid">
          <div className="options-panel">
            <h3>Conversion Mode</h3>
            {(Object.keys(MODE_LABELS) as ConversionMode[]).map((m) => (
              <label key={m} className="pdfword-mode-card">
                <input type="radio" name="mode" checked={options.mode === m} onChange={() => setOptions({ ...options, mode: m })} />
                <div>
                  <b>{MODE_LABELS[m]}</b>
                  <span>{MODE_DESCRIPTIONS[m]}</span>
                </div>
              </label>
            ))}
          </div>
          <div className="options-panel">
            <h3>Output &amp; OCR</h3>
            <div className="pdfconv-opt-row">
              <label htmlFor="pdfword-format">Format</label>
              <select id="pdfword-format" value={options.outputFormat} onChange={(e) => setOptions({ ...options, outputFormat: e.target.value as 'docx' | 'doc' })}>
                <option value="docx">DOCX (Word 2007+)</option>
                <option value="doc">DOC (legacy)</option>
              </select>
            </div>
            <div className="pdfconv-opt-row">
              <label htmlFor="pdfword-range">Page range</label>
              <input id="pdfword-range" type="text" value={options.pageRange} onChange={(e) => setOptions({ ...options, pageRange: e.target.value })} placeholder="all or 1-3,5" />
            </div>
            <div className="pdfconv-opt-row">
              <label htmlFor="pdfword-ocr">OCR languages</label>
              <select id="pdfword-ocr" value={options.ocrLangs} onChange={(e) => setOptions({ ...options, ocrLangs: e.target.value })}>
                {OCR_LANG_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div className="pdfconv-opt-row">
              <label htmlFor="pdfword-gov">Gov preset</label>
              <select id="pdfword-gov" value={options.govPreset} onChange={(e) => setOptions({ ...options, govPreset: e.target.value as GovPresetId })}>
                <option value="none">None</option>
                {GOV_PRESETS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>
            <div className="pdfconv-opt-row">
              <label htmlFor="pdfword-embed">Embed images</label>
              <select id="pdfword-embed" value={options.embedImages} onChange={(e) => setOptions({ ...options, embedImages: e.target.value as PdfToWordOptions['embedImages'] })}>
                <option value="yes">Yes — include scan images</option>
                <option value="placeholder">Placeholder only</option>
                <option value="skip">Skip images</option>
              </select>
            </div>
            <label className="checkbox-row">
              <input type="checkbox" checked={options.aiIndicRepair} onChange={(e) => setOptions({ ...options, aiIndicRepair: e.target.checked })} />
              AI Indic repair — ভাঙা বাংলা/हिंदी ঠিক করুন
            </label>
          </div>
        </div>
        {phase === 'error' && <ErrorBox message={error} onRetry={() => setPhase('idle')} />}
        <div className="pdfword-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
          <button type="button" className="btn btn-primary" onClick={() => void runConvert()}>Convert to Word →</button>
        </div>
      </div>
    );
  }

  /* ── Step 3: Converting ── */
  if (step === 3 && phase === 'working') {
    return (
      <div className="pdfconv-layout">
        <Steps current={3} />
        <ProgressRing progress={convertProgress} label={status || 'Converting...'} />
        <p className="muted" style={{ textAlign: 'center' }}>Processing in your browser — your files never leave this device.</p>
      </div>
    );
  }

  /* ── Step 4: Review ── */
  if (step === 4 && result && outputBlob) {
    return (
      <div className="pdfconv-layout">
        <Steps current={4} />
        <div className="mergepdf-success-check"><Icon name="check" size={28} /></div>
        <h3 style={{ textAlign: 'center' }}>Word document ready</h3>
        <p className="muted" style={{ textAlign: 'center' }}>
          {outputName} · {formatBytes(outputBlob.size)}
          {result.usedOcr && ' · OCR applied'}
        </p>

        <ConfidencePanel result={result} />

        <details className="pdfword-log" open={logOpen} onToggle={(e) => setLogOpen((e.target as HTMLDetailsElement).open)}>
          <summary>Conversion log ({result.log.length} entries)</summary>
          <ul>
            {result.log.map((e, i) => (
              <li key={i} className={`log-${e.level}`}>Page {e.page}: {e.message}</li>
            ))}
          </ul>
        </details>

        <div className="mergepdf-result-actions">
          <button type="button" className="btn btn-primary" onClick={() => downloadBlob(outputBlob, outputName)}>
            <Icon name="download" size={16} /> Download {files.length > 1 ? 'ZIP' : 'DOCX'}
          </button>
          {resultFile && <ShareButton file={resultFile} toolSlug={tool.slug} />}
          <Link href="/tools/pdf/word-to-pdf" className="btn btn-outline"><Icon name="refresh" size={15} /> Word → PDF</Link>
          <Link href="/tools/pdf/compress-pdf" className="btn btn-outline"><Icon name="file-down" size={15} /> Compress PDF</Link>
          <button type="button" className="btn btn-ghost" onClick={() => { setStep(2); setPhase('idle'); }}>Re-convert</button>
          <button type="button" className="btn btn-ghost" onClick={resetAll}>New file</button>
        </div>

        {batchResults.length > 1 && (
          <p className="muted" style={{ textAlign: 'center', fontSize: 12 }}>
            Batch: {batchResults.length} files · avg confidence {Math.round(batchResults.reduce((s, r) => s + r.confidence.overall, 0) / batchResults.length)}%
          </p>
        )}

        {shareOpen && resultFile && (
          <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} file={resultFile} toolSlug={tool.slug} />
        )}
      </div>
    );
  }

  return <ErrorBox message="Something went wrong. Please try again." onRetry={resetAll} />;
}
