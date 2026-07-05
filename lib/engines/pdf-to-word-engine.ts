'use client';

import { loadPdfJs, renderPdfPages } from '@/lib/pdf';
import { looksBrokenBengali, restoreBengaliText } from '@/lib/text-restore';
import { computeConfidence, type ConfidenceBreakdown } from '@/lib/engines/pdf-word-confidence';
import {
  analyzePdfLayout,
  parsePageRange,
  type PageLayout,
  type TextLine,
} from '@/lib/engines/pdf-layout-analyzer';
import { getGovPreset, type GovPresetId } from '@/lib/engines/gov-pdf-presets';
import { replaceExt } from '@/lib/download';

export type ConversionMode =
  | 'smart'
  | 'layout-exact'
  | 'reflow'
  | 'text-only'
  | 'ocr-deep'
  | 'gov-preset';

export type OutputFormat = 'docx' | 'doc';
export type EmbedImagesMode = 'yes' | 'placeholder' | 'skip';

export interface PdfToWordOptions {
  mode: ConversionMode;
  outputFormat: OutputFormat;
  pageRange: string;
  embedImages: EmbedImagesMode;
  preserveHeaders: boolean;
  ocrLangs: string;
  aiIndicRepair: boolean;
  govPreset: GovPresetId;
  password?: string;
  deskew: boolean;
  dpiScale: number;
}

export const DEFAULT_PDF_TO_WORD_OPTIONS: PdfToWordOptions = {
  mode: 'smart',
  outputFormat: 'docx',
  pageRange: 'all',
  embedImages: 'yes',
  preserveHeaders: true,
  ocrLangs: 'ben+eng',
  aiIndicRepair: true,
  govPreset: 'none',
  deskew: true,
  dpiScale: 2,
};

export interface ConversionLogEntry {
  page: number;
  message: string;
  level: 'info' | 'warn' | 'success';
}

export interface PdfToWordResult {
  blob: Blob;
  filename: string;
  confidence: ConfidenceBreakdown;
  usedOcr: boolean;
  log: ConversionLogEntry[];
  pageThumbs: string[];
}

interface PageContent {
  pageIndex: number;
  lines: TextLine[];
  plainText: string;
  usedOcr: boolean;
  ocrConfidence: number;
  imageDataUrl?: string;
}

function linesToPlain(lines: TextLine[]): string {
  return lines.map((l) => l.spans.map((s) => s.text).join(' ')).join('\n');
}

function resolveMode(requested: ConversionMode, profileMode: ConversionMode): ConversionMode {
  if (requested === 'smart') return profileMode;
  return requested;
}

async function extractPageLines(
  file: File,
  pageIndex: number,
  password: string | undefined,
  forceOcr: boolean,
  ocrLangs: string,
  dpiScale: number,
): Promise<{ lines: TextLine[]; plainText: string; usedOcr: boolean; ocrConfidence: number; imageDataUrl?: string }> {
  const pdfjs = await loadPdfJs();
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data, password: password || undefined }).promise;
  const page = await doc.getPage(pageIndex + 1);
  const content = await page.getTextContent();

  interface TextItem { str: string; transform: number[]; width: number; height: number; fontName?: string }
  const items = content.items as TextItem[];
  const lineMap = new Map<number, { x: number; str: string; fontSize: number; bold: boolean }[]>();

  for (const it of items) {
    if (!it.str.trim()) continue;
    const y = Math.round(it.transform[5]);
    const x = it.transform[4];
    const fontSize = Math.abs(it.transform[0]) || 12;
    let bucket = lineMap.get(y);
    if (!bucket) {
      for (const [ly, l] of lineMap) {
        if (Math.abs(ly - y) <= 4) { bucket = l; break; }
      }
    }
    if (!bucket) { bucket = []; lineMap.set(y, bucket); }
    bucket.push({ x, str: it.str, fontSize, bold: (it.fontName ?? '').toLowerCase().includes('bold') });
  }

  const lines: TextLine[] = Array.from(lineMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([y, spans]) => ({
      y,
      spans: spans.sort((a, b) => a.x - b.x).map((s) => ({
        text: s.str,
        x: s.x,
        y,
        width: s.fontSize * s.str.length * 0.5,
        height: s.fontSize,
        fontSize: s.fontSize,
        bold: s.bold,
      })),
    }));

  const charCount = lines.reduce((n, l) => n + l.spans.reduce((s, sp) => s + sp.text.length, 0), 0);
  const weak = charCount < 40;

  if (!forceOcr && !weak) {
    return { lines, plainText: linesToPlain(lines), usedOcr: false, ocrConfidence: 100 };
  }

  const rendered = await renderPdfPages(
    new File([await file.arrayBuffer()], file.name, { type: file.type }),
    dpiScale,
  );
  const canvas = rendered[pageIndex]?.canvas;
  if (!canvas) {
    return { lines, plainText: linesToPlain(lines), usedOcr: false, ocrConfidence: 0 };
  }

  const Tesseract = await import('tesseract.js');
  const worker = await Tesseract.createWorker(ocrLangs, 1);
  try {
    const { data } = await worker.recognize(canvas);
    const ocrText = data.text.trim();
    const conf = data.confidence ?? 75;
    const ocrLines: TextLine[] = ocrText.split('\n').filter(Boolean).map((text, i) => ({
      y: i * 20,
      spans: [{ text, x: 0, y: i * 20, width: 400, height: 14, fontSize: 14, bold: false }],
    }));
    const merged = ocrText.replace(/\s+/g, '').length >= linesToPlain(lines).replace(/\s+/g, '').length
      ? ocrLines
      : lines;
    return {
      lines: merged,
      plainText: linesToPlain(merged),
      usedOcr: true,
      ocrConfidence: conf,
      imageDataUrl: canvas.toDataURL('image/jpeg', 0.85),
    };
  } finally {
    await worker.terminate();
  }
}

async function repairText(text: string, aiIndicRepair: boolean): Promise<string> {
  if (!aiIndicRepair || !looksBrokenBengali(text)) return text;
  try {
    const repaired = await restoreBengaliText(text);
    return repaired.trim() ? repaired : text;
  } catch {
    return text;
  }
}

async function buildDocx(
  pages: PageContent[],
  mode: ConversionMode,
  embedImages: EmbedImagesMode,
  layoutPages: PageLayout[],
): Promise<{ blob: Blob; tablesRebuilt: number; imagesEmbedded: number }> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    PageBreak,
    Table,
    TableRow,
    TableCell,
    WidthType,
    ImageRun,
    HeadingLevel,
  } = await import('docx');

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];
  let tablesRebuilt = 0;
  let imagesEmbedded = 0;

  for (let pi = 0; pi < pages.length; pi++) {
    const page = pages[pi];
    const layout = layoutPages.find((p) => p.pageIndex === page.pageIndex);
    const tables = layout?.tables ?? [];

    if (mode === 'text-only' || mode === 'reflow') {
      const paras = page.plainText.split('\n').filter((l) => l.trim());
      for (const line of paras) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line, size: 22 })],
            spacing: { after: 120 },
          }),
        );
      }
    } else if (tables.length > 0 && mode !== 'ocr-deep') {
      const tableLines = page.lines;
      let lineIdx = 0;
      for (const tbl of tables) {
        const rows: string[][] = [];
        while (lineIdx < tableLines.length && tableLines[lineIdx].y <= tbl.endY) {
          if (tableLines[lineIdx].spans.length >= 2) {
            rows.push(tableLines[lineIdx].spans.map((s) => s.text.trim()));
          }
          lineIdx++;
        }
        if (rows.length >= 2) {
          tablesRebuilt++;
          children.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: rows.map(
                (row) =>
                  new TableRow({
                    children: row.map(
                      (cell) =>
                        new TableCell({
                          children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20 })] })],
                        }),
                    ),
                  }),
              ),
            }),
          );
          children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
        }
      }
      while (lineIdx < tableLines.length) {
        const line = tableLines[lineIdx];
        const maxFont = Math.max(...line.spans.map((s) => s.fontSize), 12);
        const isHeading = maxFont >= 16 || line.spans.some((s) => s.bold);
        children.push(
          new Paragraph({
            children: line.spans.map(
              (s) =>
                new TextRun({
                  text: s.text + (s === line.spans[line.spans.length - 1] ? '' : ' '),
                  size: Math.round(s.fontSize * 2),
                  bold: s.bold,
                }),
            ),
            heading: isHeading ? HeadingLevel.HEADING_2 : undefined,
            spacing: { after: 100 },
          }),
        );
        lineIdx++;
      }
    } else {
      for (const line of page.lines) {
        const text = line.spans.map((s) => s.text).join(' ');
        if (!text.trim()) continue;
        const maxFont = Math.max(...line.spans.map((s) => s.fontSize), 12);
        children.push(
          new Paragraph({
            children: line.spans.map(
              (s) =>
                new TextRun({
                  text: s.text + (s === line.spans[line.spans.length - 1] ? '' : ' '),
                  size: Math.round(Math.min(maxFont, 24) * 2),
                  bold: s.bold,
                }),
            ),
            spacing: { after: 80 },
          }),
        );
      }
    }

    if (
      embedImages === 'yes' &&
      page.imageDataUrl &&
      (mode === 'ocr-deep' || mode === 'layout-exact' || page.usedOcr)
    ) {
      try {
        const b64 = page.imageDataUrl.split(',')[1];
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const w = layout?.width ?? 400;
        const h = layout?.height ?? 560;
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: bytes,
                transformation: { width: Math.round(w * 2.5), height: Math.round(h * 2.5) },
                type: 'jpg',
              }),
            ],
          }),
        );
        imagesEmbedded++;
      } catch {
        /* skip bad image */
      }
    } else if (embedImages === 'placeholder' && page.usedOcr) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `[Page ${page.pageIndex + 1} scan image — enable Embed Images to include]`, italics: true, size: 18 })],
        }),
      );
    }

    if (pi < pages.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);

  return { blob, tablesRebuilt, imagesEmbedded };
}

export async function convertPdfToWord(
  file: File,
  options: PdfToWordOptions,
  onProgress?: (progress: number, status: string) => void,
): Promise<PdfToWordResult> {
  const log: ConversionLogEntry[] = [];
  const push = (page: number, message: string, level: ConversionLogEntry['level'] = 'info') => {
    log.push({ page, message, level });
  };

  onProgress?.(0.05, 'Analyzing document structure...');
  const profile = await analyzePdfLayout(file, options.password, (d, t, stage) => {
    onProgress?.(0.05 + (d / t) * 0.15, stage);
  });

  const effectiveMode = resolveMode(options.mode, profile.recommendedMode);
  const gov = options.govPreset !== 'none' ? getGovPreset(options.govPreset) : null;
  const ocrLangs = gov?.ocrLangs ?? options.ocrLangs;
  const forceOcr = effectiveMode === 'ocr-deep';
  const aiRepair = options.aiIndicRepair || (gov?.indicRepair ?? false);

  const pageIndices = parsePageRange(options.pageRange, profile.pageCount);
  if (pageIndices.length === 0) {
    throw new Error('No pages selected. Check your page range.');
  }

  push(0, `Document: ${profile.docType}, ${profile.pageCount} pages, mode: ${effectiveMode}`, 'info');
  if (profile.govPresetSuggestion && options.govPreset === 'none') {
    push(0, `Suggested gov preset: ${profile.govPresetSuggestion}`, 'info');
  }

  const pageContents: PageContent[] = [];
  let anyOcr = false;
  let ocrConfSum = 0;
  let ocrConfN = 0;
  let brokenBengali = 0;
  let indicFixed = 0;

  for (let i = 0; i < pageIndices.length; i++) {
    const pageIdx = pageIndices[i];
    onProgress?.(0.2 + (i / pageIndices.length) * 0.55, `Processing page ${pageIdx + 1}...`);
    push(pageIdx + 1, 'Extracting content', 'info');

    const extracted = await extractPageLines(
      file,
      pageIdx,
      options.password,
      forceOcr || profile.pages[pageIdx]?.weakTextLayer === true,
      ocrLangs,
      options.dpiScale,
    );

    let imageDataUrl = extracted.imageDataUrl;
    if (
      options.embedImages === 'yes' &&
      effectiveMode === 'layout-exact' &&
      !imageDataUrl &&
      (profile.pages[pageIdx]?.weakTextLayer || profile.docType === 'scanned' || extracted.lines.length < 4)
    ) {
      const rendered = await renderPdfPages(file, options.dpiScale, undefined, options.password);
      const canvas = rendered[pageIdx]?.canvas;
      if (canvas) imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    }

    if (extracted.usedOcr) {
      anyOcr = true;
      ocrConfSum += extracted.ocrConfidence;
      ocrConfN++;
      push(pageIdx + 1, `OCR applied (${Math.round(extracted.ocrConfidence)}% confidence)`, 'success');
    }

    let plainText = extracted.plainText;
    if (looksBrokenBengali(plainText)) {
      brokenBengali++;
      push(pageIdx + 1, 'Applying Indic AI repair', 'info');
      plainText = await repairText(plainText, aiRepair);
      if (plainText !== extracted.plainText) indicFixed++;
      extracted.lines = plainText.split('\n').map((text, li) => ({
        y: li * 18,
        spans: [{ text, x: 0, y: li * 18, width: 400, height: 14, fontSize: 14, bold: false }],
      }));
    }

    pageContents.push({
      pageIndex: pageIdx,
      lines: extracted.lines,
      plainText,
      usedOcr: extracted.usedOcr,
      ocrConfidence: extracted.ocrConfidence,
      imageDataUrl,
    });
  }

  onProgress?.(0.78, 'Building Word document...');
  const ext = options.outputFormat === 'doc' ? 'doc' : 'docx';
  const { blob, tablesRebuilt, imagesEmbedded } = await buildDocx(
    pageContents,
    effectiveMode,
    options.embedImages,
    profile.pages,
  );

  const confidence = computeConfidence({
    pageCount: pageIndices.length,
    pagesWithText: pageContents.filter((p) => p.plainText.trim().length > 20).length,
    tablesDetected: profile.tablesDetected,
    tablesRebuilt,
    imagesExpected: pageContents.filter((p) => p.usedOcr).length,
    imagesEmbedded,
    usedOcr: anyOcr,
    ocrAvgConfidence: ocrConfN > 0 ? ocrConfSum / ocrConfN : 100,
    indicRepairPages: indicFixed,
    brokenBengaliBefore: brokenBengali,
    docType: profile.docType,
  });

  push(0, `Conversion complete — ${confidence.overall}% confidence`, 'success');
  onProgress?.(1, 'Done');

  return {
    blob,
    filename: replaceExt(file.name, ext),
    confidence,
    usedOcr: anyOcr,
    log,
    pageThumbs: profile.pages.map((p) => p.thumb ?? ''),
  };
}

/** Batch convert multiple PDFs; returns single DOCX or ZIP of DOCXs. */
export async function convertPdfBatchToWord(
  files: File[],
  options: PdfToWordOptions,
  onProgress?: (fileIdx: number, progress: number, status: string) => void,
): Promise<{ blob: Blob; filename: string; results: PdfToWordResult[] }> {
  const results: PdfToWordResult[] = [];
  for (let i = 0; i < files.length; i++) {
    const res = await convertPdfToWord(files[i], options, (p, s) => onProgress?.(i, p, s));
    results.push(res);
  }

  if (results.length === 1) {
    return { blob: results[0].blob, filename: results[0].filename, results };
  }

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const r of results) {
    zip.file(r.filename, r.blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return { blob: zipBlob, filename: 'pdf-to-word-batch.zip', results };
}

const SESSION_KEY = 'toolnest-pdf-to-word-session';

export interface PdfToWordSession {
  fileNames: string[];
  options: PdfToWordOptions;
  step: number;
  savedAt: number;
}

export function savePdfToWordSession(session: PdfToWordSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch { /* quota */ }
}

export function loadPdfToWordSession(): PdfToWordSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as PdfToWordSession;
    if (Date.now() - s.savedAt > 7 * 24 * 60 * 60 * 1000) return null;
    return s;
  } catch {
    return null;
  }
}

export function clearPdfToWordSession(): void {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* */ }
}

export const MODE_LABELS: Record<ConversionMode, string> = {
  smart: 'Smart (AI picks best)',
  'layout-exact': 'Layout Exact',
  reflow: 'Reflow (easy reading)',
  'text-only': 'Text Only',
  'ocr-deep': 'OCR Deep (scanned)',
  'gov-preset': 'Government Preset',
};

export const MODE_DESCRIPTIONS: Record<ConversionMode, string> = {
  smart: 'Automatically picks the best engine for your PDF type.',
  'layout-exact': 'Preserves tables, columns and formatting blocks.',
  reflow: 'Single-column reading order — great for Kindle editing.',
  'text-only': 'Fast text extraction without images.',
  'ocr-deep': 'Force OCR on every page — best for scans.',
  'gov-preset': 'Tuned for Indian government forms and certificates.',
};
