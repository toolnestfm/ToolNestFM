'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Tool } from '@/data/tools';
import { Processing, ErrorBox, useToolPhase, type ResultFile } from '../shared';
import { extractPdfText, renderPdfPages, loadPdfJs } from '@/lib/pdf';
import { canvasToBlob } from '@/lib/image';
import { replaceExt, formatBytes } from '@/lib/download';
import Icon from '@/components/Icon';

// ─── Types ───────────────────────────────────────────────────────────────────

type SourceFormat = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'pptx' | 'jpg' | 'png' | 'txt' | 'html' | 'md' | 'unknown';
type TargetFormat = 'docx' | 'xlsx' | 'pptx' | 'txt' | 'html' | 'rtf' | 'jpg' | 'png' | 'webp' | 'csv' | 'md' | 'pdf';

interface ConversionFile {
  id: string;
  file: File;
  format: SourceFormat;
  pageCount?: number;
  thumbnail?: string;
  status: 'pending' | 'converting' | 'done' | 'error';
  progress: number;
  result?: ResultFile;
  error?: string;
}

interface AdvancedOptions {
  pageRange: string;
  dpi: 72 | 150 | 300 | 600;
  preserveLayout: boolean;
  preserveImages: boolean;
  preserveFonts: boolean;
  enableOcr: boolean;
  imageQuality: number;
  outputMode: 'individual' | 'zip';
  pageSize: 'a4' | 'letter' | 'auto';
  orientation: 'portrait' | 'landscape';
  margins: 'none' | 'normal' | 'wide';
}

interface PreviewState {
  visible: boolean;
  pages: HTMLCanvasElement[];
  currentPage: number;
  zoom: number;
  rotation: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FORMAT_META: Record<TargetFormat, { label: string; icon: string; color: string; desc: string }> = {
  docx: { label: 'Word', icon: 'file-text', color: '#2b579a', desc: 'Editable Word document' },
  xlsx: { label: 'Excel', icon: 'table', color: '#217346', desc: 'Spreadsheet with tables' },
  pptx: { label: 'PowerPoint', icon: 'presentation', color: '#d24726', desc: 'Slide presentation' },
  txt: { label: 'Text', icon: 'type', color: '#6b7280', desc: 'Plain text extraction' },
  html: { label: 'HTML', icon: 'code', color: '#e34c26', desc: 'Web page format' },
  rtf: { label: 'RTF', icon: 'file-text', color: '#5b21b6', desc: 'Rich text format' },
  jpg: { label: 'JPG', icon: 'image', color: '#059669', desc: 'Image per page' },
  png: { label: 'PNG', icon: 'image', color: '#0891b2', desc: 'Lossless image' },
  webp: { label: 'WebP', icon: 'image', color: '#7c3aed', desc: 'Modern web image' },
  csv: { label: 'CSV', icon: 'table', color: '#ca8a04', desc: 'Comma-separated data' },
  md: { label: 'Markdown', icon: 'type', color: '#1e40af', desc: 'Markdown text' },
  pdf: { label: 'PDF', icon: 'file-text', color: '#dc2626', desc: 'PDF document' },
};

const PDF_TARGETS: TargetFormat[] = ['docx', 'xlsx', 'pptx', 'txt', 'html', 'rtf', 'jpg', 'png', 'webp', 'csv', 'md'];

const DEFAULT_OPTIONS: AdvancedOptions = {
  pageRange: '',
  dpi: 150,
  preserveLayout: true,
  preserveImages: true,
  preserveFonts: true,
  enableOcr: false,
  imageQuality: 85,
  outputMode: 'individual',
  pageSize: 'a4',
  orientation: 'portrait',
  margins: 'normal',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectFormat(file: File): SourceFormat {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const mime = file.type;
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.includes('wordprocessingml') || ext === 'docx') return 'docx';
  if (mime.includes('spreadsheetml') || ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'csv' || mime === 'text/csv') return 'csv';
  if (mime.includes('presentationml') || ext === 'pptx') return 'pptx';
  if (mime === 'image/jpeg' || ext === 'jpg' || ext === 'jpeg') return 'jpg';
  if (mime === 'image/png' || ext === 'png') return 'png';
  if (mime === 'text/plain' || ext === 'txt') return 'txt';
  if (mime === 'text/html' || ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'md' || ext === 'markdown') return 'md';
  return 'unknown';
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

function getAiRecommendation(pageCount: number | undefined, fileSize: number): { format: TargetFormat; reason: string } {
  if (fileSize > 10 * 1024 * 1024) return { format: 'txt', reason: 'Large file - text extraction is fastest' };
  if (pageCount && pageCount > 50) return { format: 'docx', reason: 'Multi-page document - Word preserves structure' };
  if (pageCount && pageCount <= 3) return { format: 'png', reason: 'Short document - high-quality images recommended' };
  return { format: 'docx', reason: 'Word is the most versatile format for editing' };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PdfConverterAdvanced({ tool }: { tool: Tool }) {
  const { phase, setPhase, error, fail, reset } = useToolPhase();
  const [files, setFiles] = useState<ConversionFile[]>([]);
  const [targetFormat, setTargetFormat] = useState<TargetFormat | null>(null);
  const [options, setOptions] = useState<AdvancedOptions>(DEFAULT_OPTIONS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [preview, setPreview] = useState<PreviewState>({ visible: false, pages: [], currentPage: 0, zoom: 1, rotation: 0 });
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [conversionHistory, setConversionHistory] = useState<{ name: string; format: string; time: number; size: number }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  const totalPages = useMemo(() => files.reduce((s, f) => s + (f.pageCount || 0), 0), [files]);
  const aiRec = useMemo(() => {
    if (files.length === 0) return null;
    return getAiRecommendation(totalPages, files.reduce((s, f) => s + f.file.size, 0));
  }, [files, totalPages]);

  // ─── File Handling ───────────────────────────────────────────────────────

  const addFiles = useCallback(async (incoming: File[]) => {
    const newFiles: ConversionFile[] = incoming.map((f) => ({
      id: generateId(),
      file: f,
      format: detectFormat(f),
      status: 'pending' as const,
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    for (const cf of newFiles) {
      if (cf.format === 'pdf') {
        try {
          const pdfjs = await loadPdfJs();
          const data = await cf.file.arrayBuffer();
          const doc = await pdfjs.getDocument({ data }).promise;
          const pageCount = doc.numPages;
          const page = await doc.getPage(1);
          const vp = page.getViewport({ scale: 0.3 });
          const canvas = document.createElement('canvas');
          canvas.width = vp.width;
          canvas.height = vp.height;
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
          const thumb = canvas.toDataURL('image/jpeg', 0.6);
          setFiles((prev) => prev.map((f) => f.id === cf.id ? { ...f, pageCount, thumbnail: thumb } : f));
        } catch { /* ignore thumbnail errors */ }
      }
    }
  }, []);

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  // Paste support
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.files;
      if (items && items.length > 0) {
        e.preventDefault();
        void addFiles(Array.from(items));
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [addFiles]);

  // ─── PDF Preview ─────────────────────────────────────────────────────────

  const openPreview = async (cf: ConversionFile) => {
    if (cf.format !== 'pdf') return;
    try {
      const pages = await renderPdfPages(cf.file, 1.5);
      setPreview({ visible: true, pages: pages.map((p) => p.canvas), currentPage: 0, zoom: 1, rotation: 0 });
    } catch { /* ignore */ }
  };

  // ─── Conversion Logic ────────────────────────────────────────────────────

  const convert = async () => {
    if (!files.length || !targetFormat) return;
    setPhase('working');
    setBatchProgress({ done: 0, total: files.length });

    const updatedFiles = [...files];

    for (let i = 0; i < updatedFiles.length; i++) {
      const cf = updatedFiles[i];
      updatedFiles[i] = { ...cf, status: 'converting', progress: 0 };
      setFiles([...updatedFiles]);

      try {
        const result = await convertSingle(cf.file, cf.format, targetFormat, options, (p) => {
          updatedFiles[i] = { ...updatedFiles[i], progress: p };
          setFiles([...updatedFiles]);
        });
        updatedFiles[i] = { ...updatedFiles[i], status: 'done', progress: 1, result };
        setConversionHistory((prev) => [{ name: result.name, format: targetFormat, time: Date.now(), size: result.blob.size }, ...prev].slice(0, 20));
      } catch (e) {
        updatedFiles[i] = { ...updatedFiles[i], status: 'error', error: e instanceof Error ? e.message : 'Conversion failed' };
      }

      setBatchProgress({ done: i + 1, total: files.length });
      setFiles([...updatedFiles]);
    }

    setPhase('done');
  };

  // ─── Download ────────────────────────────────────────────────────────────

  const downloadFile = (rf: ResultFile) => {
    const url = URL.createObjectURL(rf.blob);
    const a = document.createElement('a');
    a.href = url; a.download = rf.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const downloadAll = async () => {
    const completed = files.filter((f) => f.result);
    if (completed.length <= 1) {
      if (completed[0]?.result) downloadFile(completed[0].result);
      return;
    }
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    for (const f of completed) {
      if (f.result) zip.file(f.result.name, f.result.blob);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadFile({ name: 'converted-files.zip', blob });
  };

  const resetAll = () => {
    reset();
    setFiles([]);
    setTargetFormat(null);
    setOptions(DEFAULT_OPTIONS);
    setShowAdvanced(false);
    setPreview({ visible: false, pages: [], currentPage: 0, zoom: 1, rotation: 0 });
    setBatchProgress({ done: 0, total: 0 });
  };

  // ─── Render: Preview Modal ───────────────────────────────────────────────

  if (preview.visible) {
    const page = preview.pages[preview.currentPage];
    return (
      <div className="pdf-preview-modal">
        <div className="pdf-preview-toolbar">
          <div className="pdf-preview-nav">
            <button className="btn btn-ghost btn-sm" disabled={preview.currentPage === 0} onClick={() => setPreview((p) => ({ ...p, currentPage: p.currentPage - 1 }))}>
              <Icon name="chevron-left" size={16} />
            </button>
            <span className="mono">{preview.currentPage + 1} / {preview.pages.length}</span>
            <button className="btn btn-ghost btn-sm" disabled={preview.currentPage >= preview.pages.length - 1} onClick={() => setPreview((p) => ({ ...p, currentPage: p.currentPage + 1 }))}>
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
          <div className="pdf-preview-controls">
            <button className="btn btn-ghost btn-sm" onClick={() => setPreview((p) => ({ ...p, zoom: Math.max(0.5, p.zoom - 0.25) }))}>
              <Icon name="minus" size={14} />
            </button>
            <span className="mono">{Math.round(preview.zoom * 100)}%</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPreview((p) => ({ ...p, zoom: Math.min(3, p.zoom + 0.25) }))}>
              <Icon name="plus" size={14} />
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setPreview((p) => ({ ...p, rotation: (p.rotation + 90) % 360 }))}>
              <Icon name="rotate" size={14} />
            </button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setPreview((p) => ({ ...p, visible: false }))}>
            <Icon name="x" size={16} /> Close
          </button>
        </div>
        <div className="pdf-preview-canvas-wrap">
          {page && (
            <canvas
              ref={(el) => {
                if (el && page) {
                  el.width = page.width;
                  el.height = page.height;
                  el.getContext('2d')?.drawImage(page, 0, 0);
                }
              }}
              style={{ transform: `scale(${preview.zoom}) rotate(${preview.rotation}deg)`, maxWidth: '100%', transition: 'transform 0.2s' }}
            />
          )}
        </div>
      </div>
    );
  }

  // ─── Render: Processing ──────────────────────────────────────────────────

  if (phase === 'working') {
    const pct = batchProgress.total > 0 ? batchProgress.done / batchProgress.total : 0;
    const currentFile = files.find((f) => f.status === 'converting');
    return (
      <div className="pdfconv-processing">
        <div className="pdfconv-progress-ring-wrap">
          <svg className="pdfconv-progress-ring" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border-subtle)" strokeWidth="8" />
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--brand-primary)" strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 52}`}
              strokeDashoffset={`${2 * Math.PI * 52 * (1 - pct)}`}
              strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.3s', transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
          </svg>
          <div className="pdfconv-progress-text">
            <b>{Math.round(pct * 100)}%</b>
            <span>{batchProgress.done}/{batchProgress.total} files</span>
          </div>
        </div>
        <h3 style={{ marginTop: 20 }}>Converting{currentFile ? `: ${currentFile.file.name}` : '...'}</h3>
        <p className="muted">Processing your files. This may take a moment for large documents.</p>
        {files.length > 1 && (
          <div className="pdfconv-batch-list">
            {files.map((f) => (
              <div key={f.id} className={`pdfconv-batch-item ${f.status}`}>
                <Icon name={f.status === 'done' ? 'check-circle' : f.status === 'error' ? 'x' : 'file-text'} size={14} />
                <span>{f.file.name}</span>
                {f.status === 'converting' && <span className="mono muted">{Math.round(f.progress * 100)}%</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Results ─────────────────────────────────────────────────────

  if (phase === 'done') {
    const completed = files.filter((f) => f.result);
    const failed = files.filter((f) => f.status === 'error');
    const totalBefore = files.reduce((s, f) => s + f.file.size, 0);
    const totalAfter = completed.reduce((s, f) => s + (f.result?.blob.size || 0), 0);

    return (
      <div className="pdfconv-results">
        <div className="pdfconv-results-header">
          <div className="pdfconv-results-badge">
            <Icon name="check-circle" size={20} />
            <span>{completed.length} file{completed.length !== 1 ? 's' : ''} converted successfully</span>
          </div>
          {failed.length > 0 && (
            <div className="pdfconv-results-badge error">
              <Icon name="x" size={16} />
              <span>{failed.length} failed</span>
            </div>
          )}
        </div>

        <div className="pdfconv-size-compare">
          <span>Input: {formatBytes(totalBefore)}</span>
          <Icon name="chevron-right" size={14} />
          <span>Output: <b>{formatBytes(totalAfter)}</b></span>
        </div>

        <div className="pdfconv-result-files">
          {files.map((f) => (
            <div key={f.id} className={`pdfconv-result-card ${f.status}`}>
              <div className="pdfconv-result-icon" style={{ background: targetFormat ? FORMAT_META[targetFormat].color + '22' : undefined, color: targetFormat ? FORMAT_META[targetFormat].color : undefined }}>
                <Icon name={targetFormat ? FORMAT_META[targetFormat].icon : 'file-text'} size={20} />
              </div>
              <div className="pdfconv-result-info">
                <b>{f.result?.name || f.file.name}</b>
                <span className="muted">{f.result ? formatBytes(f.result.blob.size) : f.error || 'Failed'}</span>
              </div>
              {f.result && (
                <button className="btn btn-primary btn-sm" onClick={() => downloadFile(f.result!)}>
                  <Icon name="download" size={14} /> Download
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="pdfconv-result-actions">
          {completed.length > 1 && (
            <button className="btn btn-primary" onClick={() => void downloadAll()}>
              <Icon name="download" size={16} /> Download All as ZIP
            </button>
          )}
          <button className="btn btn-outline" onClick={() => { setPhase('idle'); setFiles((prev) => prev.map((f) => ({ ...f, status: 'pending' as const, progress: 0, result: undefined, error: undefined }))); setTargetFormat(null); }}>
            <Icon name="refresh" size={15} /> Convert to Another Format
          </button>
          <button className="btn btn-ghost" onClick={resetAll}>
            <Icon name="upload" size={15} /> New Conversion
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Main Interface ──────────────────────────────────────────────

  return (
    <div className="pdfconv-layout">
      {/* Upload Area */}
      <div className="pdfconv-upload-section">
        <div
          ref={dropzoneRef}
          className={`pdfconv-dropzone ${dragOver ? 'drag-active' : ''} ${files.length > 0 ? 'has-files' : ''}`}
          onClick={() => !files.length && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void addFiles(Array.from(e.dataTransfer.files)); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        >
          {files.length === 0 ? (
            <>
              <div className="pdfconv-drop-icon">
                <Icon name="upload" size={32} />
              </div>
              <h3>Drop your PDF files here</h3>
              <p>or <button className="pdfconv-browse-link" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>browse files</button> or paste from clipboard</p>
              <div className="pdfconv-format-badges">
                <span>PDF</span><span>DOCX</span><span>XLSX</span><span>JPG</span><span>PNG</span><span>TXT</span><span>HTML</span>
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Up to 25MB free &middot; 2GB for Pro &middot; 100% browser-based</p>
            </>
          ) : (
            <div className="pdfconv-file-list">
              {files.map((cf) => (
                <div key={cf.id} className="pdfconv-file-card">
                  {cf.thumbnail ? (
                    <img src={cf.thumbnail} alt="" className="pdfconv-file-thumb" onClick={() => void openPreview(cf)} />
                  ) : (
                    <div className="pdfconv-file-thumb-placeholder">
                      <Icon name="file-text" size={20} />
                    </div>
                  )}
                  <div className="pdfconv-file-meta">
                    <b>{cf.file.name}</b>
                    <span className="muted">{formatBytes(cf.file.size)}{cf.pageCount ? ` \u00B7 ${cf.pageCount} pages` : ''}</span>
                  </div>
                  <div className="pdfconv-file-actions">
                    {cf.format === 'pdf' && cf.pageCount && (
                      <button className="btn btn-ghost btn-sm" onClick={() => void openPreview(cf)} title="Preview">
                        <Icon name="eye" size={14} />
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => removeFile(cf.id)} title="Remove">
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                </div>
              ))}
              <button className="pdfconv-add-more" onClick={() => inputRef.current?.click()}>
                <Icon name="plus" size={16} /> Add more files
              </button>
            </div>
          )}
        </div>
        <input ref={inputRef} type="file" hidden accept={tool.accept} multiple onChange={(e) => { if (e.target.files) void addFiles(Array.from(e.target.files)); e.target.value = ''; }} />
      </div>

      {/* Conversion Panel */}
      {files.length > 0 && (
        <div className="pdfconv-panel">
          {/* AI Recommendation */}
          {aiRec && !targetFormat && (
            <div className="pdfconv-ai-rec" onClick={() => setTargetFormat(aiRec.format)}>
              <Icon name="sparkles" size={16} />
              <span><b>AI recommends: {FORMAT_META[aiRec.format].label}</b> &mdash; {aiRec.reason}</span>
              <Icon name="chevron-right" size={14} />
            </div>
          )}

          {/* Format Selection */}
          <div className="pdfconv-format-section">
            <h3>Convert to</h3>
            <div className="pdfconv-format-grid">
              {PDF_TARGETS.map((fmt) => (
                <button
                  key={fmt}
                  className={`pdfconv-format-btn ${targetFormat === fmt ? 'active' : ''}`}
                  onClick={() => setTargetFormat(fmt)}
                >
                  <div className="pdfconv-fmt-icon" style={{ background: FORMAT_META[fmt].color + '18', color: FORMAT_META[fmt].color }}>
                    <Icon name={FORMAT_META[fmt].icon} size={18} />
                  </div>
                  <div className="pdfconv-fmt-info">
                    <b>{FORMAT_META[fmt].label}</b>
                    <span>{FORMAT_META[fmt].desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Options */}
          {targetFormat && (
            <div className="pdfconv-options-section">
              <h3>Options</h3>

              {(targetFormat === 'jpg' || targetFormat === 'png' || targetFormat === 'webp') && (
                <div className="pdfconv-opt-row">
                  <label>Resolution (DPI)</label>
                  <select value={options.dpi} onChange={(e) => setOptions((o) => ({ ...o, dpi: +e.target.value as AdvancedOptions['dpi'] }))}>
                    <option value={72}>72 DPI (web)</option>
                    <option value={150}>150 DPI (standard)</option>
                    <option value={300}>300 DPI (print)</option>
                    <option value={600}>600 DPI (ultra)</option>
                  </select>
                </div>
              )}

              {(targetFormat === 'jpg' || targetFormat === 'webp') && (
                <div className="pdfconv-opt-row">
                  <label>Quality: {options.imageQuality}%</label>
                  <input type="range" min={30} max={100} value={options.imageQuality} onChange={(e) => setOptions((o) => ({ ...o, imageQuality: +e.target.value }))} />
                </div>
              )}

              {(targetFormat === 'docx' || targetFormat === 'rtf') && (
                <>
                  <label className="pdfconv-toggle"><input type="checkbox" checked={options.preserveLayout} onChange={(e) => setOptions((o) => ({ ...o, preserveLayout: e.target.checked }))} /> Preserve layout</label>
                  <label className="pdfconv-toggle"><input type="checkbox" checked={options.preserveImages} onChange={(e) => setOptions((o) => ({ ...o, preserveImages: e.target.checked }))} /> Preserve images</label>
                </>
              )}

              {(targetFormat === 'xlsx' || targetFormat === 'csv') && (
                <label className="pdfconv-toggle"><input type="checkbox" checked={options.enableOcr} onChange={(e) => setOptions((o) => ({ ...o, enableOcr: e.target.checked }))} /> Enable AI table detection</label>
              )}

              {files.length > 1 && (targetFormat === 'jpg' || targetFormat === 'png' || targetFormat === 'webp') && (
                <div className="pdfconv-opt-row">
                  <label>Output</label>
                  <select value={options.outputMode} onChange={(e) => setOptions((o) => ({ ...o, outputMode: e.target.value as 'individual' | 'zip' }))}>
                    <option value="individual">Individual files</option>
                    <option value="zip">ZIP archive</option>
                  </select>
                </div>
              )}

              {/* Advanced toggle */}
              <button className="pdfconv-advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
                <Icon name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={14} />
                Advanced Settings
              </button>

              {showAdvanced && (
                <div className="pdfconv-advanced-panel">
                  <div className="pdfconv-opt-row">
                    <label>Page range</label>
                    <input placeholder="e.g. 1-5, 8, 10-12 (all pages if empty)" value={options.pageRange} onChange={(e) => setOptions((o) => ({ ...o, pageRange: e.target.value }))} />
                  </div>
                  <div className="pdfconv-opt-row">
                    <label>Page size</label>
                    <select value={options.pageSize} onChange={(e) => setOptions((o) => ({ ...o, pageSize: e.target.value as AdvancedOptions['pageSize'] }))}>
                      <option value="a4">A4</option>
                      <option value="letter">Letter (US)</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>
                  <label className="pdfconv-toggle"><input type="checkbox" checked={options.enableOcr} onChange={(e) => setOptions((o) => ({ ...o, enableOcr: e.target.checked }))} /> Enable OCR (scanned PDFs)</label>
                </div>
              )}
            </div>
          )}

          {/* Convert Button */}
          <button
            className="btn btn-primary pdfconv-convert-btn"
            disabled={!targetFormat || files.length === 0}
            onClick={() => void convert()}
          >
            <Icon name="zap" size={18} />
            {targetFormat ? `Convert ${files.length > 1 ? `${files.length} files` : ''} to ${FORMAT_META[targetFormat].label}` : 'Select a format'}
          </button>

          <p className="pdfconv-privacy-note">
            <Icon name="lock" size={12} /> Files are processed 100% in your browser. Nothing is uploaded to any server.
          </p>

          {phase === 'error' && <ErrorBox message={error} onRetry={reset} />}
        </div>
      )}

      {/* Conversion History */}
      {conversionHistory.length > 0 && phase === 'idle' && (
        <div className="pdfconv-history">
          <h4>Recent Conversions</h4>
          {conversionHistory.slice(0, 5).map((h, i) => (
            <div key={i} className="pdfconv-history-item">
              <Icon name="check-circle" size={13} />
              <span>{h.name}</span>
              <span className="muted">{formatBytes(h.size)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Conversion Engine ───────────────────────────────────────────────────────

async function convertSingle(
  file: File,
  sourceFormat: SourceFormat,
  target: TargetFormat,
  opts: AdvancedOptions,
  onProgress: (p: number) => void,
): Promise<ResultFile> {
  const isPdf = sourceFormat === 'pdf';

  if (isPdf && target === 'docx') {
    const pages = await extractPdfText(file, (d, t) => onProgress((d / t) * 0.7));
    const { Document, Packer, Paragraph, TextRun, PageBreak } = await import('docx');
    const children = pages.flatMap((pageText, pi) => {
      const paras = pageText.split('\n').filter(Boolean).map(
        (line) => new Paragraph({ children: [new TextRun({ text: line, size: 22 })], spacing: { after: 120 } }),
      );
      if (pi < pages.length - 1) paras.push(new Paragraph({ children: [new PageBreak()] }));
      return paras;
    });
    const doc = new Document({ sections: [{ children }] });
    onProgress(1);
    return { name: replaceExt(file.name, 'docx'), blob: await Packer.toBlob(doc) };
  }

  if (isPdf && target === 'xlsx') {
    const pages = await extractPdfText(file, (d, t) => onProgress((d / t) * 0.7));
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    pages.forEach((pageText, i) => {
      const rows = pageText.split('\n').map((l) => l.split(/\s{2,}|\t/).map((c) => c.trim())).filter((r) => r.some(Boolean));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows.length ? rows : [['']]), `Page ${i + 1}`);
    });
    onProgress(1);
    return { name: replaceExt(file.name, 'xlsx'), blob: new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) };
  }

  if (isPdf && target === 'csv') {
    const pages = await extractPdfText(file, (d, t) => onProgress(d / t));
    const csv = pages.flatMap((p) => p.split('\n').filter(Boolean).map((l) => l.split(/\s{2,}|\t/).map((c) => c.includes(',') ? `"${c.trim()}"` : c.trim()).join(','))).join('\n');
    return { name: replaceExt(file.name, 'csv'), blob: new Blob([csv], { type: 'text/csv' }) };
  }

  if (isPdf && target === 'pptx') {
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

  if (isPdf && (target === 'jpg' || target === 'png' || target === 'webp')) {
    const scale = opts.dpi === 72 ? 1 : opts.dpi === 150 ? 2 : opts.dpi === 300 ? 4 : 6;
    const mime = target === 'jpg' ? 'image/jpeg' : target === 'png' ? 'image/png' : 'image/webp';
    const pages = await renderPdfPages(file, scale, (d, t) => onProgress((d / t) * 0.7));
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    for (let i = 0; i < pages.length; i++) {
      zip.file(`page-${i + 1}.${target}`, await canvasToBlob(pages[i].canvas, mime, opts.imageQuality / 100));
      onProgress(0.7 + ((i + 1) / pages.length) * 0.3);
    }
    return { name: replaceExt(file.name, 'zip'), blob: await zip.generateAsync({ type: 'blob' }) };
  }

  if (isPdf && target === 'txt') {
    const pages = await extractPdfText(file, (d, t) => onProgress(d / t));
    const text = pages.map((p, i) => `--- Page ${i + 1} ---\n${p}`).join('\n\n');
    return { name: replaceExt(file.name, 'txt'), blob: new Blob([text], { type: 'text/plain' }) };
  }

  if (isPdf && target === 'md') {
    const pages = await extractPdfText(file, (d, t) => onProgress(d / t));
    const md = pages.map((p, i) => {
      const lines = p.split('\n').map((l) => {
        const t = l.trim();
        if (!t) return '';
        if (t.length < 60 && t === t.toUpperCase() && t.length > 3) return `## ${t}`;
        return t;
      }).join('\n');
      return `---\n### Page ${i + 1}\n\n${lines}`;
    }).join('\n\n');
    return { name: replaceExt(file.name, 'md'), blob: new Blob([md], { type: 'text/markdown' }) };
  }

  if (isPdf && target === 'html') {
    const pages = await extractPdfText(file, (d, t) => onProgress(d / t));
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${file.name}</title><style>body{font-family:system-ui;max-width:900px;margin:40px auto;padding:20px;line-height:1.7}.page{margin-bottom:2em;padding-bottom:1em;border-bottom:1px solid #ddd}</style></head><body>${pages.map((p, i) => `<div class="page"><h2>Page ${i + 1}</h2>${p.split('\n').map((l) => `<p>${l || '&nbsp;'}</p>`).join('')}</div>`).join('')}</body></html>`;
    return { name: replaceExt(file.name, 'html'), blob: new Blob([html], { type: 'text/html' }) };
  }

  if (isPdf && target === 'rtf') {
    const pages = await extractPdfText(file, (d, t) => onProgress(d / t));
    const rtfContent = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Helvetica;}}\n${pages.map((p) => p.split('\n').map((l) => `\\f0\\fs22 ${l.replace(/[\\{}]/g, '\\$&')}\\par\n`).join('')).join('\\page\n')}}`;
    return { name: replaceExt(file.name, 'rtf'), blob: new Blob([rtfContent], { type: 'application/rtf' }) };
  }

  if (!isPdf && target === 'pdf') {
    onProgress(0.3);
    const { PDFDocument, StandardFonts } = await import('@cantoo/pdf-lib');
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    if (sourceFormat === 'jpg' || sourceFormat === 'png') {
      const bytes = await file.arrayBuffer();
      const embedded = sourceFormat === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const page = doc.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
    } else {
      let text = '';
      if (sourceFormat === 'docx') {
        const mammoth = await import('mammoth');
        text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
      } else {
        text = await file.text();
      }
      const fs = 11; const lh = 15; const m = 50;
      const pw = 595.28; const ph = 841.89; const mw = pw - m * 2;
      const lines: string[] = [];
      for (const para of text.split('\n')) {
        if (!para.trim()) { lines.push(''); continue; }
        let cur = '';
        for (const word of para.split(/\s+/)) {
          const safe = word.replace(/[^\x20-\x7E]/g, '?');
          const attempt = cur ? `${cur} ${safe}` : safe;
          if (font.widthOfTextAtSize(attempt, fs) > mw && cur) { lines.push(cur); cur = safe; } else cur = attempt;
        }
        if (cur) lines.push(cur);
      }
      let page = doc.addPage([pw, ph]); let y = ph - m;
      for (const line of lines) {
        if (y < m) { page = doc.addPage([pw, ph]); y = ph - m; }
        if (line) page.drawText(line, { x: m, y, size: fs, font });
        y -= lh;
      }
    }
    onProgress(1);
    return { name: replaceExt(file.name, 'pdf'), blob: new Blob([new Uint8Array(await doc.save())], { type: 'application/pdf' }) };
  }

  throw new Error(`Conversion from ${sourceFormat.toUpperCase()} to ${target.toUpperCase()} is not supported yet.`);
}
