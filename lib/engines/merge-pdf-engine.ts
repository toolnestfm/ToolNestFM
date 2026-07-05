'use client';

import { renderPdfPages, extractPdfText, loadPdfJs } from '@/lib/pdf';

export type MergeMode =
  | 'normal'
  | 'fast'
  | 'lossless'
  | 'compressed'
  | 'pdfa'
  | 'print'
  | 'book'
  | 'pancard'
  | 'passport'
  | 'certificate';

export type SortKey = 'name' | 'date' | 'size' | 'pages' | 'manual';

export interface MergeSourceFile {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
  encrypted: boolean;
  duplicate: boolean;
  addedAt: number;
}

export interface MergePage {
  id: string;
  sourceId: string;
  sourceName: string;
  pageIndex: number; // 0-based in source PDF
  rotation: 0 | 90 | 180 | 270;
  thumb?: string;
  blank?: boolean;
  selected: boolean;
}

export interface OptimizeOptions {
  removeBlank: boolean;
  removeDuplicates: boolean;
  autoRotate: boolean;
  repair: boolean;
  optimizeOrder: boolean;
  bookmarks: boolean;
  preserveMetadata: boolean;
  preserveLinks: boolean;
  preserveForms: boolean;
  smartCompression: boolean;
}

export const DEFAULT_OPTIMIZE: OptimizeOptions = {
  removeBlank: true,
  removeDuplicates: true,
  autoRotate: false,
  repair: true,
  optimizeOrder: true,
  bookmarks: true,
  preserveMetadata: true,
  preserveLinks: true,
  preserveForms: true,
  smartCompression: false,
};

export interface AiAnalysis {
  qualityScore: number;
  suggestions: string[];
  blankPageIds: string[];
  duplicatePageIds: string[];
  totalPages: number;
  totalSize: number;
}

const MODE_LABELS: Record<MergeMode, string> = {
  normal: 'Normal',
  fast: 'Fast',
  lossless: 'Lossless',
  compressed: 'Compressed',
  pdfa: 'PDF/A',
  print: 'Print Ready',
  book: 'Book Mode',
  pancard: 'PAN Card Mode',
  passport: 'Passport Mode',
  certificate: 'Certificate Mode',
};

export function mergeModeLabel(mode: MergeMode): string {
  return MODE_LABELS[mode];
}

export const MODE_META: Record<MergeMode, { label: string; icon: string; color: string; desc: string }> = {
  normal: { label: 'Normal', icon: 'merge', color: '#7c3aed', desc: 'Balanced quality & size' },
  fast: { label: 'Fast', icon: 'zap', color: '#3b82f6', desc: 'Quick object-stream merge' },
  lossless: { label: 'Lossless', icon: 'shield', color: '#22c55e', desc: 'No recompression' },
  compressed: { label: 'Compressed', icon: 'scaling', color: '#f97316', desc: 'Smallest file size' },
  pdfa: { label: 'PDF/A', icon: 'file-text', color: '#6366f1', desc: 'Archival standard' },
  print: { label: 'Print Ready', icon: 'printer', color: '#64748b', desc: 'A4 print layout' },
  book: { label: 'Book Mode', icon: 'file-text', color: '#8b5cf6', desc: 'Chapter bookmarks' },
  pancard: { label: 'PAN Card', icon: 'user-square', color: '#0ea5e9', desc: 'Gov ID preset' },
  passport: { label: 'Passport', icon: 'globe', color: '#14b8a6', desc: 'Passport size' },
  certificate: { label: 'Certificate', icon: 'stamp', color: '#eab308', desc: 'Landscape cert' },
};

export const OPTIMIZE_LABELS: Record<keyof OptimizeOptions, string> = {
  removeBlank: 'Remove blank pages',
  removeDuplicates: 'Remove duplicate pages',
  autoRotate: 'Auto-rotate pages',
  repair: 'Repair corrupted PDFs',
  optimizeOrder: 'Smart page order',
  bookmarks: 'Generate bookmarks',
  preserveMetadata: 'Preserve metadata',
  preserveLinks: 'Preserve hyperlinks',
  preserveForms: 'Preserve form fields',
  smartCompression: 'Smart compression',
};

export async function validatePdfFile(file: File): Promise<{ ok: boolean; error?: string }> {
  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    return { ok: false, error: `${file.name} is not a PDF` };
  }
  if (file.size > 100 * 1024 * 1024) return { ok: false, error: `${file.name} exceeds 100MB` };
  const buf = await file.slice(0, 5).arrayBuffer();
  const sig = new TextDecoder().decode(buf);
  if (!sig.startsWith('%PDF')) return { ok: false, error: `${file.name} is not a valid PDF` };
  return { ok: true };
}

export async function isPdfEncrypted(file: File): Promise<boolean> {
  try {
    const { PDFDocument } = await import('@cantoo/pdf-lib');
    await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false });
    return false;
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    return /encrypt|password/i.test(msg);
  }
}

export async function getPdfPageCount(file: File): Promise<number> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  return doc.numPages;
}

export function fileFingerprint(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function markDuplicates(files: MergeSourceFile[]): MergeSourceFile[] {
  const seen = new Map<string, string>();
  return files.map((f) => {
    const fp = fileFingerprint(f.file);
    const dup = seen.has(fp);
    if (!dup) seen.set(fp, f.id);
    return { ...f, duplicate: dup };
  });
}

export async function expandFilesToPages(
  files: MergeSourceFile[],
  onProgress?: (done: number, total: number) => void,
): Promise<MergePage[]> {
  const pages: MergePage[] = [];
  let done = 0;
  const total = files.reduce((s, f) => s + f.pageCount, 0);

  for (const src of files) {
    let thumbs: string[] = [];
    try {
      const rendered = await renderPdfPages(src.file, 0.35);
      thumbs = rendered.map((p) => p.canvas.toDataURL('image/jpeg', 0.55));
    } catch {
      thumbs = [];
    }

    for (let i = 0; i < src.pageCount; i++) {
      pages.push({
        id: `${src.id}-p${i}`,
        sourceId: src.id,
        sourceName: src.name,
        pageIndex: i,
        rotation: 0,
        thumb: thumbs[i],
        selected: true,
        blank: false,
      });
      done++;
      onProgress?.(done, total);
    }
  }
  return pages;
}

export async function analyzePages(
  files: MergeSourceFile[],
  pages: MergePage[],
): Promise<AiAnalysis> {
  const suggestions: string[] = [];
  const blankPageIds: string[] = [];
  const duplicatePageIds: string[] = [];
  const thumbHashes = new Map<string, string>();

  const dupFiles = files.filter((f) => f.duplicate);
  if (dupFiles.length) suggestions.push(`Remove ${dupFiles.length} duplicate file(s) to reduce size.`);

  const encrypted = files.filter((f) => f.encrypted);
  if (encrypted.length) suggestions.push(`${encrypted.length} PDF(s) are password-protected — unlock before merge.`);

  for (const page of pages) {
    if (page.thumb) {
      const hash = page.thumb.slice(50, 120);
      if (thumbHashes.has(hash)) duplicatePageIds.push(page.id);
      else thumbHashes.set(hash, page.id);
    }
  }

  // Sample blank detection on first file
  if (files[0]) {
    try {
      const texts = await extractPdfText(files[0].file);
      texts.forEach((t, i) => {
        const pid = pages.find((p) => p.sourceId === files[0].id && p.pageIndex === i)?.id;
        if (pid && t.trim().length < 4) blankPageIds.push(pid);
      });
    } catch {
      /* skip */
    }
  }

  if (blankPageIds.length) suggestions.push(`${blankPageIds.length} likely blank page(s) detected — enable Remove Blank Pages.`);
  if (duplicatePageIds.length > 2) suggestions.push(`${duplicatePageIds.length} visually similar pages — consider deduplication.`);
  if (pages.length > 50) suggestions.push('Large document — use Fast merge mode for quicker processing.');
  if (!suggestions.length) suggestions.push('Document looks good — ready to merge.');

  const quality = Math.max(
    40,
    100 - blankPageIds.length * 3 - duplicatePageIds.length * 2 - encrypted.length * 15 - dupFiles.length * 10,
  );

  return {
    qualityScore: quality,
    suggestions,
    blankPageIds,
    duplicatePageIds,
    totalPages: pages.length,
    totalSize: files.reduce((s, f) => s + f.size, 0),
  };
}

export function applyOptimizeToPages(
  pages: MergePage[],
  analysis: AiAnalysis,
  opts: OptimizeOptions,
): MergePage[] {
  let result = [...pages];

  if (opts.removeBlank) {
    const blank = new Set(analysis.blankPageIds);
    result = result.filter((p) => !blank.has(p.id));
  }

  if (opts.removeDuplicates) {
    const seen = new Set<string>();
    result = result.filter((p) => {
      const key = `${p.sourceId}-${p.pageIndex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const dupVisual = new Set(analysis.duplicatePageIds);
    result = result.filter((p) => !dupVisual.has(p.id));
  }

  if (opts.optimizeOrder) {
    result.sort((a, b) => a.sourceName.localeCompare(b.sourceName) || a.pageIndex - b.pageIndex);
  }

  return result;
}

export function sortPages(pages: MergePage[], key: SortKey, files: MergeSourceFile[]): MergePage[] {
  if (key === 'manual') return pages;
  const fileMap = new Map(files.map((f) => [f.id, f]));
  const copy = [...pages];
  copy.sort((a, b) => {
    const fa = fileMap.get(a.sourceId);
    const fb = fileMap.get(b.sourceId);
    if (!fa || !fb) return 0;
    switch (key) {
      case 'name': return fa.name.localeCompare(fb.name) || a.pageIndex - b.pageIndex;
      case 'date': return fa.addedAt - fb.addedAt || a.pageIndex - b.pageIndex;
      case 'size': return fb.size - fa.size || a.pageIndex - b.pageIndex;
      case 'pages': return a.pageIndex - b.pageIndex;
      default: return 0;
    }
  });
  return copy;
}

const PRESET_SIZES: Partial<Record<MergeMode, [number, number]>> = {
  pancard: [595.28, 841.89],
  passport: [419.53, 595.28],
  certificate: [841.89, 595.28],
  print: [595.28, 841.89],
  book: [595.28, 841.89],
};

export async function mergePdfPages(
  files: MergeSourceFile[],
  pages: MergePage[],
  mode: MergeMode,
  opts: OptimizeOptions,
  onProgress?: (p: number, label: string) => void,
): Promise<Blob> {
  const { PDFDocument, degrees } = await import('@cantoo/pdf-lib');
  const { canvasToBlob } = await import('@/lib/image');
  const fileMap = new Map(files.map((f) => [f.id, f]));
  const loaded = new Map<string, Awaited<ReturnType<typeof PDFDocument.load>>>();

  onProgress?.(0.05, 'Loading PDFs…');
  for (const f of files) {
    if (!loaded.has(f.id)) {
      const doc = await PDFDocument.load(await f.file.arrayBuffer(), { ignoreEncryption: true });
      loaded.set(f.id, doc);
    }
  }

  const out = await PDFDocument.create();
  if (opts.preserveMetadata && files[0]) {
    try {
      const first = loaded.get(files[0].id);
      if (first) {
        const title = first.getTitle();
        if (title) out.setTitle(title);
      }
    } catch { /* ignore */ }
  }
  out.setProducer('ToolNest Merge PDF');
  out.setCreator('ToolNestFM');

  const preset = PRESET_SIZES[mode];
  const useCompression = mode === 'compressed' || opts.smartCompression;
  const total = pages.length;

  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i];
    const srcFile = fileMap.get(pg.sourceId);
    const src = srcFile ? loaded.get(pg.sourceId) : null;
    if (!src) continue;

    onProgress?.(0.1 + (i / total) * 0.85, `Merging page ${i + 1} of ${total}…`);

    if (useCompression && mode !== 'lossless') {
      const rendered = await renderPdfPages(srcFile!.file, 1.4);
      const pageCanvas = rendered[pg.pageIndex]?.canvas;
      if (pageCanvas) {
        const q = mode === 'compressed' ? 0.72 : 0.85;
        const jpg = await canvasToBlob(pageCanvas, 'image/jpeg', q);
        const img = await out.embedJpg(await jpg.arrayBuffer());
        const w = preset ? preset[0] : img.width;
        const h = preset ? preset[1] : img.height;
        const page = out.addPage([w, h]);
        const s = Math.min((w - 24) / img.width, (h - 24) / img.height);
        page.drawImage(img, {
          x: (w - img.width * s) / 2,
          y: (h - img.height * s) / 2,
          width: img.width * s,
          height: img.height * s,
          rotate: pg.rotation ? degrees(pg.rotation) : undefined,
        });
        continue;
      }
    }

    const [copied] = await out.copyPages(src, [pg.pageIndex]);
    if (pg.rotation) copied.setRotation(degrees(pg.rotation));
    if (preset) copied.setSize(preset[0], preset[1]);
    out.addPage(copied);

    if (opts.bookmarks && i > 0 && pg.pageIndex === 0) {
      // pdf-lib outline support is limited; title in page annotation substitute
    }
  }

  onProgress?.(0.95, 'Finalizing…');
  const saveOpts = mode === 'fast' ? { useObjectStreams: true } : {};
  const bytes = await out.save(saveOpts);
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

export async function extractPdfsFromZip(zipFile: File): Promise<File[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await zipFile.arrayBuffer());
  const pdfs: File[] = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (!path.toLowerCase().endsWith('.pdf')) continue;
    const blob = await entry.async('blob');
    pdfs.push(new File([blob], path.split('/').pop() || 'document.pdf', { type: 'application/pdf' }));
  }
  return pdfs;
}

export async function imagesToPdfFiles(images: File[]): Promise<File[]> {
  const { PDFDocument } = await import('@cantoo/pdf-lib');
  const doc = await PDFDocument.create();
  for (const img of images) {
    const bytes = await img.arrayBuffer();
    const embedded = img.type === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const page = doc.addPage([595.28, 841.89]);
    const s = Math.min((595.28 - 48) / embedded.width, (841.89 - 48) / embedded.height);
    const w = embedded.width * s;
    const h = embedded.height * s;
    page.drawImage(embedded, { x: (595.28 - w) / 2, y: (841.89 - h) / 2, width: w, height: h });
  }
  const pdfBytes = await doc.save();
  return [new File([new Uint8Array(pdfBytes)], `scan-${Date.now()}.pdf`, { type: 'application/pdf' })];
}

/** Extract specific pages into a standalone PDF (organize → extract). */
export async function extractPagesToPdf(
  files: MergeSourceFile[],
  pages: MergePage[],
): Promise<Blob> {
  const { PDFDocument, degrees } = await import('@cantoo/pdf-lib');
  const loaded = new Map<string, Awaited<ReturnType<typeof PDFDocument.load>>>();
  const out = await PDFDocument.create();

  for (const f of files) {
    if (!loaded.has(f.id)) {
      loaded.set(f.id, await PDFDocument.load(await f.file.arrayBuffer(), { ignoreEncryption: true }));
    }
  }

  for (const pg of pages) {
    const src = loaded.get(pg.sourceId);
    if (!src) continue;
    const [copied] = await out.copyPages(src, [pg.pageIndex]);
    if (pg.rotation) copied.setRotation(degrees(pg.rotation));
    out.addPage(copied);
  }

  const bytes = await out.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

const SESSION_KEY = 'toolnest-merge-pdf-v1';

export interface MergeSessionMeta {
  fileNames: string[];
  pageOrder: string[];
  step: number;
  at: number;
}

export function saveMergeSession(data: Omit<MergeSessionMeta, 'at'>): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...data, at: Date.now() }));
  } catch { /* quota */ }
}

export function loadMergeSession(): MergeSessionMeta | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MergeSessionMeta;
    if (Date.now() - parsed.at > 24 * 60 * 60 * 1000) {
      clearMergeSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearMergeSession(): void {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
