'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

import { ErrorBox, fileMatchesAccept, useToolPhase, type ResultFile } from '../shared';
import { renderPdfPages } from '@/lib/pdf';
import { extractPdfTextSmart } from '@/lib/pdf-smart-text';
import { canvasToBlob } from '@/lib/image';
import { replaceExt, formatBytes } from '@/lib/download';
import { analyzeDocument, calculateConversionConfidence, buildPageStrategies, type DocumentStructure, type PageStrategy } from '@/lib/pdf-intelligence';
import Icon from '@/components/Icon';
import dynamic from 'next/dynamic';
import { looksBrokenBengali, restoreBengaliText } from '@/lib/text-restore';
import { useUI } from '@/components/GlobalUI';
import type { Tool } from '@/data/tools';

const ShareModal = dynamic(() => import('../ShareModal'), { ssr: false });

const ACCEPT_DEFAULT = 'application/pdf,image/*,.docx,.xlsx,.xls,.csv,.txt,.md,.html';

type InputKind = 'pdf' | 'to-pdf';

function isPdfFile(f: File) {
  return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
}

function isImageFile(f: File) {
  return f.type.startsWith('image/');
}

// ─── Types ───────────────────────────────────────────────────────────────────

type TargetFormat = 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'txt' | 'html' | 'rtf' | 'jpg' | 'png' | 'webp' | 'csv' | 'md';
type ViewMode = 'upload' | 'analysis' | 'review' | 'convert' | 'results' | 'diff' | 'compare';

interface ConvertSettings {
  imageQuality: number; // 0.5–1.0, applies to jpg/webp/pptx
  resolution: number;   // render scale 1.5–3.0, applies to image/pptx targets
}

const DEFAULT_SETTINGS: ConvertSettings = { imageQuality: 0.9, resolution: 2 };

const IMAGE_TARGETS: TargetFormat[] = ['jpg', 'png', 'webp', 'pptx'];

interface ConversionResult {
  format: TargetFormat;
  file: ResultFile;
  confidence: number;
  previewHtml?: string;
  originalSize: number;
  durationMs: number;
}

const FORMAT_META: Record<TargetFormat, { label: string; icon: string; color: string; desc: string }> = {
  pdf: { label: 'PDF', icon: 'file-text', color: '#ef4444', desc: 'Portable document' },
  docx: { label: 'Word', icon: 'file-text', color: '#2b579a', desc: 'Editable document' },
  xlsx: { label: 'Excel', icon: 'table', color: '#217346', desc: 'Spreadsheet' },
  pptx: { label: 'PowerPoint', icon: 'presentation', color: '#d24726', desc: 'Slides' },
  txt: { label: 'Text', icon: 'type', color: '#6b7280', desc: 'Plain text' },
  html: { label: 'HTML', icon: 'code', color: '#e34c26', desc: 'Web page' },
  rtf: { label: 'RTF', icon: 'file-text', color: '#5b21b6', desc: 'Rich text' },
  jpg: { label: 'JPG', icon: 'image', color: '#059669', desc: 'Image' },
  png: { label: 'PNG', icon: 'image', color: '#0891b2', desc: 'Lossless' },
  webp: { label: 'WebP', icon: 'image', color: '#7c3aed', desc: 'Modern image' },
  csv: { label: 'CSV', icon: 'table', color: '#ca8a04', desc: 'Data' },
  md: { label: 'Markdown', icon: 'type', color: '#1e40af', desc: 'Markdown' },
};

const ALL_TARGETS: TargetFormat[] = ['docx', 'xlsx', 'pptx', 'txt', 'html', 'rtf', 'jpg', 'png', 'webp', 'csv', 'md'];

// ─── Step indicator ──────────────────────────────────────────────────────────

const STEPS = ['Upload', 'Analyze', 'Convert', 'Download'] as const;

function Steps({ current }: { current: number }) {
  return (
    <div className="pdfconv-steps" aria-label="Conversion progress">
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

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PdfConverterAdvanced({ tool }: { tool: Tool }) {
  const { phase, setPhase, error, fail, reset } = useToolPhase();
  const { toast } = useUI();
  const accept = tool.accept ?? ACCEPT_DEFAULT;
  const [file, setFile] = useState<File | null>(null);
  const [inputKind, setInputKind] = useState<InputKind>('pdf');
  const [view, setView] = useState<ViewMode>('upload');
  const [structure, setStructure] = useState<DocumentStructure | null>(null);
  const [strategies, setStrategies] = useState<PageStrategy[]>([]);
  const [targetFormat, setTargetFormat] = useState<TargetFormat | null>(null);
  const [results, setResults] = useState<ConversionResult[]>([]);
  const [compareFormats, setCompareFormats] = useState<TargetFormat[]>([]);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [convertProgress, setConvertProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [pdfPages, setPdfPages] = useState<HTMLCanvasElement[]>([]);
  const [diffPage, setDiffPage] = useState(0);
  const [structureOpen, setStructureOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [settings, setSettings] = useState<ConvertSettings>(DEFAULT_SETTINGS);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [urlBusy, setUrlBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── File staging + analysis ─────────────────────────────────────────────

  const clearStaged = useCallback(() => {
    setFile(null);
    setInputKind('pdf');
    setStructure(null);
    setStrategies([]);
    setPdfPages([]);
    setTargetFormat(null);
    setResults([]);
  }, []);

  const stageFile = useCallback((f: File) => {
    setFile(f);
    setInputKind(isPdfFile(f) ? 'pdf' : 'to-pdf');
    setStructure(null);
    setStrategies([]);
    setPdfPages([]);
    setTargetFormat(null);
    setResults([]);
    setView('upload');
    setPhase('idle');
  }, [setPhase]);

  const stageFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming).filter(Boolean);
    if (!list.length) return;
    const supported = list.filter((f) => fileMatchesAccept(f, accept));
    if (supported.length === 0) {
      toast(`${list[0].name} supported nahi — PDF, Image, Word, Excel, Text ya HTML dalo`, 'error');
      return;
    }
    if (supported.length > 1) toast(`Using first file — ${supported[0].name}`, 'info');
    stageFile(supported[0]);
  }, [stageFile, toast, accept]);

  const runAnalyze = useCallback(async () => {
    if (!file) return;

    if (inputKind === 'to-pdf') {
      setTargetFormat('pdf');
      setView('convert');
      return;
    }

    setView('analysis');
    setAnalysisProgress(0);

    try {
      const doc = await analyzeDocument(file, (d, t) => setAnalysisProgress(d / t));
      setStructure(doc);
      setStrategies(buildPageStrategies(doc));

      const pages = await renderPdfPages(file, 1.2, undefined);
      setPdfPages(pages.slice(0, 10).map((p) => p.canvas));

      setView('review');
    } catch (e) {
      fail(e);
      setView('upload');
    }
  }, [file, inputKind, fail]);

  const importFromUrl = useCallback(async () => {
    const url = urlValue.trim();
    if (!url) return;
    setUrlBusy(true);
    try {
      const res = await fetch(`/api/fetch-pdf?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error || 'Could not import that URL');
      }
      const blob = await res.blob();
      const name = (url.split('/').pop() || 'document').split('?')[0];
      setUrlOpen(false);
      setUrlValue('');
      stageFile(new File([blob], name.endsWith('.pdf') ? name : `${name}.pdf`, { type: 'application/pdf' }));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import failed', 'error');
    } finally {
      setUrlBusy(false);
    }
  }, [urlValue, stageFile, toast]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t === 'application/pdf');
        if (!type) continue;
        const blob = await item.getType(type);
        stageFile(new File([blob], `pasted-${Date.now()}.pdf`, { type }));
        return;
      }
      toast('No PDF found in clipboard — copy a PDF file first', 'error');
    } catch {
      toast('Clipboard access denied', 'error');
    }
  }, [stageFile, toast]);

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.files;
      if (!items?.length) return;
      const f = items[0];
      if (f.type === 'application/pdf' || f.type.startsWith('image/') || /\.(docx|xlsx|txt|csv|html|md)$/i.test(f.name)) {
        e.preventDefault();
        stageFile(f);
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [stageFile]);

  // ─── Conversion ──────────────────────────────────────────────────────────

  const convertToFormat = async (fmt: TargetFormat): Promise<ConversionResult> => {
    if (!file) throw new Error('No file');
    const t0 = performance.now();
    const { file: result, previewHtml: enginePreview } = await runConversion(file, fmt, settings, (p) => setConvertProgress(p));
    const conf = structure
      ? calculateConversionConfidence(structure, fmt)
      : { overall: fmt === 'pdf' ? 96 : 80, perPage: [] as number[], issues: [] as string[] };
    const previewHtml = enginePreview ?? (await generatePreview(result.blob, fmt));
    return { format: fmt, file: result, confidence: conf.overall, previewHtml, originalSize: file.size, durationMs: performance.now() - t0 };
  };

  const startConversion = async () => {
    if (!targetFormat || !file) return;
    setPhase('working');
    setConvertProgress(0);
    try {
      const result = await convertToFormat(targetFormat);
      setResults([result]);
      setView('results');
      setPhase('done');
    } catch (e) { fail(e); }
  };

  const startComparison = async () => {
    if (compareFormats.length < 2 || !file) return;
    setPhase('working');
    setConvertProgress(0);
    try {
      const allResults: ConversionResult[] = [];
      for (let i = 0; i < compareFormats.length; i++) {
        const r = await convertToFormat(compareFormats[i]);
        allResults.push(r);
        setConvertProgress((i + 1) / compareFormats.length);
      }
      setResults(allResults);
      setView('compare');
      setPhase('done');
    } catch (e) { fail(e); }
  };

  // ─── Download ────────────────────────────────────────────────────────────

  const download = (rf: ResultFile) => {
    const url = URL.createObjectURL(rf.blob);
    const a = document.createElement('a');
    a.href = url; a.download = rf.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const resetAll = () => {
    reset();
    clearStaged();
    setView('upload');
    setCompareFormats([]);
    setSettings(DEFAULT_SETTINGS);
    setAdvancedOpen(false);
    setUrlOpen(false);
    setUrlValue('');
  };

  // ─── Confidence Data ─────────────────────────────────────────────────────

  const confidenceData = useMemo(() => {
    if (!structure || !targetFormat) return null;
    return calculateConversionConfidence(structure, targetFormat);
  }, [structure, targetFormat]);

  const pageThumbs = useMemo(
    () => pdfPages.map((c) => c.toDataURL('image/jpeg', 0.6)),
    [pdfPages],
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: UPLOAD VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  if (view === 'upload') {
    return (
      <div className="pdfconv-shell pdfconv-layout mergepdf-upload-layout">
        <Steps current={0} />
        <div
          className={`pdfconv-drop ${dragOver ? 'drag-active' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); stageFiles(e.dataTransfer.files); }}
          role="button" tabIndex={0}
          aria-label="Upload a file to convert"
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        >
          <Icon name="upload" size={32} />
          <b>Drop files here or click to browse</b>
          <span>PDF · Word · Excel · Images · Text · 11 output formats · 100% private</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={accept}
          multiple
          onChange={(e) => { stageFiles(e.target.files ?? []); e.target.value = ''; }}
        />

        <div className="bgrem-upload-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => inputRef.current?.click()}>
            <Icon name="file-text" size={14} /> Choose file
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void pasteFromClipboard()}>
            <Icon name="clipboard" size={14} /> Paste
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setUrlOpen((v) => !v)}>
            <Icon name="link" size={14} /> URL
          </button>
        </div>

        {urlOpen && (
          <div className="bgrem-url-row">
            <input
              type="url"
              placeholder="https://example.com/document.pdf"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void importFromUrl()}
            />
            <button type="button" className="btn btn-primary btn-sm" disabled={urlBusy || !urlValue.trim()} onClick={() => void importFromUrl()}>
              {urlBusy ? 'Fetching…' : 'Import'}
            </button>
          </div>
        )}

        <div className="mergepdf-feature-badges">
          {['11 Formats', 'AI Analyze', 'Visual Diff', 'OCR', 'Private'].map((b) => <span key={b}>{b}</span>)}
        </div>

        <div className="pdfconv-out-formats">
          {ALL_TARGETS.map((f) => (
            <span key={f} style={{ color: FORMAT_META[f].color }}>{FORMAT_META[f].label}</span>
          ))}
          <span style={{ color: FORMAT_META.pdf.color }}>PDF</span>
        </div>

        {file && (
          <div className="pdfconv-filebar">
            <span className="pdfconv-filebar-icon">
              <Icon name={isImageFile(file) ? 'image' : 'file-text'} size={20} />
            </span>
            <div className="pdfconv-filebar-meta">
              <b>{file.name}</b>
              <span className="muted">
                {formatBytes(file.size)}
                {inputKind === 'to-pdf' ? ' · Convert to PDF' : ' · PDF → analyze & convert'}
              </span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearStaged}>Clear</button>
          </div>
        )}

        <div className="pdfword-privacy-badge">
          <Icon name="shield" size={16} /> Browser processing · files never uploaded · auto-private
        </div>

        {phase === 'error' && <ErrorBox message={error} onRetry={reset} />}

        <div className="pdfword-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!file}
            onClick={() => void runAnalyze()}
          >
            {inputKind === 'to-pdf' ? 'Continue to Convert →' : 'Analyze & Continue →'}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: ANALYSIS IN PROGRESS
  // ═══════════════════════════════════════════════════════════════════════════

  if (view === 'analysis') {
    return (
      <div className="pdfconv-processing">
        <Steps current={1} />
        <div className="pdfconv-progress-ring-wrap">
          <svg className="pdfconv-progress-ring" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border-subtle)" strokeWidth="8" />
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--brand-primary)" strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 52}`} strokeDashoffset={`${2 * Math.PI * 52 * (1 - analysisProgress)}`}
              strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.3s', transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
          </svg>
          <div className="pdfconv-progress-text"><b>{Math.round(analysisProgress * 100)}%</b><span>Analyzing</span></div>
        </div>
        <h3 style={{ marginTop: 20 }}>Analyzing Document Structure</h3>
        <p className="muted">Detecting headings, tables, images, and document type...</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: ANALYZE REVIEW (step 2 — distinct screen)
  // ═══════════════════════════════════════════════════════════════════════════

  if (view === 'review' && structure) {
    const docLabel = structure.documentType === 'unknown'
      ? 'General Document'
      : structure.documentType.charAt(0).toUpperCase() + structure.documentType.slice(1);
    const facts = [
      { icon: 'file-text', label: 'Pages', value: String(structure.pageCount) },
      { icon: 'type', label: 'Words', value: structure.totalWords.toLocaleString() },
      { icon: 'table', label: 'Tables', value: String(structure.tables.length) },
      { icon: 'image', label: 'Images', value: String(structure.images.length) },
    ];
    return (
      <div className="pdfconv-main-view">
        <Steps current={1} />

        <div className="pdfconv-review-hero">
          <div className="pdfconv-review-badge">
            <Icon name="sparkles" size={18} />
            <div>
              <b>Analysis complete</b>
              <span>{docLabel} · {structure.documentTypeConfidence}% match confidence</span>
            </div>
          </div>
          <div className="pdfconv-review-facts">
            {facts.map((f) => (
              <div key={f.label} className="pdfconv-review-fact">
                <span className="pdfconv-review-fact-icon"><Icon name={f.icon} size={16} /></span>
                <b>{f.value}</b>
                <span className="muted">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {pageThumbs.length > 0 && (
          <div className="pdfconv-thumbs" aria-label="Document pages">
            {pageThumbs.map((src, i) => (
              <figure key={i} className="pdfconv-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Page ${i + 1}`} loading="lazy" />
                <figcaption>{i + 1}</figcaption>
              </figure>
            ))}
            {structure.pageCount > pageThumbs.length && (
              <div className="pdfconv-thumb pdfconv-thumb-more">+{structure.pageCount - pageThumbs.length}</div>
            )}
          </div>
        )}

        <div className="pdfconv-ai-rec" onClick={() => { setTargetFormat(structure.formatRecommendation.format as TargetFormat); setView('convert'); }}>
          <Icon name="sparkles" size={16} />
          <span><b>AI recommends {FORMAT_META[structure.formatRecommendation.format as TargetFormat]?.label || structure.formatRecommendation.format}</b> &mdash; {structure.formatRecommendation.reason}</span>
          <Icon name="chevron-right" size={14} />
        </div>

        <div className="pdfconv-review-actions">
          <button className="btn btn-ghost" onClick={resetAll}><Icon name="upload" size={15} /> Change file</button>
          <button className="btn btn-primary pdfconv-convert-btn" onClick={() => setView('convert')} style={{ maxWidth: 320 }}>
            Continue to Convert <Icon name="arrow-right" size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: PROCESSING
  // ═══════════════════════════════════════════════════════════════════════════

  if (phase === 'working') {
    return (
      <div className="pdfconv-processing">
        <Steps current={2} />
        <div className="pdfconv-progress-ring-wrap">
          <svg className="pdfconv-progress-ring" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border-subtle)" strokeWidth="8" />
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--brand-primary)" strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 52}`} strokeDashoffset={`${2 * Math.PI * 52 * (1 - convertProgress)}`}
              strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.3s', transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
          </svg>
          <div className="pdfconv-progress-text"><b>{Math.round(convertProgress * 100)}%</b><span>Converting</span></div>
        </div>
        <h3 style={{ marginTop: 20 }}>Converting to {targetFormat ? FORMAT_META[targetFormat].label : 'multiple formats'}...</h3>
        <p className="muted">Using smart per-page routing for best results</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: VISUAL DIFF VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  if (view === 'diff' && results.length > 0) {
    const result = results[0];
    return (
      <div className="pdfconv-diff-view">
        <div className="pdfconv-diff-toolbar">
          <h3><Icon name="split" size={16} /> Visual Diff: Original vs Converted</h3>
          <div className="pdfconv-diff-nav">
            <button className="btn btn-ghost btn-sm" disabled={diffPage === 0} onClick={() => setDiffPage((p) => p - 1)}><Icon name="chevron-left" size={14} /></button>
            <span className="mono">Page {diffPage + 1} / {pdfPages.length}</span>
            <button className="btn btn-ghost btn-sm" disabled={diffPage >= pdfPages.length - 1} onClick={() => setDiffPage((p) => p + 1)}><Icon name="chevron-right" size={14} /></button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setView('results')}><Icon name="x" size={14} /> Close</button>
        </div>
        <div className="pdfconv-diff-panels">
          <div className="pdfconv-diff-panel">
            <div className="pdfconv-diff-label">Original PDF</div>
            {pdfPages[diffPage] && <canvas ref={(el) => { if (el && pdfPages[diffPage]) { el.width = pdfPages[diffPage].width; el.height = pdfPages[diffPage].height; el.getContext('2d')?.drawImage(pdfPages[diffPage], 0, 0); } }} />}
          </div>
          <div className="pdfconv-diff-panel">
            <div className="pdfconv-diff-label">Converted ({FORMAT_META[result.format].label})</div>
            {result.previewHtml ? (
              <div className="pdfconv-diff-preview" dangerouslySetInnerHTML={{ __html: result.previewHtml }} />
            ) : (
              <div className="pdfconv-diff-placeholder"><Icon name="file-text" size={32} /><p>Preview generated on download</p></div>
            )}
          </div>
        </div>
        <div className="pdfconv-diff-confidence">
          {structure && confidenceData && (
            <div className="pdfconv-page-scores">
              {confidenceData.perPage.slice(0, 10).map((score, i) => (
                <div key={i} className={`pdfconv-page-score ${score >= 80 ? 'high' : score >= 50 ? 'mid' : 'low'}`}>
                  <span>P{i + 1}</span>
                  <div className="pdfconv-score-bar"><div style={{ width: `${score}%` }} /></div>
                  <span className="mono">{score}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: MULTI-FORMAT COMPARISON VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  if (view === 'compare' && results.length > 1) {
    return (
      <div className="pdfconv-compare-view">
        <div className="pdfconv-compare-header">
          <h3><Icon name="split" size={16} /> Format Comparison</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => setView('convert')}><Icon name="x" size={14} /> Close</button>
        </div>
        <div className="pdfconv-compare-grid" style={{ gridTemplateColumns: `repeat(${results.length}, 1fr)` }}>
          {results.map((r) => (
            <div key={r.format} className="pdfconv-compare-card">
              <div className="pdfconv-compare-card-head">
                <div className="pdfconv-fmt-icon" style={{ background: FORMAT_META[r.format].color + '18', color: FORMAT_META[r.format].color }}>
                  <Icon name={FORMAT_META[r.format].icon} size={20} />
                </div>
                <div><b>{FORMAT_META[r.format].label}</b><br /><span className="muted">{formatBytes(r.file.blob.size)}</span></div>
              </div>
              <div className={`pdfconv-confidence-badge ${r.confidence >= 80 ? 'high' : r.confidence >= 50 ? 'mid' : 'low'}`}>
                {r.confidence}% confidence
              </div>
              {r.previewHtml && <div className="pdfconv-compare-preview" dangerouslySetInnerHTML={{ __html: r.previewHtml }} />}
              <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 12 }} onClick={() => download(r.file)}>
                <Icon name="download" size={14} /> Download
              </button>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={resetAll}><Icon name="upload" size={15} /> New Conversion</button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: RESULTS VIEW (with live preview)
  // ═══════════════════════════════════════════════════════════════════════════

  if (view === 'results' && results.length > 0) {
    const r = results[0];
    return (
      <div className="pdfconv-results">
        <Steps current={3} />

        {/* Success hero with confetti */}
        <div className="pdfconv-success">
          <div className="pdfconv-confetti" aria-hidden>
            {Array.from({ length: 14 }).map((_, i) => <span key={i} style={{ ['--i' as string]: i }} />)}
          </div>
          <div className="pdfconv-success-check"><Icon name="check" size={30} /></div>
          <h3>Your file is ready!</h3>
          <p className="muted">Converted to {FORMAT_META[r.format].label} · {r.confidence}% accuracy</p>
          <button className="btn btn-primary pdfconv-convert-btn" style={{ maxWidth: 300 }} onClick={() => download(r.file)}>
            <Icon name="download" size={17} /> Download {FORMAT_META[r.format].label}
          </button>
        </div>

        {/* Conversion report — real stats */}
        <div className="pdfconv-report">
          {[
            { label: 'Output size', value: formatBytes(r.file.blob.size) },
            { label: 'Original', value: formatBytes(r.originalSize) },
            { label: 'Processed in', value: `${(r.durationMs / 1000).toFixed(1)}s` },
            { label: 'Pages', value: String(structure?.pageCount ?? '—') },
          ].map((s) => (
            <div key={s.label} className="pdfconv-report-cell">
              <b>{s.value}</b>
              <span className="muted">{s.label}</span>
            </div>
          ))}
        </div>


        {/* Live Preview */}
        {r.previewHtml && (
          <div className="pdfconv-live-preview">
            <div className="pdfconv-live-preview-head">
              <span><Icon name="eye" size={14} /> Live Preview</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setView('diff')}>
                <Icon name="split" size={13} /> Visual Diff
              </button>
            </div>
            <div className="pdfconv-live-preview-content" dangerouslySetInnerHTML={{ __html: r.previewHtml }} />
          </div>
        )}

        {/* Confidence Issues */}
        {confidenceData && confidenceData.issues.length > 0 && (
          <div className="pdfconv-issues">
            <b><Icon name="alert-triangle" size={13} /> Potential Issues ({confidenceData.issues.length})</b>
            {confidenceData.issues.map((issue, i) => <p key={i}>{issue}</p>)}
          </div>
        )}

        <div className="pdfconv-result-card done">
          <div className="pdfconv-result-icon" style={{ background: FORMAT_META[r.format].color + '22', color: FORMAT_META[r.format].color }}>
            <Icon name={FORMAT_META[r.format].icon} size={22} />
          </div>
          <div className="pdfconv-result-info">
            <b>{r.file.name}</b>
            <span className="muted">{formatBytes(r.file.blob.size)} &middot; {FORMAT_META[r.format].label}</span>
          </div>
          <button className="btn btn-primary" onClick={() => download(r.file)}><Icon name="download" size={16} /> Download</button>
        </div>

        <div className="pdfconv-result-actions">
          <button className="btn btn-outline" onClick={() => { setView('diff'); setDiffPage(0); }}>
            <Icon name="split" size={15} /> Visual Diff
          </button>
          <button className="btn btn-outline" onClick={() => { setResults([]); setTargetFormat(null); setView('convert'); setPhase('idle'); }}>
            <Icon name="refresh" size={15} /> Try Another Format
          </button>
          <button className="btn btn-ghost" onClick={resetAll}>
            <Icon name="upload" size={15} /> New File
          </button>
          <button className="btn btn-primary" onClick={() => setShareOpen(true)}>
            <Icon name="link" size={15} /> Share Link
          </button>
        </div>
        {shareOpen && (
          <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} file={r.file} toolSlug="pdf-converter" />
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: MAIN CONVERSION VIEW (with structure + format selection)
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="pdfconv-shell pdfconv-main-view">
      <Steps current={2} />

      {/* File info bar */}
      {file && (
        <div className="pdfconv-filebar">
          <span className="pdfconv-filebar-icon"><Icon name={isImageFile(file) ? 'image' : 'file-text'} size={18} /></span>
          <div className="pdfconv-filebar-meta">
            <b>{file.name}</b>
            <span className="muted">
              {formatBytes(file.size)}
              {inputKind === 'to-pdf'
                ? ' · Convert to PDF'
                : structure ? ` · ${structure.pageCount} page${structure.pageCount === 1 ? '' : 's'}` : ''}
            </span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={resetAll}>
            <Icon name="refresh" size={13} /> Change file
          </button>
        </div>
      )}

      {/* Page thumbnails */}
      {pageThumbs.length > 0 && (
        <div className="pdfconv-thumbs" aria-label="Document pages">
          {pageThumbs.map((src, i) => (
            <figure key={i} className="pdfconv-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Page ${i + 1}`} loading="lazy" />
              <figcaption>{i + 1}</figcaption>
            </figure>
          ))}
          {structure && structure.pageCount > pageThumbs.length && (
            <div className="pdfconv-thumb pdfconv-thumb-more">+{structure.pageCount - pageThumbs.length}</div>
          )}
        </div>
      )}

      {/* Document Intelligence Panel */}
      {structure && (
        <div className="pdfconv-intel-panel">
          <div className="pdfconv-intel-header" onClick={() => setStructureOpen(!structureOpen)}>
            <h3><Icon name="sparkles" size={16} /> Document Intelligence</h3>
            <Icon name={structureOpen ? 'chevron-up' : 'chevron-down'} size={14} />
          </div>

          {structureOpen && (
            <div className="pdfconv-intel-body">
              {/* Document Type Detection */}
              <div className="pdfconv-doc-type">
                <div className="pdfconv-doc-type-badge">
                  <Icon name="file-text" size={16} />
                  <span>{structure.documentType === 'unknown' ? 'General Document' : structure.documentType.charAt(0).toUpperCase() + structure.documentType.slice(1)}</span>
                  <span className={`pdfconv-confidence-pill ${structure.documentTypeConfidence >= 70 ? 'high' : 'mid'}`}>
                    {structure.documentTypeConfidence}% sure
                  </span>
                </div>
                <div className="pdfconv-doc-stats">
                  <span>{structure.pageCount} pages</span>
                  <span>{structure.totalWords.toLocaleString()} words</span>
                  <span>{structure.tables.length} tables</span>
                  <span>{structure.images.length} images</span>
                </div>
              </div>

              {/* Smart Page Router Visualization */}
              <div className="pdfconv-page-router">
                <b>Smart Page Analysis</b>
                <div className="pdfconv-page-pills">
                  {strategies.slice(0, 20).map((s) => (
                    <div key={s.pageNum} className={`pdfconv-page-pill ${s.type}`} title={`Page ${s.pageNum}: ${s.type} (${s.strategy})`}>
                      {s.pageNum}
                    </div>
                  ))}
                  {strategies.length > 20 && <span className="muted">+{strategies.length - 20} more</span>}
                </div>
                <div className="pdfconv-page-legend">
                  <span className="pdfconv-legend text">Text</span>
                  <span className="pdfconv-legend table">Table</span>
                  <span className="pdfconv-legend image">Image</span>
                  <span className="pdfconv-legend mixed">Mixed</span>
                </div>
              </div>

              {/* Structure Tree */}
              {structure.headings.length > 0 && (
                <div className="pdfconv-structure-tree">
                  <b>Document Structure</b>
                  <div className="pdfconv-tree-items">
                    {structure.headings.slice(0, 15).map((h, i) => (
                      <div key={i} className="pdfconv-tree-item" style={{ paddingLeft: (h.level - 1) * 16 }}>
                        <Icon name={h.level === 1 ? 'hash' : 'chevron-right'} size={12} />
                        <span>{h.text}</span>
                        <span className="muted">p.{h.page}</span>
                      </div>
                    ))}
                    {structure.headings.length > 15 && <p className="muted" style={{ fontSize: 11 }}>+{structure.headings.length - 15} more headings</p>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Format Selection + Conversion */}
      <div className="pdfconv-panel">
        {inputKind === 'to-pdf' ? (
          <>
            <div className="pdfconv-ai-rec" onClick={() => setTargetFormat('pdf')}>
              <Icon name="file-text" size={16} />
              <span><b>Output: PDF</b> &mdash; optimized for sharing, printing &amp; uploads</span>
              <Icon name="chevron-right" size={14} />
            </div>
            <button className="btn btn-primary pdfconv-convert-btn" onClick={() => { setTargetFormat('pdf'); void startConversion(); }}>
              <Icon name="zap" size={18} /> Convert to PDF
            </button>
          </>
        ) : (
          <>
        {/* AI Recommendation */}
        {structure && (
          <div className="pdfconv-ai-rec" onClick={() => setTargetFormat(structure.formatRecommendation.format as TargetFormat)}>
            <Icon name="sparkles" size={16} />
            <span><b>AI recommends: {FORMAT_META[structure.formatRecommendation.format as TargetFormat]?.label || structure.formatRecommendation.format}</b> &mdash; {structure.formatRecommendation.reason}</span>
            <Icon name="chevron-right" size={14} />
          </div>
        )}

        {/* Format Grid */}
        <div className="pdfconv-format-section">
          <h3>Convert to</h3>
          <div className="pdfconv-format-grid">
            {ALL_TARGETS.map((fmt) => {
              const conf = structure ? calculateConversionConfidence(structure, fmt) : null;
              return (
                <button key={fmt} className={`pdfconv-format-btn ${targetFormat === fmt ? 'active' : ''}`} onClick={() => setTargetFormat(fmt)}>
                  <div className="pdfconv-fmt-icon" style={{ background: FORMAT_META[fmt].color + '18', color: FORMAT_META[fmt].color }}>
                    <Icon name={FORMAT_META[fmt].icon} size={18} />
                  </div>
                  <div className="pdfconv-fmt-info">
                    <b>{FORMAT_META[fmt].label}</b>
                    <span>{FORMAT_META[fmt].desc}</span>
                  </div>
                  {conf && <span className={`pdfconv-mini-score ${conf.overall >= 80 ? 'high' : conf.overall >= 50 ? 'mid' : 'low'}`}>{conf.overall}%</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Confidence Preview */}
        {targetFormat && confidenceData && (
          <div className="pdfconv-confidence-section">
            <div className={`pdfconv-confidence-badge large ${confidenceData.overall >= 80 ? 'high' : confidenceData.overall >= 50 ? 'mid' : 'low'}`}>
              <b>{confidenceData.overall}%</b> estimated accuracy for {FORMAT_META[targetFormat].label}
            </div>
            {confidenceData.issues.length > 0 && (
              <div className="pdfconv-issues-preview">
                {confidenceData.issues.slice(0, 3).map((issue, i) => <span key={i}><Icon name="alert-triangle" size={11} /> {issue}</span>)}
              </div>
            )}
          </div>
        )}

        {/* Advanced settings — only meaningful for image-based targets */}
        {targetFormat && IMAGE_TARGETS.includes(targetFormat) && (
          <div className="pdfconv-adv">
            <button className="pdfconv-advanced-toggle" onClick={() => setAdvancedOpen((o) => !o)}>
              <Icon name="settings" size={14} /> Advanced image settings
              <Icon name={advancedOpen ? 'chevron-up' : 'chevron-down'} size={13} />
            </button>
            {advancedOpen && (
              <div className="pdfconv-adv-body">
                <div className="pdfconv-opt-row">
                  <label>Resolution <span className="pdfconv-opt-val">{settings.resolution.toFixed(1)}× ({Math.round(settings.resolution * 72)} DPI)</span></label>
                  <input type="range" min={1.5} max={3} step={0.5} value={settings.resolution}
                    onChange={(e) => setSettings((s) => ({ ...s, resolution: +e.target.value }))} />
                  <div className="pdfconv-range-ends"><span>Smaller file</span><span>Sharper</span></div>
                </div>
                {targetFormat !== 'png' && (
                  <div className="pdfconv-opt-row">
                    <label>Image quality <span className="pdfconv-opt-val">{Math.round(settings.imageQuality * 100)}%</span></label>
                    <input type="range" min={0.5} max={1} step={0.05} value={settings.imageQuality}
                      onChange={(e) => setSettings((s) => ({ ...s, imageQuality: +e.target.value }))} />
                    <div className="pdfconv-range-ends"><span>Compact</span><span>Best</span></div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Convert Button */}
        <button className="btn btn-primary pdfconv-convert-btn" disabled={!targetFormat} onClick={() => void startConversion()}>
          <Icon name="zap" size={18} />
          {targetFormat ? `Convert to ${FORMAT_META[targetFormat].label}` : 'Select a format'}
        </button>

        {/* Multi-Format Comparison */}
        <div className="pdfconv-compare-section">
          <button className="pdfconv-advanced-toggle" onClick={() => setCompareFormats((f) => f.length > 0 ? [] : ['docx', 'xlsx'])}>
            <Icon name="split" size={14} /> Multi-Format Comparison
          </button>
          {compareFormats.length > 0 && (
            <div className="pdfconv-compare-picker">
              <p className="muted" style={{ fontSize: 12 }}>Select 2-3 formats to compare side-by-side:</p>
              <div className="pdfconv-compare-chips">
                {ALL_TARGETS.map((fmt) => (
                  <button key={fmt} className={`pdfconv-chip ${compareFormats.includes(fmt) ? 'active' : ''}`}
                    onClick={() => setCompareFormats((prev) => prev.includes(fmt) ? prev.filter((f) => f !== fmt) : prev.length < 3 ? [...prev, fmt] : prev)}>
                    {FORMAT_META[fmt].label}
                  </button>
                ))}
              </div>
              <button className="btn btn-outline" disabled={compareFormats.length < 2} onClick={() => void startComparison()} style={{ marginTop: 10 }}>
                <Icon name="split" size={14} /> Compare {compareFormats.length} Formats
              </button>
            </div>
          )}
        </div>
          </>
        )}

        <p className="pdfconv-privacy-note"><Icon name="lock" size={12} /> 100% browser-based. Files never leave your device.</p>
        {phase === 'error' && <ErrorBox message={error} onRetry={reset} />}
      </div>
    </div>
  );
}

// ─── Conversion Engine ───────────────────────────────────────────────────────

/** AI-repair shattered Bengali/Indic text page-by-page. Fail-soft: any AI
 *  failure keeps that page's original text — conversion never aborts. */
async function repairBengaliPages(pages: string[], onProgress: (p: number) => void): Promise<string[]> {
  if (!pages.some((p) => looksBrokenBengali(p))) return pages;
  const fixed: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    onProgress(0.7 + ((i + 1) / pages.length) * 0.25);
    if (!looksBrokenBengali(pages[i])) { fixed.push(pages[i]); continue; }
    try {
      const repaired = await restoreBengaliText(pages[i]);
      fixed.push(repaired.trim() ? repaired : pages[i]);
    } catch {
      fixed.push(pages[i]);
    }
  }
  return fixed;
}

function textPreview(text: string): string {
  const escaped = text.slice(0, 2000).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<pre class="pdfconv-text-preview">${escaped}</pre>`;
}

function imagePreview(canvas: HTMLCanvasElement): string {
  return `<div class="pdfconv-img-preview"><img src="${canvas.toDataURL('image/jpeg', 0.82)}" alt="Converted page preview" style="max-width:100%;height:auto;border-radius:8px" /></div>`;
}

async function runConversion(
  file: File,
  target: TargetFormat,
  settings: ConvertSettings,
  onProgress: (p: number) => void,
): Promise<{ file: ResultFile; previewHtml?: string }> {
  if (target === 'pdf') {
    const { PDFDocument, StandardFonts, rgb } = await import('@cantoo/pdf-lib');
    const doc = await PDFDocument.create();
    onProgress(0.08);

    if (isImageFile(file)) {
      const bytes = await file.arrayBuffer();
      const embedded = file.type === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const page = doc.addPage([595.28, 841.89]);
      const margin = 36;
      const maxW = page.getWidth() - margin * 2;
      const maxH = page.getHeight() - margin * 2;
      const scale = Math.min(maxW / embedded.width, maxH / embedded.height);
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      page.drawImage(embedded, {
        x: (page.getWidth() - w) / 2,
        y: (page.getHeight() - h) / 2,
        width: w,
        height: h,
      });
    } else if (/\.docx$/i.test(file.name)) {
      const mammoth = await import('mammoth');
      const { value: text } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const lines = text.split('\n');
      let page = doc.addPage([595.28, 841.89]);
      let y = page.getHeight() - 48;
      for (let i = 0; i < lines.length; i++) {
        if (y < 48) { page = doc.addPage([595.28, 841.89]); y = page.getHeight() - 48; }
        page.drawText(lines[i].slice(0, 90), { x: 48, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
        y -= 14;
        onProgress(0.08 + ((i + 1) / lines.length) * 0.85);
      }
    } else {
      let text = '';
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        text = wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n');
      } else {
        text = await file.text();
      }
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const lines = text.split('\n');
      let page = doc.addPage([595.28, 841.89]);
      let y = page.getHeight() - 48;
      for (let i = 0; i < lines.length; i++) {
        if (y < 48) { page = doc.addPage([595.28, 841.89]); y = page.getHeight() - 48; }
        page.drawText(lines[i].slice(0, 96), { x: 48, y, size: 10, font, color: rgb(0.15, 0.15, 0.15) });
        y -= 13;
        onProgress(0.08 + ((i + 1) / lines.length) * 0.85);
      }
    }

    onProgress(1);
    const out = await doc.save();
    return {
      file: { name: replaceExt(file.name, 'pdf'), blob: new Blob([new Uint8Array(out)], { type: 'application/pdf' }) },
    };
  }

  if (target === 'docx') {
    const { pages: rawPages } = await extractPdfTextSmart(file, (d, t) => onProgress((d / t) * 0.6));
    const pages = await repairBengaliPages(rawPages, onProgress);
    const { Document, Packer, Paragraph, TextRun, PageBreak } = await import('docx');
    const children = pages.flatMap((pt, pi) => {
      const paras = pt.split('\n').filter(Boolean).map((l) => new Paragraph({ children: [new TextRun({ text: l, size: 22 })], spacing: { after: 120 } }));
      if (pi < pages.length - 1) paras.push(new Paragraph({ children: [new PageBreak()] }));
      return paras;
    });
    onProgress(1);
    return {
      file: { name: replaceExt(file.name, 'docx'), blob: await Packer.toBlob(new Document({ sections: [{ children }] })) },
      previewHtml: textPreview(pages.join('\n\n')),
    };
  }
  if (target === 'xlsx' || target === 'csv') {
    const { pages } = await extractPdfTextSmart(file, (d, t) => onProgress((d / t) * 0.7));
    if (target === 'csv') {
      const csv = pages.flatMap((p) => p.split('\n').filter(Boolean).map((l) => l.split(/\s{2,}|\t/).map((c) => c.includes(',') ? `"${c.trim()}"` : c.trim()).join(','))).join('\n');
      onProgress(1);
      return { file: { name: replaceExt(file.name, 'csv'), blob: new Blob([csv], { type: 'text/csv' }) } };
    }
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    pages.forEach((pt, i) => {
      const rows = pt.split('\n').map((l) => l.split(/\s{2,}|\t/).map((c) => c.trim())).filter((r) => r.some(Boolean));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows.length ? rows : [['']]), `Page ${i + 1}`);
    });
    onProgress(1);
    return {
      file: { name: replaceExt(file.name, 'xlsx'), blob: new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) },
      previewHtml: textPreview(pages.join('\n\n')),
    };
  }
  if (target === 'pptx') {
    const rendered = await renderPdfPages(file, settings.resolution, (d, t) => onProgress((d / t) * 0.6));
    const pptxgenjs = (await import('pptxgenjs')).default;
    const pptx = new pptxgenjs();
    for (let i = 0; i < rendered.length; i++) {
      const slide = pptx.addSlide();
      const b64 = await blobToBase64(await canvasToBlob(rendered[i].canvas, 'image/jpeg', settings.imageQuality));
      slide.addImage({ data: b64, x: 0, y: 0, w: '100%', h: '100%' });
      onProgress(0.6 + ((i + 1) / rendered.length) * 0.4);
    }
    return {
      file: { name: replaceExt(file.name, 'pptx'), blob: await pptx.write({ outputType: 'blob' }) as Blob },
      previewHtml: rendered[0] ? imagePreview(rendered[0].canvas) : undefined,
    };
  }
  if (target === 'jpg' || target === 'png' || target === 'webp') {
    const mime = target === 'jpg' ? 'image/jpeg' : target === 'png' ? 'image/png' : 'image/webp';
    const pages = await renderPdfPages(file, settings.resolution, (d, t) => onProgress((d / t) * 0.7));
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    for (let i = 0; i < pages.length; i++) {
      zip.file(`page-${i + 1}.${target}`, await canvasToBlob(pages[i].canvas, mime, settings.imageQuality));
      onProgress(0.7 + ((i + 1) / pages.length) * 0.3);
    }
    return {
      file: { name: replaceExt(file.name, 'zip'), blob: await zip.generateAsync({ type: 'blob' }) },
      previewHtml: pages[0] ? imagePreview(pages[0].canvas) : undefined,
    };
  }
  if (target === 'txt') {
    const { pages: rawPages } = await extractPdfTextSmart(file, (d, t) => onProgress((d / t) * 0.7));
    const pages = await repairBengaliPages(rawPages, onProgress);
    return { file: { name: replaceExt(file.name, 'txt'), blob: new Blob([pages.map((p, i) => `--- Page ${i + 1} ---\n${p}`).join('\n\n')], { type: 'text/plain' }) } };
  }
  if (target === 'md') {
    const { pages: rawPages } = await extractPdfTextSmart(file, (d, t) => onProgress((d / t) * 0.7));
    const pages = await repairBengaliPages(rawPages, onProgress);
    const md = pages.map((p, i) => `## Page ${i + 1}\n\n${p.split('\n').map((l) => { const t = l.trim(); if (!t) return ''; if (t.length < 60 && t === t.toUpperCase() && t.length > 3) return `### ${t}`; return t; }).join('\n')}`).join('\n\n---\n\n');
    return { file: { name: replaceExt(file.name, 'md'), blob: new Blob([md], { type: 'text/markdown' }) } };
  }
  if (target === 'html') {
    const { pages: rawPages } = await extractPdfTextSmart(file, (d, t) => onProgress((d / t) * 0.7));
    const pages = await repairBengaliPages(rawPages, onProgress);
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${file.name}</title><style>body{font-family:system-ui;max-width:900px;margin:40px auto;padding:20px;line-height:1.7;color:#333}.page{margin-bottom:2em;padding-bottom:1em;border-bottom:1px solid #eee}</style></head><body>${pages.map((p, i) => `<div class="page"><h2>Page ${i + 1}</h2>${p.split('\n').map((l) => `<p>${l || '&nbsp;'}</p>`).join('')}</div>`).join('')}</body></html>`;
    return { file: { name: replaceExt(file.name, 'html'), blob: new Blob([html], { type: 'text/html' }) } };
  }
  if (target === 'rtf') {
    const { pages: rawPages } = await extractPdfTextSmart(file, (d, t) => onProgress((d / t) * 0.7));
    const pages = await repairBengaliPages(rawPages, onProgress);
    const rtf = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Helvetica;}}\n${pages.map((p) => p.split('\n').map((l) => `\\f0\\fs22 ${l.replace(/[\\{}]/g, '\\$&')}\\par\n`).join('')).join('\\page\n')}}`;
    return { file: { name: replaceExt(file.name, 'rtf'), blob: new Blob([rtf], { type: 'application/rtf' }) } };
  }
  throw new Error(`Unsupported format: ${target}`);
}

async function generatePreview(blob: Blob, format: TargetFormat): Promise<string | undefined> {
  if (format === 'html') {
    const text = await blob.text();
    const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch ? `<div class="pdfconv-html-preview">${bodyMatch[1].slice(0, 3000)}</div>` : undefined;
  }
  if (format === 'txt' || format === 'md' || format === 'csv' || format === 'rtf') {
    const text = await blob.text();
    const escaped = text.slice(0, 2000).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return `<pre class="pdfconv-text-preview">${escaped}</pre>`;
  }
  return undefined;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((r) => { const rd = new FileReader(); rd.onloadend = () => r(rd.result as string); rd.readAsDataURL(blob); });
}
