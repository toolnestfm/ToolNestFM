'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

import { ErrorBox, useToolPhase, type ResultFile } from '../shared';
import { renderPdfPages } from '@/lib/pdf';
import { extractPdfTextSmart } from '@/lib/pdf-smart-text';
import { canvasToBlob } from '@/lib/image';
import { replaceExt, formatBytes } from '@/lib/download';
import { analyzeDocument, calculateConversionConfidence, buildPageStrategies, type DocumentStructure, type PageStrategy } from '@/lib/pdf-intelligence';
import Icon from '@/components/Icon';
import dynamic from 'next/dynamic';
import { looksBrokenBengali, restoreBengaliText } from '@/lib/text-restore';

const FabRail = dynamic(() => import('../FabRail'), { ssr: false });
const ShareModal = dynamic(() => import('../ShareModal'), { ssr: false });

// ─── Types ───────────────────────────────────────────────────────────────────

type TargetFormat = 'docx' | 'xlsx' | 'pptx' | 'txt' | 'html' | 'rtf' | 'jpg' | 'png' | 'webp' | 'csv' | 'md';
type ViewMode = 'upload' | 'analysis' | 'convert' | 'results' | 'diff' | 'compare';

interface ConversionResult {
  format: TargetFormat;
  file: ResultFile;
  confidence: number;
  previewHtml?: string;
}

const FORMAT_META: Record<TargetFormat, { label: string; icon: string; color: string; desc: string }> = {
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

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PdfConverterAdvanced() {
  const { phase, setPhase, error, fail, reset } = useToolPhase();
  const [file, setFile] = useState<File | null>(null);
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
  const [structureOpen, setStructureOpen] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── File Upload + Auto Analysis ────────────────────────────────────────

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setView('analysis');
    setAnalysisProgress(0);

    try {
      const doc = await analyzeDocument(f, (d, t) => setAnalysisProgress(d / t));
      setStructure(doc);
      setStrategies(buildPageStrategies(doc));

      // Pre-render first few pages for preview
      const pages = await renderPdfPages(f, 1.2, undefined);
      setPdfPages(pages.slice(0, 10).map((p) => p.canvas));

      setView('convert');
    } catch (e) {
      fail(e);
    }
  }, [fail]);

  // Paste support
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.files;
      if (items && items.length > 0 && items[0].type === 'application/pdf') {
        e.preventDefault();
        void handleFile(items[0]);
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [handleFile]);

  // ─── Conversion ──────────────────────────────────────────────────────────

  const convertToFormat = async (fmt: TargetFormat): Promise<ConversionResult> => {
    if (!file) throw new Error('No file');
    const result = await runConversion(file, fmt, (p) => setConvertProgress(p));
    const conf = structure ? calculateConversionConfidence(structure, fmt) : { overall: 80, perPage: [], issues: [] };
    const previewHtml = await generatePreview(result.blob, fmt);
    return { format: fmt, file: result, confidence: conf.overall, previewHtml };
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

  const resetAll = () => { reset(); setFile(null); setView('upload'); setStructure(null); setResults([]); setTargetFormat(null); setCompareFormats([]); setPdfPages([]); };

  // ─── Confidence Data ─────────────────────────────────────────────────────

  const confidenceData = useMemo(() => {
    if (!structure || !targetFormat) return null;
    return calculateConversionConfidence(structure, targetFormat);
  }, [structure, targetFormat]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: UPLOAD VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  if (view === 'upload') {
    return (
      <div className="pdfconv-layout">
        <FabRail
          toolSlug="pdf-converter"
          onFilesPasted={(fs) => { const f = fs[0]; if (f) void handleFile(f); }}
        />
        <div
          className={`pdfconv-dropzone ${dragOver ? 'drag-active' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) void handleFile(f); }}
          role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        >
          <div className="pdfconv-drop-icon"><Icon name="upload" size={32} /></div>
          <h3>Drop your PDF here</h3>
          <p>or <button className="pdfconv-browse-link" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>browse files</button> or paste from clipboard</p>
          <div className="pdfconv-format-badges">
            {ALL_TARGETS.map((f) => <span key={f}>{FORMAT_META[f].label}</span>)}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>AI-powered document intelligence &middot; Visual diff &middot; Confidence scoring</p>
        </div>
        <input ref={inputRef} type="file" hidden accept="application/pdf" onChange={(e) => { if (e.target.files?.[0]) void handleFile(e.target.files[0]); e.target.value = ''; }} />
        {phase === 'error' && <ErrorBox message={error} onRetry={reset} />}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: ANALYSIS IN PROGRESS
  // ═══════════════════════════════════════════════════════════════════════════

  if (view === 'analysis') {
    return (
      <div className="pdfconv-processing">
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
  // RENDER: PROCESSING
  // ═══════════════════════════════════════════════════════════════════════════

  if (phase === 'working') {
    return (
      <div className="pdfconv-processing">
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
        <div className="pdfconv-results-header">
          <div className="pdfconv-results-badge"><Icon name="check-circle" size={18} /> Conversion Complete</div>
          <div className={`pdfconv-confidence-badge ${r.confidence >= 80 ? 'high' : r.confidence >= 50 ? 'mid' : 'low'}`}>
            <Icon name="sparkles" size={13} /> {r.confidence}% Confidence
          </div>
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
        <FabRail file={r.file} toolSlug="pdf-converter" />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: MAIN CONVERSION VIEW (with structure + format selection)
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="pdfconv-main-view">
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

async function runConversion(file: File, target: TargetFormat, onProgress: (p: number) => void): Promise<ResultFile> {
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
    return { name: replaceExt(file.name, 'docx'), blob: await Packer.toBlob(new Document({ sections: [{ children }] })) };
  }
  if (target === 'xlsx' || target === 'csv') {
    const { pages } = await extractPdfTextSmart(file, (d, t) => onProgress((d / t) * 0.7));
    if (target === 'csv') {
      const csv = pages.flatMap((p) => p.split('\n').filter(Boolean).map((l) => l.split(/\s{2,}|\t/).map((c) => c.includes(',') ? `"${c.trim()}"` : c.trim()).join(','))).join('\n');
      onProgress(1);
      return { name: replaceExt(file.name, 'csv'), blob: new Blob([csv], { type: 'text/csv' }) };
    }
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    pages.forEach((pt, i) => {
      const rows = pt.split('\n').map((l) => l.split(/\s{2,}|\t/).map((c) => c.trim())).filter((r) => r.some(Boolean));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows.length ? rows : [['']]), `Page ${i + 1}`);
    });
    onProgress(1);
    return { name: replaceExt(file.name, 'xlsx'), blob: new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) };
  }
  if (target === 'pptx') {
    const rendered = await renderPdfPages(file, 2, (d, t) => onProgress((d / t) * 0.6));
    const pptxgenjs = (await import('pptxgenjs')).default;
    const pptx = new pptxgenjs();
    for (let i = 0; i < rendered.length; i++) {
      const slide = pptx.addSlide();
      const b64 = await blobToBase64(await canvasToBlob(rendered[i].canvas, 'image/png'));
      slide.addImage({ data: b64, x: 0, y: 0, w: '100%', h: '100%' });
      onProgress(0.6 + ((i + 1) / rendered.length) * 0.4);
    }
    return { name: replaceExt(file.name, 'pptx'), blob: await pptx.write({ outputType: 'blob' }) as Blob };
  }
  if (target === 'jpg' || target === 'png' || target === 'webp') {
    const mime = target === 'jpg' ? 'image/jpeg' : target === 'png' ? 'image/png' : 'image/webp';
    const pages = await renderPdfPages(file, 2, (d, t) => onProgress((d / t) * 0.7));
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    for (let i = 0; i < pages.length; i++) {
      zip.file(`page-${i + 1}.${target}`, await canvasToBlob(pages[i].canvas, mime, 0.9));
      onProgress(0.7 + ((i + 1) / pages.length) * 0.3);
    }
    return { name: replaceExt(file.name, 'zip'), blob: await zip.generateAsync({ type: 'blob' }) };
  }
  if (target === 'txt') {
    const { pages: rawPages } = await extractPdfTextSmart(file, (d, t) => onProgress((d / t) * 0.7));
    const pages = await repairBengaliPages(rawPages, onProgress);
    return { name: replaceExt(file.name, 'txt'), blob: new Blob([pages.map((p, i) => `--- Page ${i + 1} ---\n${p}`).join('\n\n')], { type: 'text/plain' }) };
  }
  if (target === 'md') {
    const { pages: rawPages } = await extractPdfTextSmart(file, (d, t) => onProgress((d / t) * 0.7));
    const pages = await repairBengaliPages(rawPages, onProgress);
    const md = pages.map((p, i) => `## Page ${i + 1}\n\n${p.split('\n').map((l) => { const t = l.trim(); if (!t) return ''; if (t.length < 60 && t === t.toUpperCase() && t.length > 3) return `### ${t}`; return t; }).join('\n')}`).join('\n\n---\n\n');
    return { name: replaceExt(file.name, 'md'), blob: new Blob([md], { type: 'text/markdown' }) };
  }
  if (target === 'html') {
    const { pages: rawPages } = await extractPdfTextSmart(file, (d, t) => onProgress((d / t) * 0.7));
    const pages = await repairBengaliPages(rawPages, onProgress);
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${file.name}</title><style>body{font-family:system-ui;max-width:900px;margin:40px auto;padding:20px;line-height:1.7;color:#333}.page{margin-bottom:2em;padding-bottom:1em;border-bottom:1px solid #eee}</style></head><body>${pages.map((p, i) => `<div class="page"><h2>Page ${i + 1}</h2>${p.split('\n').map((l) => `<p>${l || '&nbsp;'}</p>`).join('')}</div>`).join('')}</body></html>`;
    return { name: replaceExt(file.name, 'html'), blob: new Blob([html], { type: 'text/html' }) };
  }
  if (target === 'rtf') {
    const { pages: rawPages } = await extractPdfTextSmart(file, (d, t) => onProgress((d / t) * 0.7));
    const pages = await repairBengaliPages(rawPages, onProgress);
    const rtf = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Helvetica;}}\n${pages.map((p) => p.split('\n').map((l) => `\\f0\\fs22 ${l.replace(/[\\{}]/g, '\\$&')}\\par\n`).join('')).join('\\page\n')}}`;
    return { name: replaceExt(file.name, 'rtf'), blob: new Blob([rtf], { type: 'application/rtf' }) };
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
