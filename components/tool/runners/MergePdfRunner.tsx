'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { Tool } from '@/data/tools';
import Icon from '@/components/Icon';
import { ErrorBox, useToolPhase, type ResultFile } from '../shared';
import { useUI } from '@/components/GlobalUI';
import { formatBytes } from '@/lib/download';
import { recordJob } from '@/lib/jobs';
import {
  type AiAnalysis,
  type MergeMode,
  type MergePage,
  type MergeSourceFile,
  type OptimizeOptions,
  DEFAULT_OPTIMIZE,
  MODE_META,
  OPTIMIZE_LABELS,
  analyzePages,
  applyOptimizeToPages,
  clearMergeSession,
  expandFilesToPages,
  extractPagesToPdf,
  extractPdfsFromZip,
  imagesToPdfFiles,
  isPdfEncrypted,
  loadMergeSession,
  markDuplicates,
  mergeModeLabel,
  mergePdfPages,
  saveMergeSession,
  sortPages,
  validatePdfFile,
} from '@/lib/engines/merge-pdf-engine';

const ShareModal = dynamic(() => import('../ShareModal'), { ssr: false });

const STEPS = ['Upload', 'Organize', 'AI Optimize', 'Merge & Download'] as const;
type Step = 0 | 1 | 2 | 3;

const MERGE_MODES: MergeMode[] = [
  'normal', 'fast', 'lossless', 'compressed', 'pdfa', 'print', 'book', 'pancard', 'passport', 'certificate',
];

function Steps({ current }: { current: number }) {
  return (
    <div className="pdfconv-steps" aria-label="Merge progress">
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
      if (left + menuW > window.innerWidth - 12) {
        left = Math.max(12, r.left - menuW - gap);
      }
      // Bottom dock: open upward beside the button
      if (r.bottom > window.innerHeight * 0.45) {
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
  onShare,
  outputName,
  setOutputName,
  optimize,
  setOptimize,
  onOpenAi,
}: {
  onShare?: () => void;
  outputName: string;
  setOutputName: (v: string) => void;
  optimize: OptimizeOptions;
  setOptimize: (o: OptimizeOptions) => void;
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
        <button
          type="button"
          className={`mergepdf-fab mergepdf-fab-ai ${openMenu === 'ai' ? 'active' : ''}`}
          title="AI Assistant"
          aria-expanded={openMenu === 'ai'}
          onClick={() => toggle('ai')}
        >
          <Icon name="sparkles" size={18} />
        </button>
        <FabDropdown open={openMenu === 'ai'} anchorRef={aiRef}>
          <p className="mergepdf-fab-menu-title"><Icon name="sparkles" size={14} /> AI Assistant</p>
          <button type="button" className="mergepdf-fab-menu-item" role="menuitem" onClick={() => { setOpenMenu(null); onOpenAi(); }}>
            <Icon name="bot" size={15} /> Open chat panel
          </button>
          <button type="button" className="mergepdf-fab-menu-item" role="menuitem" onClick={() => { setOpenMenu(null); onOpenAi(); }}>
            <Icon name="wand" size={15} /> Optimize merge order
          </button>
          <Link className="mergepdf-fab-menu-item" href="/tools/ai/ai-chat" role="menuitem">
            <Icon name="bot" size={15} /> Full AI Chat tool
          </Link>
        </FabDropdown>
      </div>

      <div ref={historyRef} className="mergepdf-fab-wrap">
        <button
          type="button"
          className={`mergepdf-fab ${openMenu === 'history' ? 'active' : ''}`}
          title="History"
          aria-expanded={openMenu === 'history'}
          onClick={() => toggle('history')}
        >
          <Icon name="clock" size={18} />
        </button>
        <FabDropdown open={openMenu === 'history'} anchorRef={historyRef}>
          <p className="mergepdf-fab-menu-title"><Icon name="clock" size={14} /> History</p>
          <Link className="mergepdf-fab-menu-item" href="/dashboard/history" role="menuitem">
            <Icon name="file-text" size={15} /> All merge jobs
          </Link>
          <Link className="mergepdf-fab-menu-item" href="/dashboard" role="menuitem">
            <Icon name="grid" size={15} /> Dashboard
          </Link>
          <Link className="mergepdf-fab-menu-item" href="/dashboard/files" role="menuitem">
            <Icon name="folder" size={15} /> Cloud files
          </Link>
        </FabDropdown>
      </div>

      <div ref={settingsRef} className="mergepdf-fab-wrap">
        <button
          type="button"
          className={`mergepdf-fab ${openMenu === 'settings' ? 'active' : ''}`}
          title="Settings"
          aria-expanded={openMenu === 'settings'}
          onClick={() => toggle('settings')}
        >
          <Icon name="settings" size={18} />
        </button>
        <FabDropdown open={openMenu === 'settings'} anchorRef={settingsRef} wide>
          <p className="mergepdf-fab-menu-title"><Icon name="settings" size={14} /> Merge settings</p>
          <div className="pdfconv-opt-row">
            <label htmlFor="merge-fab-output-name">Output filename</label>
            <input id="merge-fab-output-name" type="text" value={outputName} onChange={(e) => setOutputName(e.target.value)} />
          </div>
          <label className="pdfconv-toggle">
            <input type="checkbox" checked={optimize.smartCompression} onChange={(e) => setOptimize({ ...optimize, smartCompression: e.target.checked })} />
            Smart compression
          </label>
          <label className="pdfconv-toggle">
            <input type="checkbox" checked={optimize.removeBlank} onChange={(e) => setOptimize({ ...optimize, removeBlank: e.target.checked })} />
            Auto-remove blank pages
          </label>
          <p className="mergepdf-fab-menu-note"><Icon name="shield" size={11} /> 100% browser processing</p>
        </FabDropdown>
      </div>

      {onShare && (
        <div className="mergepdf-fab-wrap">
          <button type="button" className="mergepdf-fab" title="Share" onClick={onShare}>
            <Icon name="share" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function MergeShell({ children, fab }: { children: React.ReactNode; fab: React.ReactNode }) {
  return (
    <div className="mergepdf-shell">
      <div className="mergepdf-shell-body">{children}</div>
      <div className="mergepdf-fab-dock">{fab}</div>
    </div>
  );
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function MergePdfRunner({ tool }: { tool: Tool }) {
  const { toast, openAI } = useUI();
  const { phase, setPhase, error, fail, reset, progress, setProgress } = useToolPhase();

  const [step, setStep] = useState<Step>(0);
  const [files, setFiles] = useState<MergeSourceFile[]>([]);
  const [pages, setPages] = useState<MergePage[]>([]);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [optimize, setOptimize] = useState<OptimizeOptions>(DEFAULT_OPTIMIZE);
  const [mergeMode, setMergeMode] = useState<MergeMode>('normal');
  const [result, setResult] = useState<ResultFile | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [urlBusy, setUrlBusy] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [workProgress, setWorkProgress] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewPage, setPreviewPage] = useState<MergePage | null>(null);
  const [status, setStatus] = useState('');
  const [mergeDuration, setMergeDuration] = useState(0);
  const [optOpen, setOptOpen] = useState(true);
  const [outputName, setOutputName] = useState('merged.pdf');

  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);
  const dragIdx = useRef<number | null>(null);

  const stats = useMemo(() => ({
    files: files.length,
    pages: pages.length,
    size: files.reduce((s, f) => s + f.size, 0),
    encrypted: files.filter((f) => f.encrypted).length,
    duplicates: files.filter((f) => f.duplicate).length,
  }), [files, pages]);

  // Session autosave
  useEffect(() => {
    if (!files.length && !pages.length) return;
    saveMergeSession({
      fileNames: files.map((f) => f.name),
      pageOrder: pages.map((p) => p.id),
      step,
    });
  }, [files, pages, step]);

  useEffect(() => {
    const prev = loadMergeSession();
    if (prev && prev.fileNames.length > 0 && files.length === 0) {
      toast(`Previous session: ${prev.fileNames.length} file(s) — re-upload to continue`, 'info');
    }
  }, [toast, files.length]);

  const fab = (
    <FabRail
      onShare={result ? () => setShareOpen(true) : step >= 2 ? () => setShareOpen(true) : undefined}
      outputName={outputName}
      setOutputName={setOutputName}
      optimize={optimize}
      setOptimize={setOptimize}
      onOpenAi={openAI}
    />
  );

  const ingestFiles = useCallback(async (incoming: File[]) => {
    const pdfs: File[] = [];
    for (const f of incoming) {
      if (f.name.toLowerCase().endsWith('.zip')) {
        try {
          pdfs.push(...await extractPdfsFromZip(f));
        } catch {
          toast('Could not read ZIP archive', 'error');
        }
      } else if (f.type.startsWith('image/')) {
        pdfs.push(...await imagesToPdfFiles([f]));
      } else {
        pdfs.push(f);
      }
    }

    const added: MergeSourceFile[] = [];
    for (const f of pdfs) {
      const v = await validatePdfFile(f);
      if (!v.ok) { toast(v.error ?? 'Invalid file', 'error'); continue; }
      const encrypted = await isPdfEncrypted(f);
      if (encrypted) toast(`${f.name} is password-protected`, 'error');
      let pageCount = 1;
      try {
        pageCount = await (await import('@/lib/engines/merge-pdf-engine')).getPdfPageCount(f);
      } catch { /* */ }
      added.push({
        id: uid(),
        file: f,
        name: f.name,
        size: f.size,
        pageCount,
        encrypted,
        duplicate: false,
        addedAt: Date.now(),
      });
    }
    if (!added.length) return;
    setFiles((prev) => markDuplicates([...prev, ...added]));
    toast(`Added ${added.length} PDF(s)`, 'success');
  }, [toast]);

  const importUrl = useCallback(async () => {
    const url = urlValue.trim();
    if (!url) return;
    setUrlBusy(true);
    try {
      const res = await fetch(`/api/fetch-pdf?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error || 'Could not fetch PDF');
      }
      const blob = await res.blob();
      const name = url.split('/').pop()?.split('?')[0] || 'document.pdf';
      await ingestFiles([new File([blob], name.endsWith('.pdf') ? name : `${name}.pdf`, { type: 'application/pdf' })]);
      setUrlOpen(false);
      setUrlValue('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import failed', 'error');
    } finally {
      setUrlBusy(false);
    }
  }, [urlValue, ingestFiles, toast]);

  const pasteClipboard = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      const picked: File[] = [];
      for (const item of items) {
        const t = item.types.find((x) => x === 'application/pdf');
        if (!t) continue;
        const blob = await item.getType(t);
        picked.push(new File([blob], `pasted-${Date.now()}.pdf`, { type: 'application/pdf' }));
      }
      if (!picked.length) { toast('No PDF in clipboard', 'error'); return; }
      await ingestFiles(picked);
    } catch {
      toast('Clipboard access denied', 'error');
    }
  }, [ingestFiles, toast]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const list = e.clipboardData?.files;
      if (!list?.length) return;
      const pdfs = Array.from(list).filter((f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (pdfs.length) { e.preventDefault(); void ingestFiles(pdfs); }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [ingestFiles]);

  const goOrganize = async () => {
    if (!files.length) return;
    setLoadingPages(true);
    setLoadProgress(0);
    try {
      const expanded = await expandFilesToPages(files, (d, t) => setLoadProgress(d / t));
      setPages(expanded);
      setStep(1);
    } catch (e) {
      fail(e);
    } finally {
      setLoadingPages(false);
    }
  };

  const goOptimize = async () => {
    setPhase('working');
    setWorkProgress(0);
    setStatus('Running AI analysis…');
    try {
      const a = await analyzePages(files, pages);
      setWorkProgress(1);
      setAnalysis(a);
      setStep(2);
      setPhase('idle');
      if (a.qualityScore < 70) {
        setMergeMode('compressed');
      }
    } catch (e) {
      fail(e);
    }
  };

  const applyAiOptimize = () => {
    if (!analysis) return;
    const next = applyOptimizeToPages(pages, analysis, optimize);
    setPages(next);
    toast(`Applied — ${pages.length - next.length} page(s) removed`, 'success');
  };

  const runMerge = async () => {
    const t0 = performance.now();
    setPhase('working');
    setWorkProgress(0);
    setStatus('Merging PDFs…');
    try {
      const blob = await mergePdfPages(
        files,
        pages,
        mergeMode,
        optimize,
        (p, label) => { setWorkProgress(p); setStatus(label); setProgress(p); },
      );
      const rf: ResultFile = { name: outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf`, blob };
      setResult(rf);
      setMergeDuration(performance.now() - t0);
      setStep(3);
      setPhase('done');
      clearMergeSession();
      recordJob(tool.slug, 'completed');
    } catch (e) {
      fail(e);
    }
  };

  const download = (rf: ResultFile) => {
    const url = URL.createObjectURL(rf.blob);
    const a = document.createElement('a');
    a.href = url; a.download = rf.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const downloadZip = async () => {
    if (!result) return;
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file(result.name, result.blob);
    const blob = await zip.generateAsync({ type: 'blob' });
    download({ name: 'merged.zip', blob });
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent('Check out my merged PDF from ToolNest!')}`, '_blank', 'noopener');
  };

  const shareTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent('Merged PDF via ToolNest')}`, '_blank', 'noopener');
  };

  const shareEmail = () => {
    const subject = encodeURIComponent('Merged PDF from ToolNest');
    const body = encodeURIComponent('I merged PDFs using ToolNest. Try it at toolnestfm.com/tools/pdf/merge-pdf');
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const resetAll = () => {
    reset();
    setStep(0);
    setFiles([]);
    setPages([]);
    setAnalysis(null);
    setResult(null);
    setOptimize(DEFAULT_OPTIMIZE);
    setMergeMode('normal');
    setSelected(new Set());
    setOutputName('merged.pdf');
    clearMergeSession();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const selectAll = () => {
    if (selected.size === pages.length) setSelected(new Set());
    else setSelected(new Set(pages.map((p) => p.id)));
  };

  const deleteSelected = () => {
    if (!selected.size) return;
    setPages((p) => p.filter((x) => !selected.has(x.id)));
    setSelected(new Set());
  };

  const rotateSelected = (deg: 90 | 180 | 270) => {
    setPages((p) => p.map((pg) => {
      if (selected.size > 0 && !selected.has(pg.id)) return pg;
      if (selected.size === 0 && previewPage && pg.id !== previewPage.id) return pg;
      const next = ((pg.rotation + deg) % 360) as 0 | 90 | 180 | 270;
      return { ...pg, rotation: next };
    }));
  };

  const duplicatePage = (id: string) => {
    const pg = pages.find((p) => p.id === id);
    if (!pg) return;
    const copy = { ...pg, id: uid() };
    const idx = pages.findIndex((p) => p.id === id);
    setPages([...pages.slice(0, idx + 1), copy, ...pages.slice(idx + 1)]);
  };

  const extractSelected = async () => {
    const targets = selected.size ? pages.filter((p) => selected.has(p.id)) : pages;
    if (!targets.length) { toast('Select pages to extract', 'error'); return; }
    setPhase('working');
    setStatus('Extracting pages…');
    try {
      const blob = await extractPagesToPdf(files, targets);
      download({ name: `extracted-${Date.now()}.pdf`, blob });
      setPhase('idle');
      toast('Extracted PDF downloaded', 'success');
    } catch (e) {
      fail(e);
    }
  };

  const replaceFile = async (fileList: FileList | null) => {
    const targetId = replaceTarget.current;
    if (!targetId || !fileList?.[0]) return;
    const f = fileList[0];
    const v = await validatePdfFile(f);
    if (!v.ok) { toast(v.error ?? 'Invalid', 'error'); return; }
    const pageCount = await (await import('@/lib/engines/merge-pdf-engine')).getPdfPageCount(f);
    const encrypted = await isPdfEncrypted(f);
    setFiles((prev) => markDuplicates(prev.map((x) => x.id === targetId ? {
      ...x, file: f, name: f.name, size: f.size, pageCount, encrypted, addedAt: Date.now(),
    } : x)));
    replaceTarget.current = null;
    toast('File replaced — refresh organize to update pages', 'success');
  };

  const onDragStart = (i: number) => { dragIdx.current = i; };
  const onDragEnd = () => { dragIdx.current = null; };
  const onDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === i) return;
    setPages((arr) => {
      const next = [...arr];
      const [item] = next.splice(from, 1);
      next.splice(i, 0, item);
      return next;
    });
    dragIdx.current = i;
  };

  // ─── Processing overlay ─────────────────────────────────────────────────

  if (phase === 'working') {
    return (
      <MergeShell fab={fab}>
        <div className="pdfconv-processing">
          <Steps current={step} />
          <ProgressRing progress={workProgress || progress || 0} label={status.includes('AI') ? 'Analyzing' : 'Merging'} />
          <h3 style={{ marginTop: 20 }}>{status || 'Processing…'}</h3>
          <p className="muted">Your PDFs are processed securely in your browser</p>
        </div>
      </MergeShell>
    );
  }

  if (loadingPages) {
    return (
      <MergeShell fab={fab}>
        <div className="pdfconv-processing">
          <Steps current={0} />
          <ProgressRing progress={loadProgress} label="Loading" />
          <h3 style={{ marginTop: 20 }}>Building page timeline</h3>
          <p className="muted">Rendering thumbnails for {files.length} file(s)…</p>
        </div>
      </MergeShell>
    );
  }

  // ─── Step 4: Results ────────────────────────────────────────────────────

  if (step === 3 && result) {
    const savedPct = stats.size > 0 ? Math.round((1 - result.blob.size / stats.size) * 100) : 0;
    return (
      <MergeShell fab={fab}>
      <div className="pdfconv-results">
        <Steps current={3} />
        <div className="pdfconv-success">
          <div className="pdfconv-confetti" aria-hidden>
            {Array.from({ length: 14 }).map((_, i) => <span key={i} style={{ ['--i' as string]: i }} />)}
          </div>
          <div className="pdfconv-success-check"><Icon name="check" size={30} /></div>
          <h3>Merge complete!</h3>
          <p className="muted">{formatBytes(result.blob.size)} · {pages.length} pages · {mergeModeLabel(mergeMode)}</p>
          <button type="button" className="btn btn-primary pdfconv-convert-btn" style={{ maxWidth: 300 }} onClick={() => download(result)}>
            <Icon name="download" size={17} /> Download PDF
          </button>
        </div>

        <div className="pdfconv-report">
          {[
            { label: 'Output size', value: formatBytes(result.blob.size) },
            { label: 'Source total', value: formatBytes(stats.size) },
            { label: 'Processed in', value: `${(mergeDuration / 1000).toFixed(1)}s` },
            { label: 'AI score', value: `${analysis?.qualityScore ?? '—'}%` },
          ].map((s) => (
            <div key={s.label} className="pdfconv-report-cell">
              <b>{s.value}</b>
              <span className="muted">{s.label}</span>
            </div>
          ))}
        </div>

        {savedPct > 0 && (
          <div className="pdfconv-size-compare">
            <Icon name="scaling" size={14} />
            {savedPct}% smaller than combined sources
          </div>
        )}

        <div className="pdfconv-result-card done">
          <div className="pdfconv-result-icon" style={{ background: 'rgba(124,58,237,0.15)', color: 'var(--brand-primary)' }}>
            <Icon name="merge" size={22} />
          </div>
          <div className="pdfconv-result-info">
            <b>{result.name}</b>
            <span className="muted">{formatBytes(result.blob.size)} · {pages.length} pages</span>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => download(result)}>
            <Icon name="download" size={16} /> Download
          </button>
        </div>

        <div className="pdfconv-result-actions">
          <button type="button" className="btn btn-outline" onClick={() => void downloadZip()}>
            <Icon name="folder" size={15} /> Download ZIP
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setShareOpen(true)}>
            <Icon name="link" size={15} /> Share Link
          </button>
          <button type="button" className="btn btn-outline" onClick={shareWhatsApp}>
            WhatsApp
          </button>
          <button type="button" className="btn btn-outline" onClick={shareTelegram}>
            Telegram
          </button>
          <button type="button" className="btn btn-ghost" onClick={shareEmail}>
            <Icon name="mail" size={15} /> Email
          </button>
          <button type="button" className="btn btn-ghost" onClick={resetAll}>
            <Icon name="upload" size={15} /> Merge another
          </button>
        </div>

        {shareOpen && <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} file={result} toolSlug={tool.slug} />}
      </div>
      </MergeShell>
    );
  }

  // ─── Step 0: Upload ─────────────────────────────────────────────────────

  if (step === 0) {
    return (
      <MergeShell fab={fab}>
      <div className="pdfconv-layout">
        <Steps current={0} />

        <div
          className={`pdfconv-drop ${dragOver ? 'drag-active' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void ingestFiles(Array.from(e.dataTransfer.files)); }}
          role="button"
          tabIndex={0}
          aria-label="Upload PDFs"
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        >
          <div className="pdfconv-drop-inner">
            <span className="pdfconv-drop-icon"><Icon name="merge" size={24} /></span>
            <div className="pdfconv-drop-text">
              <b>Drop PDFs or <span className="pdfconv-browse-link">browse</span></b>
              <span className="muted">Unlimited files · folder · ZIP · URL · clipboard · camera</span>
            </div>
            <div className="pdfconv-drop-actions" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="pdfconv-chip" title="Clipboard" onClick={() => void pasteClipboard()}>
                <Icon name="clipboard" size={14} />
              </button>
              <button type="button" className="pdfconv-chip" title="URL import" onClick={() => setUrlOpen((o) => !o)}>
                <Icon name="link" size={14} />
              </button>
              <button type="button" className="pdfconv-chip" title="Folder" onClick={() => folderRef.current?.click()}>
                <Icon name="folder" size={14} />
              </button>
              <button type="button" className="pdfconv-chip" title="ZIP" onClick={() => zipRef.current?.click()}>
                <Icon name="folder" size={14} />
              </button>
              <button type="button" className="pdfconv-chip" title="Camera scan" onClick={() => cameraRef.current?.click()}>
                <Icon name="image" size={14} />
              </button>
            </div>
          </div>
        </div>

        {urlOpen && (
          <div className="pdfconv-url-row">
            <input
              type="url"
              placeholder="https://example.com/document.pdf"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void importUrl()}
              autoFocus
            />
            <button type="button" className="btn btn-primary btn-sm" disabled={urlBusy || !urlValue.trim()} onClick={() => void importUrl()}>
              {urlBusy ? <div className="spinner spinner-sm" /> : <Icon name="download" size={15} />} Fetch
            </button>
          </div>
        )}

        <div className="pdfconv-format-badges">
          {['Drag & Drop', 'Batch', 'Virus Scan', 'Duplicate Detect', 'Live Preview'].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>

        <input ref={inputRef} type="file" hidden accept="application/pdf" multiple onChange={(e) => { void ingestFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
        <input ref={folderRef} type="file" hidden multiple {...{ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>} onChange={(e) => { void ingestFiles(Array.from(e.target.files ?? []).filter((f) => f.name.endsWith('.pdf'))); e.target.value = ''; }} />
        <input ref={zipRef} type="file" hidden accept=".zip,application/zip" onChange={(e) => { const f = e.target.files?.[0]; if (f) void ingestFiles([f]); e.target.value = ''; }} />
        <input ref={cameraRef} type="file" hidden accept="image/*" capture="environment" onChange={(e) => { void ingestFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
        <input ref={replaceRef} type="file" hidden accept="application/pdf" onChange={(e) => { void replaceFile(e.target.files); e.target.value = ''; }} />

        {files.length > 0 && (
          <div className="pdfconv-panel">
            <div className="pdfconv-filebar">
              <span className="pdfconv-filebar-icon"><Icon name="merge" size={18} /></span>
              <div className="pdfconv-filebar-meta">
                <b>{files.length} PDF(s) queued</b>
                <span className="muted">
                  {files.reduce((s, f) => s + f.pageCount, 0)} pages · {formatBytes(stats.size)}
                  {stats.duplicates > 0 && ` · ${stats.duplicates} duplicate(s)`}
                </span>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFiles([])}>Clear</button>
            </div>

            <div className="pdfconv-file-list">
              {files.map((f) => (
                <div key={f.id} className={`pdfconv-file-card ${f.duplicate ? 'mergepdf-dup' : ''}`}>
                  <span className="pdfconv-file-thumb-placeholder"><Icon name="file-text" size={18} /></span>
                  <div className="pdfconv-file-meta">
                    <b>{f.name}</b>
                    <span className="muted">{f.pageCount}p · {formatBytes(f.size)}</span>
                  </div>
                  {f.encrypted && <span className="mergepdf-badge warn">Locked</span>}
                  {f.duplicate && <span className="mergepdf-badge">Dup</span>}
                  <div className="pdfconv-file-actions">
                    <button type="button" className="icon-btn" aria-label="Replace" onClick={() => { replaceTarget.current = f.id; replaceRef.current?.click(); }}>
                      <Icon name="refresh" size={14} />
                    </button>
                    <button type="button" className="icon-btn" aria-label="Remove" onClick={() => setFiles((xs) => markDuplicates(xs.filter((x) => x.id !== f.id)))}>
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" className="pdfconv-add-more" onClick={() => inputRef.current?.click()}>
                <Icon name="upload" size={14} /> Add more PDFs
              </button>
            </div>

            <button type="button" className="btn btn-primary pdfconv-convert-btn" disabled={!files.length} onClick={() => void goOrganize()}>
              Continue to Organize <Icon name="arrow-right" size={16} />
            </button>
            <p className="pdfconv-privacy-note"><Icon name="shield" size={12} /> Processed in your browser · auto-delete after download</p>
          </div>
        )}

        {phase === 'error' && <ErrorBox message={error} onRetry={reset} />}
      </div>
      </MergeShell>
    );
  }

  // ─── Step 1: Organize ───────────────────────────────────────────────────

  if (step === 1) {
    return (
      <MergeShell fab={fab}>
      <div className="pdfconv-main-view">
        <Steps current={1} />

        <div className="pdfconv-filebar">
          <span className="pdfconv-filebar-icon"><Icon name="merge" size={18} /></span>
          <div className="pdfconv-filebar-meta">
            <b>{stats.files} files · {pages.length} pages</b>
            <span className="muted">{formatBytes(stats.size)} · drag to reorder</span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setStep(0); setPages([]); }}>
            <Icon name="upload" size={13} /> Add files
          </button>
        </div>

        <div className="mergepdf-toolbar glass">
          <button type="button" className="pdfconv-chip" onClick={selectAll}>
            <Icon name="check" size={14} /> {selected.size === pages.length ? 'Deselect' : 'Select all'}
          </button>
          <button type="button" className="pdfconv-chip" onClick={() => setPages((p) => [...p].reverse())}>
            <Icon name="repeat" size={14} /> Reverse
          </button>
          <button type="button" className="pdfconv-chip" onClick={() => setPages((p) => sortPages(p, 'name', files))}>
            <Icon name="type" size={14} /> Name
          </button>
          <button type="button" className="pdfconv-chip" onClick={() => setPages((p) => sortPages(p, 'date', files))}>
            <Icon name="clock" size={14} /> Date
          </button>
          <button type="button" className="pdfconv-chip" onClick={() => setPages((p) => sortPages(p, 'size', files))}>
            <Icon name="scaling" size={14} /> Size
          </button>
          <button type="button" className="pdfconv-chip" onClick={() => setPages((p) => sortPages(p, 'pages', files))}>
            <Icon name="file-text" size={14} /> Pages
          </button>
          <button type="button" className="pdfconv-chip" onClick={() => setPages((p) => [...p].sort(() => Math.random() - 0.5))}>
            Shuffle
          </button>
          <button type="button" className="pdfconv-chip" onClick={() => rotateSelected(90)}>
            <Icon name="rotate" size={14} /> Rotate
          </button>
          <button type="button" className="pdfconv-chip" onClick={() => void extractSelected()} disabled={!selected.size}>
            <Icon name="split" size={14} /> Extract
          </button>
          <button type="button" className="pdfconv-chip" style={{ color: '#fca5a5' }} onClick={deleteSelected} disabled={!selected.size}>
            <Icon name="x" size={14} /> Delete ({selected.size || 0})
          </button>
          <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => void goOptimize()}>
            AI Optimize <Icon name="arrow-right" size={14} />
          </button>
        </div>

        <div className="mergepdf-timeline-wrap glass">
          <div className="mergepdf-timeline" role="list" aria-label="Page timeline">
            {pages.map((pg, i) => (
              <div
                key={pg.id}
                role="listitem"
                className={`mergepdf-page-card ${selected.has(pg.id) ? 'selected' : ''}`}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragEnd={onDragEnd}
                onDragOver={(e) => onDragOver(e, i)}
                onClick={() => toggleSelect(pg.id)}
                onDoubleClick={() => setPreviewPage(pg)}
              >
                {pg.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pg.thumb} alt={`Page ${i + 1}`} loading="lazy" style={{ transform: `rotate(${pg.rotation}deg)` }} />
                ) : (
                  <span className="mergepdf-page-placeholder"><Icon name="file-text" size={24} /></span>
                )}
                <figcaption>{i + 1}</figcaption>
                <span className="mergepdf-page-src" title={pg.sourceName}>{pg.sourceName.slice(0, 8)}</span>
                <button type="button" className="mergepdf-page-dup" aria-label="Duplicate" onClick={(e) => { e.stopPropagation(); duplicatePage(pg.id); }}>
                  <Icon name="copy" size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {previewPage && (
          <div className="mergepdf-preview-overlay" onClick={() => setPreviewPage(null)}>
            <div className="mergepdf-preview-modal glass" onClick={(e) => e.stopPropagation()}>
              <div className="mergepdf-preview-head">
                <b>{previewPage.sourceName} — page {previewPage.pageIndex + 1}</b>
                <div className="mergepdf-preview-tools">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => rotateSelected(90)}><Icon name="rotate" size={14} /></button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreviewPage(null)}><Icon name="x" size={14} /></button>
                </div>
              </div>
              {previewPage.thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewPage.thumb} alt="" style={{ transform: `rotate(${previewPage.rotation}deg)` }} />
              )}
            </div>
          </div>
        )}

        <div className="pdfconv-review-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
          <span className="muted">{pages.length} pages · {selected.size} selected</span>
        </div>
      </div>
      </MergeShell>
    );
  }

  // ─── Step 2: AI Optimize ────────────────────────────────────────────────

  if (step === 2) {
    if (!analysis) {
      return (
        <MergeShell fab={fab}>
        <div className="pdfconv-processing">
          <Steps current={2} />
          <ProgressRing progress={0.3} label="Analyzing" />
          <p className="muted">Preparing AI analysis…</p>
        </div>
        </MergeShell>
      );
    }

    const recommended = analysis.qualityScore < 70 ? 'compressed' : 'normal';

    return (
      <MergeShell fab={fab}>
      <div className="pdfconv-main-view">
        <Steps current={2} />

        <div className="pdfconv-review-hero">
          <div className="mergepdf-ai-score-ring" data-score={analysis.qualityScore >= 80 ? 'high' : analysis.qualityScore >= 50 ? 'mid' : 'low'}>
            <b>{analysis.qualityScore}</b>
            <span>AI Quality</span>
          </div>
          <div className="pdfconv-review-facts" style={{ flex: 1 }}>
            {[
              { icon: 'file-text', label: 'Pages', value: String(analysis.totalPages) },
              { icon: 'scaling', label: 'Size', value: formatBytes(analysis.totalSize) },
              { icon: 'x', label: 'Blank', value: String(analysis.blankPageIds.length) },
              { icon: 'copy', label: 'Duplicates', value: String(analysis.duplicatePageIds.length) },
            ].map((f) => (
              <div key={f.label} className="pdfconv-review-fact">
                <span className="pdfconv-review-fact-icon"><Icon name={f.icon} size={16} /></span>
                <b>{f.value}</b>
                <span className="muted">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <ul className="mergepdf-ai-suggestions glass">
          {analysis.suggestions.map((s) => (
            <li key={s}><Icon name="sparkles" size={14} /> {s}</li>
          ))}
        </ul>

        <div
          className="pdfconv-ai-rec"
          onClick={() => { setMergeMode(recommended); applyAiOptimize(); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') { setMergeMode(recommended); applyAiOptimize(); } }}
        >
          <Icon name="sparkles" size={16} />
          <span>
            <b>AI recommends {mergeModeLabel(recommended)} mode</b> — apply optimizations and merge with one click
          </span>
          <Icon name="chevron-right" size={14} />
        </div>

        <div className="pdfconv-intel-panel">
          <div className="pdfconv-intel-header" onClick={() => setOptOpen(!optOpen)}>
            <h3><Icon name="wand" size={16} /> Optimization options</h3>
            <Icon name={optOpen ? 'chevron-up' : 'chevron-down'} size={14} />
          </div>
          {optOpen && (
            <div className="pdfconv-intel-body">
              <div className="pdfconv-options-section">
                {(Object.keys(optimize) as (keyof OptimizeOptions)[]).map((key) => (
                  <label key={key} className="pdfconv-toggle">
                    <input
                      type="checkbox"
                      checked={optimize[key]}
                      onChange={(e) => setOptimize({ ...optimize, [key]: e.target.checked })}
                    />
                    {OPTIMIZE_LABELS[key]}
                  </label>
                ))}
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={applyAiOptimize}>
                Apply to timeline
              </button>
            </div>
          )}
        </div>

        <div className="pdfconv-panel">
          <div className="pdfconv-format-section">
            <h3>Merge mode</h3>
            <div className="pdfconv-format-grid">
              {MERGE_MODES.map((m) => {
                const meta = MODE_META[m];
                return (
                  <button
                    key={m}
                    type="button"
                    className={`pdfconv-format-btn ${mergeMode === m ? 'active' : ''}`}
                    onClick={() => setMergeMode(m)}
                  >
                    <div className="pdfconv-fmt-icon" style={{ background: `${meta.color}18`, color: meta.color }}>
                      <Icon name={meta.icon} size={18} />
                    </div>
                    <div className="pdfconv-fmt-info">
                      <b>{meta.label}</b>
                      <span>{meta.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <button type="button" className="btn btn-primary pdfconv-convert-btn" onClick={() => void runMerge()}>
            <Icon name="merge" size={17} /> Merge & Download
          </button>
          <p className="pdfconv-privacy-note"><Icon name="lock" size={12} /> End-to-end browser processing · secure download</p>
        </div>

        <div className="pdfconv-review-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Back to Organize</button>
        </div>

        {phase === 'error' && <ErrorBox message={error} onRetry={reset} />}
      </div>
      </MergeShell>
    );
  }

  return null;
}
