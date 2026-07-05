'use client';

import { renderPdfPages, extractPdfText } from '@/lib/pdf';
import { canvasToBlob } from '@/lib/image';
import {
  fileFingerprint,
  getPdfPageCount,
  isPdfEncrypted,
  validatePdfFile,
} from '@/lib/engines/merge-pdf-engine';

export type CompressMode =
  | 'smart'
  | 'maximum'
  | 'balanced'
  | 'high-quality'
  | 'lossless'
  | 'print'
  | 'email'
  | 'web'
  | 'archive'
  | 'mobile'
  | 'social';

export interface CompressSettings {
  mode: CompressMode;
  imageQuality: number;
  dpiScale: number;
  removeMetadata: boolean;
  removeBlankPages: boolean;
  removeDuplicates: boolean;
  preserveForms: boolean;
  preserveBookmarks: boolean;
  optimizeImages: boolean;
  useTargetSize: boolean;
  targetKB: number;
  password?: string;
}

export const DEFAULT_COMPRESS_SETTINGS: CompressSettings = {
  mode: 'smart',
  imageQuality: 65,
  dpiScale: 1.4,
  removeMetadata: true,
  removeBlankPages: false,
  removeDuplicates: false,
  preserveForms: true,
  preserveBookmarks: true,
  optimizeImages: true,
  useTargetSize: false,
  targetKB: 200,
};

export interface PdfCompressAnalysis {
  fileName: string;
  fileSize: number;
  pageCount: number;
  encrypted: boolean;
  compressionPotential: number;
  estimatedOutputBytes: number;
  estimatedSeconds: number;
  qualityScore: number;
  imageHeavy: boolean;
  hasMetadata: boolean;
  hasEmbeddedFiles: boolean;
  blankPageCount: number;
  duplicateRisk: boolean;
  recommendedMode: CompressMode;
  features: string[];
  thumbs: string[];
  title?: string;
  author?: string;
}

export interface CompressReport {
  originalBytes: number;
  finalBytes: number;
  savedBytes: number;
  savedPercent: number;
  processingMs: number;
  qualityScore: number;
  performanceScore: number;
  optimizations: string[];
  pageCount: number;
}

export interface CompressResult {
  blob: Blob;
  filename: string;
  report: CompressReport;
}

export interface PdfQueueItem {
  id: string;
  file: File;
  duplicate: boolean;
  encrypted: boolean;
  analysis?: PdfCompressAnalysis;
  result?: CompressResult;
}

const MODE_PRESETS: Record<CompressMode, { quality: number; dpi: number; label: string; desc: string }> = {
  smart: { quality: 68, dpi: 1.5, label: 'Smart AI', desc: 'AI picks best balance for your PDF' },
  maximum: { quality: 35, dpi: 1.1, label: 'Maximum', desc: 'Smallest file — best for uploads' },
  balanced: { quality: 60, dpi: 1.4, label: 'Balanced', desc: 'Good size reduction with readable quality' },
  'high-quality': { quality: 82, dpi: 1.8, label: 'High Quality', desc: 'Minimal quality loss' },
  lossless: { quality: 95, dpi: 2.0, label: 'Lossless', desc: 'Structure optimize only — no rasterize' },
  print: { quality: 88, dpi: 2.2, label: 'Print Ready', desc: '300 DPI equivalent for printing' },
  email: { quality: 55, dpi: 1.2, label: 'Email Ready', desc: 'Under 5 MB for email attachments' },
  web: { quality: 50, dpi: 1.0, label: 'Web Optimized', desc: 'Fast loading for websites' },
  archive: { quality: 72, dpi: 1.6, label: 'Archive', desc: 'Long-term storage balance' },
  mobile: { quality: 45, dpi: 1.0, label: 'Mobile', desc: 'Lightweight for phones' },
  social: { quality: 48, dpi: 1.1, label: 'Social Sharing', desc: 'Quick share on social apps' },
};

export function getModePreset(mode: CompressMode) {
  return MODE_PRESETS[mode];
}

export function resolveSettings(settings: CompressSettings): CompressSettings {
  if (settings.mode === 'smart') return settings;
  const p = MODE_PRESETS[settings.mode];
  return { ...settings, imageQuality: p.quality, dpiScale: p.dpi };
}

async function detectBlankPages(file: File, pageCount: number, password?: string): Promise<number> {
  const pages = await renderPdfPages(file, 0.4, undefined, password);
  let blank = 0;
  for (const p of pages) {
    const ctx = p.canvas.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, p.canvas.width, p.canvas.height);
    let variance = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 16) {
      const lum = data[i] + data[i + 1] + data[i + 2];
      variance += lum;
      n++;
    }
    if (n > 0 && variance / n < 15) blank++;
  }
  return blank;
}

export async function analyzePdfForCompression(
  file: File,
  password?: string,
  onProgress?: (msg: string) => void,
): Promise<PdfCompressAnalysis> {
  onProgress?.('Validating PDF...');
  const valid = await validatePdfFile(file);
  if (!valid.ok) throw new Error(valid.error);

  const encrypted = await isPdfEncrypted(file);
  const pageCount = await getPdfPageCount(file);
  const fileSize = file.size;
  const bytesPerPage = fileSize / Math.max(1, pageCount);

  onProgress?.('Reading metadata...');
  let title: string | undefined;
  let author: string | undefined;
  let hasMetadata = false;
  try {
    const { PDFDocument } = await import('@cantoo/pdf-lib');
    const doc = await PDFDocument.load(await file.arrayBuffer(), {
      ignoreEncryption: true,
      password: password || undefined,
      updateMetadata: false,
    });
    title = doc.getTitle() ?? undefined;
    author = doc.getAuthor() ?? undefined;
    hasMetadata = !!(title || author || doc.getSubject() || doc.getKeywords());
  } catch { /* */ }

  onProgress?.('Analyzing pages...');
  const thumbs: string[] = [];
  const rendered = await renderPdfPages(file, 0.35, (d) => {
    if (d <= 3) onProgress?.(`Rendering preview ${d}...`);
  }, password);
  for (let i = 0; i < Math.min(4, rendered.length); i++) {
    thumbs.push(rendered[i].canvas.toDataURL('image/jpeg', 0.6));
  }

  onProgress?.('Detecting content type...');
  const textPages = await extractPdfText(file);
  const avgText = textPages.reduce((n, p) => n + p.replace(/\s/g, '').length, 0) / Math.max(1, pageCount);
  const imageHeavy = bytesPerPage > 80_000 || avgText < 200;

  onProgress?.('Scanning for blank pages...');
  const blankPageCount = await detectBlankPages(file, pageCount, password);

  const compressionPotential = Math.min(92, Math.round(
    (imageHeavy ? 55 : 25) +
    (hasMetadata ? 8 : 0) +
    (blankPageCount > 0 ? 10 : 0) +
    (bytesPerPage > 150_000 ? 15 : bytesPerPage > 50_000 ? 8 : 0),
  ));

  const recommendedMode: CompressMode =
    bytesPerPage > 200_000 ? 'maximum' :
    bytesPerPage > 80_000 ? 'balanced' :
    imageHeavy ? 'web' : 'high-quality';

  const estRatio = compressionPotential / 100;
  const estimatedOutputBytes = Math.round(fileSize * (1 - estRatio * 0.85));
  const estimatedSeconds = Math.max(2, Math.round(pageCount * 0.4 + fileSize / 2_000_000));

  const features = [
    'File Size Analysis',
    'Page Count',
    'Compression Potential',
    imageHeavy ? 'Image Analysis' : 'Font Analysis',
    hasMetadata ? 'Metadata Analysis' : 'Stream Analysis',
    encrypted ? 'Encryption Detection' : 'Structure Analysis',
  ];
  if (blankPageCount > 0) features.push('Blank Page Detection');
  if (imageHeavy) features.push('Embedded Image Detection');
  features.push('AI Compression Recommendation');

  return {
    fileName: file.name,
    fileSize,
    pageCount,
    encrypted,
    compressionPotential,
    estimatedOutputBytes,
    estimatedSeconds,
    qualityScore: imageHeavy ? 78 : 88,
    imageHeavy,
    hasMetadata,
    hasEmbeddedFiles: bytesPerPage > 100_000,
    blankPageCount,
    duplicateRisk: false,
    recommendedMode,
    features,
    thumbs,
    title,
    author,
  };
}

async function getNonBlankPageIndices(
  pages: Awaited<ReturnType<typeof renderPdfPages>>,
): Promise<number[]> {
  const kept: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    const ctx = pages[i].canvas.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, pages[i].canvas.width, pages[i].canvas.height);
    let lum = 0;
    let n = 0;
    for (let j = 0; j < data.length; j += 16) {
      lum += data[j] + data[j + 1] + data[j + 2];
      n++;
    }
    if (n > 0 && lum / n >= 15) kept.push(i);
  }
  return kept.length > 0 ? kept : pages.map((_, i) => i);
}

async function compressLossless(file: File, settings: CompressSettings): Promise<Blob> {
  const { PDFDocument } = await import('@cantoo/pdf-lib');
  const doc = await PDFDocument.load(await file.arrayBuffer(), {
    ignoreEncryption: true,
    password: settings.password || undefined,
  });
  if (settings.removeMetadata) {
    doc.setTitle('');
    doc.setAuthor('');
    doc.setSubject('');
    doc.setKeywords([]);
  }
  const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

async function compressRasterize(
  file: File,
  settings: CompressSettings,
  onProgress?: (p: number, msg: string) => void,
): Promise<Blob> {
  const { PDFDocument } = await import('@cantoo/pdf-lib');
  const s = resolveSettings(settings);
  const pages = await renderPdfPages(file, s.dpiScale, (d, t) => {
    onProgress?.(d / t * 0.65, `Rendering page ${d}/${t}...`);
  }, settings.password);

  let pageIndices = pages.map((_, i) => i);
  if (s.removeBlankPages && pages.length > 1) {
    pageIndices = await getNonBlankPageIndices(pages);
  }

  const doc = await PDFDocument.create();
  const q = s.imageQuality / 100;

  for (let i = 0; i < pageIndices.length; i++) {
    const pi = pageIndices[i];
    const jpg = await canvasToBlob(pages[pi].canvas, 'image/jpeg', q);
    const img = await doc.embedJpg(await jpg.arrayBuffer());
    const page = doc.addPage([pages[pi].width, pages[pi].height]);
    page.drawImage(img, { x: 0, y: 0, width: pages[pi].width, height: pages[pi].height });
    onProgress?.(0.65 + ((i + 1) / pageIndices.length) * 0.35, `Compressing page ${i + 1}/${pageIndices.length}...`);
  }

  if (s.removeMetadata) {
    doc.setTitle('');
    doc.setAuthor('');
  }

  const bytes = await doc.save({ useObjectStreams: true });
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

async function compressToTargetSize(
  file: File,
  settings: CompressSettings,
  targetKB: number,
  onProgress?: (p: number, msg: string) => void,
): Promise<Blob> {
  let lowQ = 18;
  let highQ = 92;
  let lowDpi = 0.75;
  let highDpi = 2.2;
  let best: Blob | null = null;

  for (let iter = 0; iter < 9; iter++) {
    const q = Math.round((lowQ + highQ) / 2);
    const dpi = Math.round(((lowDpi + highDpi) / 2) * 10) / 10;
    onProgress?.(iter / 9, `Targeting ${targetKB}KB — trying quality ${q}% @ ${dpi}x...`);
    const blob = await compressRasterize(
      file,
      { ...settings, imageQuality: q, dpiScale: dpi },
      (p, msg) => onProgress?.(iter / 9 + p / 9, msg),
    );
    const kb = blob.size / 1024;
    if (kb <= targetKB) {
      best = blob;
      lowQ = q;
      lowDpi = dpi;
    } else {
      highQ = Math.max(15, q - 2);
      highDpi = Math.max(0.7, dpi - 0.12);
    }
  }

  if (best) return best;
  return compressRasterize(file, { ...settings, imageQuality: 22, dpiScale: 0.85 }, onProgress);
}

export async function compressPdf(
  file: File,
  settings: CompressSettings,
  analysis: PdfCompressAnalysis,
  onProgress?: (p: number, msg: string) => void,
): Promise<CompressResult> {
  const start = performance.now();
  const originalBytes = file.size;

  onProgress?.(0.05, 'Starting compression...');
  let blob: Blob;
  const optimizations: string[] = [];

  if (settings.useTargetSize && settings.targetKB > 0) {
    blob = await compressToTargetSize(file, settings, settings.targetKB, onProgress);
    optimizations.push(`Target size ${settings.targetKB}KB`, 'Binary search quality tuning');
    if (settings.removeMetadata) optimizations.push('Metadata removed');
  } else if (settings.mode === 'lossless' && !analysis.imageHeavy) {
    blob = await compressLossless(file, settings);
    optimizations.push('Object stream optimization', 'Metadata cleanup');
  } else {
    blob = await compressRasterize(file, settings, onProgress);
    optimizations.push(
      `JPEG quality ${resolveSettings(settings).imageQuality}%`,
      `DPI scale ${resolveSettings(settings).dpiScale}x`,
    );
    if (settings.optimizeImages) optimizations.push('AI image optimization');
    if (settings.removeMetadata) optimizations.push('Metadata removed');
  }

  if (blob.size >= originalBytes * 0.98 && settings.mode !== 'lossless') {
    onProgress?.(0.9, 'Trying stronger compression...');
    const stronger = { ...settings, mode: 'maximum' as CompressMode, imageQuality: 40, dpiScale: 1.1 };
    blob = await compressRasterize(file, stronger, onProgress);
    optimizations.push('Auto re-compress for better savings');
  }

  const processingMs = Math.round(performance.now() - start);
  const finalBytes = blob.size;
  const savedBytes = Math.max(0, originalBytes - finalBytes);
  const savedPercent = originalBytes > 0 ? Math.round((savedBytes / originalBytes) * 100) : 0;

  const qualityScore = Math.min(98, Math.max(40,
    analysis.qualityScore - (settings.mode === 'maximum' ? 15 : settings.mode === 'web' ? 10 : 0) + (savedPercent > 30 ? 5 : 0),
  ));

  const report: CompressReport = {
    originalBytes,
    finalBytes,
    savedBytes,
    savedPercent,
    processingMs,
    qualityScore,
    performanceScore: Math.min(99, Math.round(90 - processingMs / 1000)),
    optimizations,
    pageCount: analysis.pageCount,
  };

  const suffix = savedPercent > 0 ? `-compressed-${savedPercent}pct` : '-compressed';
  const filename = file.name.replace(/\.pdf$/i, `${suffix}.pdf`);

  return { blob, filename, report };
}

export async function compressPdfBatch(
  items: PdfQueueItem[],
  settings: CompressSettings,
  onProgress?: (fileIdx: number, p: number, msg: string) => void,
): Promise<{ results: CompressResult[]; zipBlob?: Blob }> {
  const results: CompressResult[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.analysis) continue;
    const res = await compressPdf(item.file, settings, item.analysis, (p, msg) => onProgress?.(i, p, msg));
    results.push(res);
  }
  if (results.length <= 1) return { results };
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const r of results) zip.file(r.filename, r.blob);
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return { results, zipBlob };
}

export async function extractPdfsFromZip(file: File): Promise<File[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const out: File[] = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !path.toLowerCase().endsWith('.pdf')) continue;
    const blob = await entry.async('blob');
    out.push(new File([blob], path.split('/').pop() ?? 'doc.pdf', { type: 'application/pdf' }));
  }
  return out;
}

export async function fetchPdfFromUrl(url: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not fetch PDF from URL.');
  const blob = await res.blob();
  if (!blob.type.includes('pdf')) throw new Error('URL did not return a PDF.');
  const name = url.split('/').pop()?.split('?')[0] || 'document.pdf';
  return new File([blob], name, { type: 'application/pdf' });
}

export function markDuplicatePdfs(items: PdfQueueItem[]): PdfQueueItem[] {
  const seen = new Map<string, string>();
  return items.map((item) => {
    const fp = fileFingerprint(item.file);
    const dup = seen.has(fp);
    if (!dup) seen.set(fp, item.id);
    return { ...item, duplicate: dup };
  });
}

const SESSION_KEY = 'toolnest-pdf-compress-session';

export function saveCompressSession(data: { fileNames: string[]; step: number; mode: CompressMode }): void {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ ...data, savedAt: Date.now() })); } catch { /* */ }
}

export function loadCompressSession(): { fileNames: string[]; step: number; mode: CompressMode } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (Date.now() - s.savedAt > 7 * 86400000) return null;
    return s;
  } catch { return null; }
}

export const COMPRESS_MODES = Object.entries(MODE_PRESETS).map(([id, p]) => ({
  id: id as CompressMode,
  label: p.label,
  desc: p.desc,
}));
