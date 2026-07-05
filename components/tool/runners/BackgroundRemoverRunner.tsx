'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { Tool } from '@/data/tools';
import Icon from '@/components/Icon';
import { ErrorBox, ShareButton, useToolPhase, type ResultFile } from '../shared';
import { useUI } from '@/components/GlobalUI';
import { downloadBlob, formatBytes, replaceExt } from '@/lib/download';
import { recordJob } from '@/lib/jobs';
import { loadImage, makeCanvas } from '@/lib/image';
import {
  analyzeImage,
  applyBrushToAlpha,
  BACKGROUND_PRESETS,
  compositeWithBackground,
  DEFAULT_REMOVE_OPTIONS,
  exportBatchZip,
  exportCanvas,
  extractImagesFromZip,
  fetchImageFromUrl,
  isAcceptedImage,
  loadBgRemoveSession,
  removeBackgroundAi,
  saveBgRemoveSession,
  type AiDetectionResult,
  type ExportFormat,
  type ExportQuality,
  type PreviewMode,
  type RemoveOptions,
} from '@/lib/engines/bg-remove-engine';

const ShareModal = dynamic(() => import('../ShareModal'), { ssr: false });

const STEPS = ['Upload', 'AI Detection', 'Edit', 'Export'] as const;
type Step = 0 | 1 | 2 | 3;

type BrushMode = 'erase' | 'restore';

interface ImageJob {
  id: string;
  file: File;
  detection?: AiDetectionResult;
  cutout?: HTMLCanvasElement;
  original?: HTMLCanvasElement;
  activeBg: string;
  customBg?: HTMLCanvasElement;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function Steps({ current }: { current: number }) {
  return (
    <div className="pdfconv-steps" aria-label="Background remover progress">
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
      const el = anchorRef.current!;
      const r = el.getBoundingClientRect();
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

function FabRail({ options, setOptions, onShare, onOpenAi }: {
  options: RemoveOptions;
  setOptions: (o: RemoveOptions) => void;
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
          <button type="button" className="mergepdf-fab-menu-item" onClick={() => { setOpenMenu(null); onOpenAi(); }}><Icon name="wand" size={15} /> Enhance with AI</button>
          <Link className="mergepdf-fab-menu-item" href="/tools/ai/ai-chat"><Icon name="bot" size={15} /> Full AI Chat</Link>
        </FabDropdown>
      </div>
      <div ref={historyRef} className="mergepdf-fab-wrap">
        <button type="button" className={`mergepdf-fab ${openMenu === 'history' ? 'active' : ''}`} onClick={() => setOpenMenu((m) => m === 'history' ? null : 'history')} title="History">
          <Icon name="clock" size={18} />
        </button>
        <FabDropdown open={openMenu === 'history'} anchorRef={historyRef}>
          <p className="mergepdf-fab-menu-title"><Icon name="clock" size={14} /> History</p>
          <Link className="mergepdf-fab-menu-item" href="/dashboard/history"><Icon name="image" size={15} /> All jobs</Link>
          <Link className="mergepdf-fab-menu-item" href="/dashboard"><Icon name="grid" size={15} /> Dashboard</Link>
        </FabDropdown>
      </div>
      <div ref={settingsRef} className="mergepdf-fab-wrap">
        <button type="button" className={`mergepdf-fab ${openMenu === 'settings' ? 'active' : ''}`} onClick={() => setOpenMenu((m) => m === 'settings' ? null : 'settings')} title="Settings">
          <Icon name="settings" size={18} />
        </button>
        <FabDropdown open={openMenu === 'settings'} anchorRef={settingsRef} wide>
          <p className="mergepdf-fab-menu-title"><Icon name="settings" size={14} /> AI Settings</p>
          <label className="pdfconv-toggle"><input type="checkbox" checked={options.smartHair} onChange={(e) => setOptions({ ...options, smartHair: e.target.checked })} /> Smart hair refinement</label>
          <label className="pdfconv-toggle"><input type="checkbox" checked={options.edgeRefine} onChange={(e) => setOptions({ ...options, edgeRefine: e.target.checked })} /> Edge refinement</label>
          <label className="pdfconv-toggle"><input type="checkbox" checked={options.decontaminate} onChange={(e) => setOptions({ ...options, decontaminate: e.target.checked })} /> Decontaminate colors</label>
          <label className="pdfconv-toggle"><input type="checkbox" checked={options.antiHalo} onChange={(e) => setOptions({ ...options, antiHalo: e.target.checked })} /> Anti-halo</label>
          <p className="mergepdf-fab-menu-note"><Icon name="shield" size={11} /> 100% browser AI</p>
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

export default function BackgroundRemoverRunner({ tool }: { tool: Tool }) {
  const { toast, openAI } = useUI();
  const { phase, setPhase, error, fail, reset } = useToolPhase();

  const [step, setStep] = useState<Step>(0);
  const [jobs, setJobs] = useState<ImageJob[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [options, setOptions] = useState<RemoveOptions>(DEFAULT_REMOVE_OPTIONS);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('after');
  const [zoom, setZoom] = useState(100);
  const [brushMode, setBrushMode] = useState<BrushMode>('erase');
  const [brushSize, setBrushSize] = useState(24);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportQuality, setExportQuality] = useState<ExportQuality>('high');
  const [shareOpen, setShareOpen] = useState(false);
  const [resultFile, setResultFile] = useState<ResultFile | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const customBgRef = useRef<HTMLInputElement>(null);
  const editCanvasRef = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);
  const undoStack = useRef<ImageData[]>([]);

  const active = jobs[activeIdx];

  useEffect(() => {
    const prev = loadBgRemoveSession();
    if (prev?.fileNames.length) toast(`Previous session: ${prev.fileNames.length} image(s) — re-upload to continue`, 'info');
  }, [toast]);

  useEffect(() => {
    if (!jobs.length) return;
    saveBgRemoveSession({ fileNames: jobs.map((j) => j.file.name), step, bgId: active?.activeBg ?? 'transparent', savedAt: Date.now() });
  }, [jobs, step, active?.activeBg]);

  const addFiles = useCallback(async (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    const images: File[] = [];
    for (const f of list) {
      if (f.name.toLowerCase().endsWith('.zip')) {
        try {
          images.push(...await extractImagesFromZip(f));
        } catch {
          toast('Could not read ZIP file', 'error');
        }
      } else if (isAcceptedImage(f)) {
        images.push(f);
      }
    }
    if (!images.length) { toast('No supported images found', 'error'); return; }
    const newJobs: ImageJob[] = images.map((file) => ({ id: uid(), file, activeBg: 'transparent' }));
    setJobs((prev) => [...prev, ...newJobs]);
  }, [toast]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) files.push(blob);
        }
      }
      if (files.length) void addFiles(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFiles]);

  const runDetection = async () => {
    if (!jobs.length) return;
    setPhase('working');
    setStep(1);
    setProgress(0);
    try {
      const updated: ImageJob[] = [];
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        setStatus(`Analyzing ${job.file.name}...`);
        setProgress((i + 0.3) / jobs.length);
        const detection = await analyzeImage(job.file);
        setStatus(`AI removing background: ${job.file.name}...`);
        setProgress((i + 0.6) / jobs.length);
        const opts = { ...options, feather: detection.recommendedFeather };
        const cutout = await removeBackgroundAi(job.file, opts, setStatus);
        const img = await loadImage(job.file);
        const [orig] = makeCanvas(img.width, img.height);
        orig.getContext('2d')!.drawImage(img, 0, 0);
        updated.push({ ...job, detection, cutout, original: orig, activeBg: 'transparent' });
        setProgress((i + 1) / jobs.length);
      }
      setJobs(updated);
      setStep(1);
      setPhase('idle');
    } catch (e) {
      fail(e);
      setStep(0);
    }
  };

  const getDisplayCanvas = useCallback((): HTMLCanvasElement | null => {
    if (!active?.cutout) return null;
    const custom = active.activeBg === 'custom' ? active.customBg : null;
    return compositeWithBackground(active.cutout, active.activeBg, custom);
  }, [active]);

  useEffect(() => {
    const canvas = editCanvasRef.current;
    const display = getDisplayCanvas();
    if (!canvas || !display) return;
    const maxW = 720;
    const scale = Math.min(1, maxW / display.width) * (zoom / 100);
    canvas.width = display.width * scale;
    canvas.height = display.height * scale;
    const ctx = canvas.getContext('2d')!;
    if (previewMode === 'before' && active?.original) {
      ctx.drawImage(active.original, 0, 0, canvas.width, canvas.height);
    } else if (previewMode === 'split' && active?.original) {
      ctx.drawImage(active.original, 0, 0, canvas.width / 2, canvas.height);
      ctx.drawImage(display, canvas.width / 2, 0, canvas.width / 2, canvas.height);
    } else if (previewMode === 'side' && active?.original) {
      const half = canvas.width / 2 - 4;
      ctx.drawImage(active.original, 0, 0, half, canvas.height);
      ctx.drawImage(display, half + 8, 0, half, canvas.height);
    } else {
      if (active.activeBg === 'transparent') {
        ctx.fillStyle = '#1a1a28';
        for (let x = 0; x < canvas.width; x += 16) {
          for (let y = 0; y < canvas.height; y += 16) {
            ctx.fillStyle = ((x + y) / 16) % 2 === 0 ? '#2a2a3c' : '#1a1a28';
            ctx.fillRect(x, y, 16, 16);
          }
        }
      }
      ctx.drawImage(display, 0, 0, canvas.width, canvas.height);
    }
  }, [active, getDisplayCanvas, previewMode, zoom]);

  const paint = (e: React.PointerEvent<HTMLCanvasElement>, kind: 'down' | 'move' | 'up') => {
    if (!active?.cutout || step !== 2) return;
    const canvas = editCanvasRef.current;
    if (!canvas) return;
    if (kind === 'down') { painting.current = true; canvas.setPointerCapture(e.pointerId); undoStack.current.push(active.cutout.getContext('2d')!.getImageData(0, 0, active.cutout.width, active.cutout.height)); }
    if (kind === 'up') { painting.current = false; return; }
    if (!painting.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * active.cutout.width;
    const y = ((e.clientY - rect.top) / rect.height) * active.cutout.height;
    applyBrushToAlpha(active.cutout, x, y, brushSize, brushMode, active.original);
  };

  const undo = () => {
    const snap = undoStack.current.pop();
    if (!snap || !active?.cutout) return;
    active.cutout.getContext('2d')!.putImageData(snap, 0, 0);
    setJobs([...jobs]);
  };

  const runExport = async () => {
    if (!jobs.length) return;
    setPhase('working');
    setStep(3);
    setStatus('Exporting...');
    try {
      const canvases = jobs.filter((j) => j.cutout).map((j) => ({
        name: j.file.name,
        canvas: compositeWithBackground(
          j.cutout!,
          j.activeBg,
          j.activeBg === 'custom' ? j.customBg : null,
        ),
      }));
      let blob: Blob;
      let name: string;
      if (canvases.length === 1) {
        blob = await exportCanvas(canvases[0].canvas, exportFormat, exportQuality, jobs[0].activeBg);
        name = replaceExt(canvases[0].name, exportFormat === 'jpg' ? 'jpg' : exportFormat);
      } else {
        blob = await exportBatchZip(canvases, exportFormat, exportQuality, jobs[0].activeBg);
        name = 'background-removed.zip';
      }
      setResultFile({ name, blob });
      void recordJob(tool.slug, 'completed');
      setPhase('done');
    } catch (e) {
      fail(e);
    }
  };

  const handleCustomBg = async (file: File) => {
    if (!isAcceptedImage(file)) { toast('Please upload an image file', 'error'); return; }
    const img = await loadImage(file);
    const [c, ctx] = makeCanvas(img.width, img.height);
    ctx.drawImage(img, 0, 0);
    const next = [...jobs];
    next[activeIdx] = { ...next[activeIdx], activeBg: 'custom', customBg: c };
    setJobs(next);
  };

  const copyToClipboard = async () => {
    if (!active?.cutout) return;
    try {
      const canvas = getDisplayCanvas();
      if (!canvas) return;
      const blob = await exportCanvas(canvas, 'png', exportQuality, active.activeBg);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('Copied to clipboard', 'success');
    } catch {
      toast('Clipboard copy failed — try Download instead', 'error');
    }
  };

  const resetAll = () => {
    reset();
    setStep(0);
    setJobs([]);
    setActiveIdx(0);
    setResultFile(null);
    undoStack.current = [];
  };

  const fab = <FabRail options={options} setOptions={setOptions} onShare={resultFile ? () => setShareOpen(true) : step >= 2 ? () => setShareOpen(true) : undefined} onOpenAi={openAI} />;

  if (phase === 'working' && step === 1) {
    return (
      <div className="bgrem-shell">
        <Steps current={1} />
        <ProgressRing progress={progress} label={status || 'AI Detection...'} />
        <p className="muted" style={{ textAlign: 'center' }}>Running AI cutout in your browser — private &amp; secure</p>
      </div>
    );
  }

  if (phase === 'done' && resultFile) {
    return (
      <div className="bgrem-shell">
        <Steps current={3} />
        <div className="mergepdf-success-check"><Icon name="check" size={28} /></div>
        <h3 style={{ textAlign: 'center' }}>Export complete</h3>
        <p className="muted" style={{ textAlign: 'center' }}>{resultFile.name} · {formatBytes(resultFile.blob.size)}</p>
        <div className="mergepdf-result-actions">
          <button type="button" className="btn btn-primary" onClick={() => downloadBlob(resultFile.blob, resultFile.name)}><Icon name="download" size={16} /> Download</button>
          <ShareButton file={resultFile} toolSlug={tool.slug} />
          <Link href="/tools/image/background-changer" className="btn btn-outline"><Icon name="wand" size={15} /> Change Background</Link>
          <button type="button" className="btn btn-ghost" onClick={() => { setPhase('idle'); setStep(2); setResultFile(null); }}>Edit more</button>
          <button type="button" className="btn btn-ghost" onClick={resetAll}>New image</button>
        </div>
        {shareOpen && <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} file={resultFile} toolSlug={tool.slug} />}
      </div>
    );
  }

  if (step === 2 && active?.cutout) {
    return (
      <div className="bgrem-shell bgrem-edit">
        <Steps current={2} />
        <div className="bgrem-edit-toolbar">
          <div className="bgrem-preview-modes">
            {(['after', 'before', 'split', 'side'] as PreviewMode[]).map((m) => (
              <button key={m} type="button" className={`btn btn-ghost btn-sm ${previewMode === m ? 'active' : ''}`} onClick={() => setPreviewMode(m)}>
                {m === 'after' ? 'After' : m === 'before' ? 'Before' : m === 'split' ? 'Split' : 'Side'}
              </button>
            ))}
          </div>
          <div className="bgrem-zoom">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setZoom((z) => Math.max(50, z - 25))}>−</button>
            <span>{zoom}%</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setZoom((z) => Math.min(400, z + 25))}>+</button>
          </div>
          <div className="bgrem-brush-tools">
            <button type="button" className={`btn btn-ghost btn-sm ${brushMode === 'erase' ? 'active' : ''}`} onClick={() => setBrushMode('erase')}><Icon name="eraser" size={14} /> Erase</button>
            <button type="button" className={`btn btn-ghost btn-sm ${brushMode === 'restore' ? 'active' : ''}`} onClick={() => setBrushMode('restore')}><Icon name="pen" size={14} /> Restore</button>
            <input type="range" min={4} max={80} value={brushSize} onChange={(e) => setBrushSize(+e.target.value)} aria-label="Brush size" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={undo}><Icon name="refresh" size={14} /></button>
          </div>
        </div>

        <div className="bgrem-canvas-wrap">
          <canvas ref={editCanvasRef} className="bgrem-canvas" style={{ touchAction: 'none', cursor: 'crosshair' }}
            onPointerDown={(e) => paint(e, 'down')} onPointerMove={(e) => paint(e, 'move')} onPointerUp={(e) => paint(e, 'up')} />
        </div>

        {jobs.length > 1 && (
          <div className="bgrem-batch-strip">
            {jobs.map((j, i) => (
              <button key={j.id} type="button" className={`bgrem-batch-thumb ${i === activeIdx ? 'active' : ''}`} onClick={() => setActiveIdx(i)}>
                {j.file.name.slice(0, 12)}
              </button>
            ))}
          </div>
        )}

        <div className="bgrem-bg-library">
          <h4>Background</h4>
          <div className="bgrem-bg-grid">
            {BACKGROUND_PRESETS.map((p) => (
              <button key={p.id} type="button" className={`bgrem-bg-swatch ${active.activeBg === p.id ? 'active' : ''}`}
                title={p.label} onClick={() => {
                  const next = [...jobs];
                  next[activeIdx] = { ...next[activeIdx], activeBg: p.id };
                  setJobs(next);
                }}>
                <span className={`bgrem-swatch-preview bgrem-swatch-${p.id}`} />
                <em>{p.label}</em>
              </button>
            ))}
            <button type="button" className={`bgrem-bg-swatch ${active.activeBg === 'custom' ? 'active' : ''}`}
              title="Upload custom background" onClick={() => customBgRef.current?.click()}>
              <span className="bgrem-swatch-preview bgrem-swatch-custom"><Icon name="upload" size={16} /></span>
              <em>Custom</em>
            </button>
          </div>
          <input ref={customBgRef} type="file" hidden accept="image/*" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleCustomBg(f);
            e.target.value = '';
          }} />
        </div>

        <div className="mergepdf-fab-inline">{fab}</div>

        <div className="pdfword-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
          <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>Continue to Export →</button>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="bgrem-shell">
        <Steps current={3} />
        <div className="bgrem-export-panel">
          <div className="options-panel">
            <h3>Export format</h3>
            <div className="bgrem-format-row">
              {(['png', 'webp', 'jpg'] as ExportFormat[]).map((f) => (
                <button key={f} type="button" className={`btn btn-outline ${exportFormat === f ? 'active' : ''}`} onClick={() => setExportFormat(f)}>{f.toUpperCase()}</button>
              ))}
            </div>
            <h3>Quality</h3>
            <select value={exportQuality} onChange={(e) => setExportQuality(e.target.value as ExportQuality)}>
              <option value="original">Original</option>
              <option value="ultra">Ultra HD</option>
              <option value="high">High</option>
              <option value="print">Print Ready</option>
              <option value="web">Web Optimized</option>
              <option value="social">Social Media</option>
            </select>
            <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
              {jobs.length} image(s) · {active?.activeBg === 'transparent' ? 'Transparent PNG' : `Background: ${active?.activeBg}`}
            </p>
          </div>
        </div>
        {phase === 'error' && <ErrorBox message={error} onRetry={() => setPhase('idle')} />}
        <div className="pdfword-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
          <button type="button" className="btn btn-outline" onClick={() => void copyToClipboard()}><Icon name="copy" size={14} /> Copy</button>
          <button type="button" className="btn btn-primary" disabled={phase === 'working'} onClick={() => void runExport()}>
            {phase === 'working' ? 'Exporting...' : 'Download'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 1 && active?.detection) {
    return (
      <div className="bgrem-shell">
        <Steps current={1} />
        <div className="bgrem-detection-card">
          <div className="bgrem-detection-score"><b>{active.detection.confidence}%</b><span>AI Confidence</span></div>
          <div>
            <p><strong>Subject:</strong> {active.detection.subjectType}</p>
            <p><strong>Size:</strong> {active.detection.width}×{active.detection.height} ({active.detection.megapixels} MP)</p>
            <p><strong>Edge quality:</strong> {active.detection.edgeQuality}%</p>
            <ul className="bgrem-features">
              {active.detection.features.map((f) => <li key={f}><Icon name="check" size={12} /> {f}</li>)}
            </ul>
          </div>
        </div>
        <div className="pdfword-actions">
          <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>Continue to Edit →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bgrem-shell pdfconv-layout mergepdf-upload-layout">
      <Steps current={0} />
      <div
        className={`pdfconv-drop ${dragOver ? 'drag-active' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void addFiles(e.dataTransfer.files); }}
        role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <Icon name="upload" size={32} />
        <b>Drop images here or click to browse</b>
        <span>PNG · JPG · WEBP · HEIC · AVIF · GIF · BMP · TIFF · ZIP batch</span>
      </div>
      <input ref={inputRef} type="file" hidden accept="image/*,.zip" multiple onChange={(e) => { void addFiles(e.target.files ?? []); e.target.value = ''; }} />
      <input ref={cameraRef} type="file" hidden accept="image/*" capture="environment" onChange={(e) => { void addFiles(e.target.files ?? []); e.target.value = ''; }} />
      <input ref={zipRef} type="file" hidden accept=".zip" onChange={(e) => { void addFiles(e.target.files ?? []); e.target.value = ''; }} />

      <div className="bgrem-upload-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => inputRef.current?.click()}><Icon name="image" size={14} /> Choose</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => cameraRef.current?.click()}><Icon name="image" size={14} /> Camera</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setUrlOpen((v) => !v)}><Icon name="link" size={14} /> URL</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => zipRef.current?.click()}><Icon name="folder" size={14} /> ZIP</button>
      </div>

      {urlOpen && (
        <div className="bgrem-url-row">
          <input type="url" placeholder="https://example.com/photo.jpg" value={urlValue} onChange={(e) => setUrlValue(e.target.value)} />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void fetchImageFromUrl(urlValue).then((f) => addFiles([f])).catch(() => toast('Invalid image URL', 'error'))}>Import</button>
        </div>
      )}

      <div className="mergepdf-fab-inline">{fab}</div>
      <div className="mergepdf-feature-badges">
        {['AI Cutout', 'Hair Refine', 'Batch', 'Private', 'HD Export'].map((b) => <span key={b}>{b}</span>)}
      </div>

      {jobs.length > 0 && (
        <div className="pdfconv-filebar">
          <span className="pdfconv-filebar-icon"><Icon name="image" size={20} /></span>
          <div className="pdfconv-filebar-meta">
            <b>{jobs.length} image(s) ready</b>
            <span className="muted">{formatBytes(jobs.reduce((s, j) => s + j.file.size, 0))}</span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setJobs([])}>Clear</button>
        </div>
      )}

      <div className="pdfword-privacy-badge"><Icon name="shield" size={16} /> Browser AI · files never uploaded · auto-private</div>

      {phase === 'error' && <ErrorBox message={error} onRetry={reset} />}

      <div className="pdfword-actions">
        <button type="button" className="btn btn-primary" disabled={!jobs.length || phase === 'working'} onClick={() => void runDetection()}>
          Remove Background with AI →
        </button>
      </div>
    </div>
  );
}
