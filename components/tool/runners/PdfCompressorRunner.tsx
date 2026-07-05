'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { Tool } from '@/data/tools';
import Icon from '@/components/Icon';
import { ErrorBox, ShareButton, useToolPhase, type ResultFile } from '../shared';
import { useUI } from '@/components/GlobalUI';
import { downloadBlob, formatBytes } from '@/lib/download';
import { recordJob } from '@/lib/jobs';
import { isPdfEncrypted, validatePdfFile } from '@/lib/engines/merge-pdf-engine';
import {
  analyzePdfForCompression,
  compressPdfBatch,
  COMPRESS_MODES,
  DEFAULT_COMPRESS_SETTINGS,
  extractPdfsFromZip,
  fetchPdfFromUrl,
  loadCompressSession,
  markDuplicatePdfs,
  saveCompressSession,
  type CompressMode,
  type CompressReport,
  type CompressResult,
  type CompressSettings,
  type PdfQueueItem,
} from '@/lib/engines/pdf-compress-engine';

const ShareModal = dynamic(() => import('../ShareModal'), { ssr: false });

const STEPS = ['Upload', 'Analyze', 'Compress', 'Download'] as const;
type Step = 0 | 1 | 2 | 3;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function Steps({ current }: { current: number }) {
  return (
    <div className="pdfconv-steps" aria-label="PDF compress progress">
      {STEPS.map((s, i) => (
        <div key={s} className={`pdfconv-step ${i < current ? 'done' : ''} ${i === current ? 'active' : ''}`}>
          <span className="pdfconv-step-dot">{i < current ? <Icon name="check" size={12} /> : i + 1}</span>
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
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--brand-primary)" strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.3s', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        />
      </svg>
      <div className="pdfconv-progress-text"><b>{pct}%</b><span>{label}</span></div>
    </div>
  );
}

function FabDropdown({ open, anchorRef, wide, children }: {
  open: boolean;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, transform: 'none' as string });
  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const place = () => {
      const r = anchorRef.current!.getBoundingClientRect();
      const menuW = wide ? 280 : 240;
      let left = r.right + 10;
      let top = r.top;
      let transform = 'none';
      if (left + menuW > window.innerWidth - 12) left = Math.max(12, r.left - menuW - 10);
      if (top + 280 > window.innerHeight - 12) { top = r.top; transform = 'translateY(calc(-100% - 8px))'; }
      setPos({ top, left, transform });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, anchorRef, wide]);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className={`mergepdf-fab-menu mergepdf-fab-menu-portal ${wide ? 'mergepdf-fab-menu-wide' : ''}`}
      style={{ top: pos.top, left: pos.left, transform: pos.transform }} role="menu">{children}</div>,
    document.body,
  );
}

function FabRail({ settings, setSettings, onShare, onOpenAi }: {
  settings: CompressSettings;
  setSettings: (s: CompressSettings) => void;
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

  return (
    <div ref={railRef} className="mergepdf-fab-rail" aria-label="Quick actions">
      <div ref={aiRef} className="mergepdf-fab-wrap">
        <button type="button" className={`mergepdf-fab mergepdf-fab-ai ${openMenu === 'ai' ? 'active' : ''}`} onClick={() => setOpenMenu((m) => m === 'ai' ? null : 'ai')} title="AI Assistant">
          <Icon name="sparkles" size={18} />
        </button>
        <FabDropdown open={openMenu === 'ai'} anchorRef={aiRef}>
          <p className="mergepdf-fab-menu-title"><Icon name="sparkles" size={14} /> AI Assistant</p>
          <button type="button" className="mergepdf-fab-menu-item" onClick={() => { setOpenMenu(null); onOpenAi(); }}><Icon name="wand" size={15} /> Optimize settings</button>
          <Link className="mergepdf-fab-menu-item" href="/tools/ai/ai-chat"><Icon name="bot" size={15} /> Full AI Chat</Link>
        </FabDropdown>
      </div>
      <div ref={historyRef} className="mergepdf-fab-wrap">
        <button type="button" className={`mergepdf-fab ${openMenu === 'history' ? 'active' : ''}`} onClick={() => setOpenMenu((m) => m === 'history' ? null : 'history')} title="History">
          <Icon name="clock" size={18} />
        </button>
        <FabDropdown open={openMenu === 'history'} anchorRef={historyRef}>
          <p className="mergepdf-fab-menu-title"><Icon name="clock" size={14} /> History</p>
          <Link className="mergepdf-fab-menu-item" href="/dashboard/history"><Icon name="file-text" size={15} /> Compression jobs</Link>
          <Link className="mergepdf-fab-menu-item" href="/dashboard"><Icon name="grid" size={15} /> Dashboard</Link>
        </FabDropdown>
      </div>
      <div ref={settingsRef} className="mergepdf-fab-wrap">
        <button type="button" className={`mergepdf-fab ${openMenu === 'settings' ? 'active' : ''}`} onClick={() => setOpenMenu((m) => m === 'settings' ? null : 'settings')} title="Settings">
          <Icon name="settings" size={18} />
        </button>
        <FabDropdown open={openMenu === 'settings'} anchorRef={settingsRef} wide>
          <p className="mergepdf-fab-menu-title"><Icon name="settings" size={14} /> Compression</p>
          <label className="pdfconv-toggle"><input type="checkbox" checked={settings.removeMetadata} onChange={(e) => setSettings({ ...settings, removeMetadata: e.target.checked })} /> Remove metadata</label>
          <label className="pdfconv-toggle"><input type="checkbox" checked={settings.removeBlankPages} onChange={(e) => setSettings({ ...settings, removeBlankPages: e.target.checked })} /> Remove blank pages</label>
          <label className="pdfconv-toggle"><input type="checkbox" checked={settings.preserveForms} onChange={(e) => setSettings({ ...settings, preserveForms: e.target.checked })} /> Preserve forms</label>
          <label className="pdfconv-toggle"><input type="checkbox" checked={settings.preserveBookmarks} onChange={(e) => setSettings({ ...settings, preserveBookmarks: e.target.checked })} /> Preserve bookmarks</label>
          <label className="pdfconv-toggle"><input type="checkbox" checked={settings.useTargetSize} onChange={(e) => setSettings({ ...settings, useTargetSize: e.target.checked })} /> Target file size</label>
          {settings.useTargetSize && (
            <label>Target size (KB)
              <input type="number" min={50} max={10240} value={settings.targetKB} onChange={(e) => setSettings({ ...settings, targetKB: Math.max(50, +e.target.value || 200) })} />
            </label>
          )}
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

function ReportPanel({ report }: { report: CompressReport }) {
  return (
    <div className="pdfcomp-report">
      <div className="pdfcomp-report-hero">
        <div className="pdfcomp-saved-ring"><b>{report.savedPercent}%</b><span>Saved</span></div>
        <div className="pdfcomp-size-compare">
          <div><span>Original</span><b>{formatBytes(report.originalBytes)}</b></div>
          <span className="pdfcomp-arrow">→</span>
          <div><span>Compressed</span><b className="accent">{formatBytes(report.finalBytes)}</b></div>
        </div>
      </div>
      <div className="mergepdf-report">
        <div className="mergepdf-report-cell"><b>{formatBytes(report.savedBytes)}</b><span>Space saved</span></div>
        <div className="mergepdf-report-cell"><b>{report.qualityScore}</b><span>Quality score</span></div>
        <div className="mergepdf-report-cell"><b>{(report.processingMs / 1000).toFixed(1)}s</b><span>Time</span></div>
        <div className="mergepdf-report-cell"><b>{report.performanceScore}</b><span>Performance</span></div>
      </div>
      <ul className="pdfcomp-opt-list">
        {report.optimizations.map((o) => <li key={o}><Icon name="check" size={12} /> {o}</li>)}
      </ul>
    </div>
  );
}

export default function PdfCompressorRunner({ tool }: { tool: Tool }) {
  const { toast, openAI } = useUI();
  const { phase, setPhase, error, fail, reset } = useToolPhase();

  const presetTargetKB = typeof tool.config?.targetKB === 'number' ? tool.config.targetKB : 0;

  const [step, setStep] = useState<Step>(0);
  const [queue, setQueue] = useState<PdfQueueItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [settings, setSettings] = useState<CompressSettings>(() => ({
    ...DEFAULT_COMPRESS_SETTINGS,
    ...(presetTargetKB > 0
      ? { useTargetSize: true, targetKB: presetTargetKB, mode: 'maximum' as CompressMode }
      : {}),
  }));
  const [password, setPassword] = useState('');
  const [passwordNeeded, setPasswordNeeded] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [results, setResults] = useState<CompressResult[]>([]);
  const [, setZipBlob] = useState<Blob | null>(null); // ZIP download UI not wired yet
  const [resultFile, setResultFile] = useState<ResultFile | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  const active = queue[activeIdx];
  const analysis = active?.analysis;

  useEffect(() => {
    const prev = loadCompressSession();
    if (prev?.fileNames.length) toast(`Previous session: ${prev.fileNames.join(', ')}`, 'info');
  }, [toast]);

  useEffect(() => {
    if (!queue.length) return;
    saveCompressSession({ fileNames: queue.map((q) => q.file.name), step, mode: settings.mode });
  }, [queue, step, settings.mode]);

  const addPdfs = useCallback(async (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    const pdfs: File[] = [];
    for (const f of list) {
      if (f.name.toLowerCase().endsWith('.zip')) {
        try { pdfs.push(...await extractPdfsFromZip(f)); } catch { toast('Invalid ZIP', 'error'); }
      } else if (f.type.includes('pdf') || f.name.toLowerCase().endsWith('.pdf')) {
        const v = await validatePdfFile(f);
        if (v.ok) pdfs.push(f);
        else toast(v.error ?? 'Invalid PDF', 'error');
      }
    }
    if (!pdfs.length) return;
    const items: PdfQueueItem[] = pdfs.map((file) => ({
      id: uid(),
      file,
      duplicate: false,
      encrypted: false,
    }));
    const merged = markDuplicatePdfs([...queue, ...items]);
    setQueue(merged);
    const enc = await isPdfEncrypted(pdfs[0]);
    setPasswordNeeded(enc);
  }, [queue, toast]);

  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type === 'application/pdf') {
          const blob = item.getAsFile();
          if (blob) void addPdfs([blob]);
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addPdfs]);

  const runAnalyze = async () => {
    if (!queue.length) return;
    setAnalyzing(true);
    setStep(1);
    setProgress(0);
    try {
      const updated: PdfQueueItem[] = [];
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        setStatus(`Analyzing ${item.file.name}...`);
        setProgress(i / queue.length);
        const a = await analyzePdfForCompression(item.file, password || undefined, setStatus);
        updated.push({ ...item, analysis: a, encrypted: a.encrypted });
        const mode = settings.mode === 'smart' ? a.recommendedMode : settings.mode;
        if (i === 0) setSettings((s) => ({ ...s, mode }));
      }
      setQueue(updated);
      setProgress(1);
      setPhase('idle');
    } catch (e) {
      fail(e);
      setStep(0);
    } finally {
      setAnalyzing(false);
    }
  };

  const runCompress = async () => {
    if (!queue.length || queue.some((q) => !q.analysis)) return;
    setPhase('working');
    setStep(2);
    setProgress(0);
    setStatus('Compressing...');
    const start = performance.now();
    try {
      const opts: CompressSettings = { ...settings, password: password || undefined };
      const { results: res, zipBlob: zip } = await compressPdfBatch(
        queue,
        opts,
        (fi, p, msg) => {
          setProgress((fi + p) / queue.length);
          setStatus(msg);
        },
      );
      setResults(res);
      setZipBlob(zip ?? null);
      if (res.length === 1) {
        setResultFile({ name: res[0].filename, blob: res[0].blob });
      } else if (zip) {
        setResultFile({ name: 'compressed-pdfs.zip', blob: zip });
      }
      setStep(3);
      setPhase('done');
      void recordJob(tool.slug, 'completed');
      void (performance.now() - start);
    } catch (e) {
      fail(e);
      setStep(1);
    }
  };

  const resetAll = () => {
    reset();
    setStep(0);
    setQueue([]);
    setResults([]);
    setZipBlob(null);
    setResultFile(null);
    setPassword('');
    setPasswordNeeded(false);
  };

  const fab = (
    <FabRail
      settings={settings}
      setSettings={setSettings}
      onShare={resultFile ? () => setShareOpen(true) : step >= 1 ? () => setShareOpen(true) : undefined}
      onOpenAi={openAI}
    />
  );

  if (phase === 'working' && step === 2) {
    return (
      <div className="pdfcomp-shell">
        <Steps current={2} />
        <ProgressRing progress={progress} label={status || 'Compressing PDF...'} />
        <p className="muted" style={{ textAlign: 'center' }}>AI compression running in your browser</p>
      </div>
    );
  }

  if (step === 3 && results.length > 0 && resultFile) {
    const report = results[0].report;
    return (
      <div className="pdfcomp-shell">
        <Steps current={3} />
        <div className="mergepdf-success-check"><Icon name="check" size={28} /></div>
        <h3 style={{ textAlign: 'center' }}>Compression complete</h3>
        <ReportPanel report={report} />
        {results.length > 1 && (
          <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>
            Batch: {results.length} files · avg {Math.round(results.reduce((s, r) => s + r.report.savedPercent, 0) / results.length)}% saved
          </p>
        )}
        <div className="mergepdf-result-actions">
          <button type="button" className="btn btn-primary" onClick={() => downloadBlob(resultFile.blob, resultFile.name)}>
            <Icon name="download" size={16} /> Download {results.length > 1 ? 'ZIP' : 'PDF'}
          </button>
          <ShareButton file={resultFile} toolSlug={tool.slug} />
          <Link href="/tools/pdf/merge-pdf" className="btn btn-outline"><Icon name="merge" size={15} /> Merge PDF</Link>
          <Link href="/tools/pdf/pdf-to-word" className="btn btn-outline"><Icon name="file-text" size={15} /> PDF to Word</Link>
          <button type="button" className="btn btn-ghost" onClick={() => { setStep(1); setPhase('idle'); setResultFile(null); }}>Re-compress</button>
          <button type="button" className="btn btn-ghost" onClick={resetAll}>New file</button>
        </div>
        {shareOpen && <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} file={resultFile} toolSlug={tool.slug} />}
      </div>
    );
  }

  if (step === 1 && analysis && !analyzing) {
    return (
      <div className="pdfcomp-shell">
        <Steps current={1} />
        <div className="pdfcomp-analyze-card">
          <div className="pdfcomp-potential-ring">
            <b>{analysis.compressionPotential}%</b>
            <span>Potential</span>
          </div>
          <div>
            <p><strong>{analysis.fileName}</strong> · {formatBytes(analysis.fileSize)}</p>
            <div className="mergepdf-report" style={{ marginTop: 12 }}>
              <div className="mergepdf-report-cell"><b>{analysis.pageCount}</b><span>Pages</span></div>
              <div className="mergepdf-report-cell"><b>{formatBytes(analysis.estimatedOutputBytes)}</b><span>Est. output</span></div>
              <div className="mergepdf-report-cell"><b>~{analysis.estimatedSeconds}s</b><span>Est. time</span></div>
              <div className="mergepdf-report-cell"><b>{analysis.qualityScore}</b><span>Quality</span></div>
            </div>
            <ul className="bgrem-features" style={{ marginTop: 12 }}>
              {analysis.features.map((f) => <li key={f}><Icon name="check" size={12} /> {f}</li>)}
            </ul>
          </div>
        </div>

        {analysis.thumbs.length > 0 && (
          <div className="pdfconv-thumbs">
            {analysis.thumbs.map((t, i) => (
              <figure key={i} className="pdfconv-thumb"><img src={t} alt={`Page ${i + 1}`} /><figcaption>Page {i + 1}</figcaption></figure>
            ))}
          </div>
        )}

        <div className="pdfcomp-modes">
          <h4>Compression mode</h4>
          <div className="pdfcomp-mode-grid">
            {COMPRESS_MODES.map((m) => (
              <label key={m.id} className={`pdfword-mode-card ${settings.mode === m.id ? 'active' : ''}`}>
                <input type="radio" name="cmode" checked={settings.mode === m.id} onChange={() => setSettings({ ...settings, mode: m.id })} />
                <div><b>{m.label}</b><span>{m.desc}</span></div>
              </label>
            ))}
          </div>
        </div>

        <div className="pdfcomp-advanced">
          <label className="pdfconv-toggle">
            <input type="checkbox" checked={settings.useTargetSize} onChange={(e) => setSettings({ ...settings, useTargetSize: e.target.checked })} />
            Target file size (e.g. Aadhaar 200KB)
          </label>
          {settings.useTargetSize && (
            <label>Target KB
              <input type="number" min={50} max={10240} value={settings.targetKB}
                onChange={(e) => setSettings({ ...settings, targetKB: Math.max(50, +e.target.value || 200) })} />
            </label>
          )}
          <label>Image quality <span className="range-value">{settings.imageQuality}%</span>
            <input type="range" min={20} max={95} value={settings.imageQuality} onChange={(e) => setSettings({ ...settings, imageQuality: +e.target.value })} />
          </label>
          <label>DPI scale <span className="range-value">{settings.dpiScale.toFixed(1)}x</span>
            <input type="range" min={0.8} max={2.5} step={0.1} value={settings.dpiScale} onChange={(e) => setSettings({ ...settings, dpiScale: +e.target.value })} />
          </label>
        </div>

        {queue.length > 1 && (
          <div className="bgrem-batch-strip">
            {queue.map((q, i) => (
              <button key={q.id} type="button" className={`bgrem-batch-thumb ${i === activeIdx ? 'active' : ''}`} onClick={() => setActiveIdx(i)}>
                {q.file.name.slice(0, 14)}{q.duplicate ? ' ⚠' : ''}
              </button>
            ))}
          </div>
        )}

        <div className="mergepdf-fab-inline">{fab}</div>

        <div className="pdfword-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
          <button type="button" className="btn btn-primary" onClick={() => void runCompress()}>Compress Now →</button>
        </div>
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="pdfcomp-shell">
        <Steps current={1} />
        <ProgressRing progress={progress} label={status || 'Analyzing PDF...'} />
      </div>
    );
  }

  return (
    <div className="pdfcomp-shell pdfconv-layout mergepdf-upload-layout">
      <Steps current={0} />
      <div
        className={`pdfconv-drop ${dragOver ? 'drag-active' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void addPdfs(e.dataTransfer.files); }}
        role="button" tabIndex={0}
      >
        <Icon name="upload" size={32} />
        <b>Drop PDF files here or click to browse</b>
        <span>Batch · ZIP · Password protected · 100% private browser compression</span>
      </div>
      <input ref={inputRef} type="file" hidden accept="application/pdf,.zip" multiple onChange={(e) => { void addPdfs(e.target.files ?? []); e.target.value = ''; }} />
      <input ref={zipRef} type="file" hidden accept=".zip" onChange={(e) => { void addPdfs(e.target.files ?? []); e.target.value = ''; }} />

      <div className="bgrem-upload-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => inputRef.current?.click()}><Icon name="file-text" size={14} /> Choose PDF</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => zipRef.current?.click()}><Icon name="folder" size={14} /> ZIP</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setUrlOpen((v) => !v)}><Icon name="link" size={14} /> URL</button>
      </div>

      {urlOpen && (
        <div className="bgrem-url-row">
          <input type="url" placeholder="https://example.com/document.pdf" value={urlValue} onChange={(e) => setUrlValue(e.target.value)} />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void fetchPdfFromUrl(urlValue).then((f) => addPdfs([f])).catch(() => toast('Invalid PDF URL', 'error'))}>Import</button>
        </div>
      )}

      <div className="mergepdf-fab-inline">{fab}</div>
      <div className="mergepdf-feature-badges">
        {['AI Smart', 'Batch', 'Lossless', 'Private', 'HD Quality'].map((b) => <span key={b}>{b}</span>)}
      </div>

      {queue.length > 0 && (
        <div className="pdfconv-filebar">
          <span className="pdfconv-filebar-icon"><Icon name="file-text" size={20} /></span>
          <div className="pdfconv-filebar-meta">
            <b>{queue.length} PDF(s) in queue</b>
            <span className="muted">{formatBytes(queue.reduce((s, q) => s + q.file.size, 0))}{queue.some((q) => q.duplicate) ? ' · duplicates detected' : ''}</span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQueue([])}>Clear</button>
        </div>
      )}

      {passwordNeeded && (
        <div className="pdfword-password">
          <label htmlFor="pdfcomp-pw">PDF password</label>
          <input id="pdfcomp-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Owner password" />
        </div>
      )}

      <div className="pdfword-privacy-badge"><Icon name="shield" size={16} /> Browser processing · virus scan · auto-private</div>

      {phase === 'error' && <ErrorBox message={error} onRetry={reset} />}

      <div className="pdfword-actions">
        <button type="button" className="btn btn-primary" disabled={!queue.length || analyzing} onClick={() => void runAnalyze()}>
          Analyze &amp; Continue →
        </button>
      </div>
    </div>
  );
}
