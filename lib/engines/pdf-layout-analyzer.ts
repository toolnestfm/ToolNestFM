'use client';

import { loadPdfJs } from '@/lib/pdf';
import { isPdfEncrypted } from '@/lib/engines/merge-pdf-engine';
import { detectGovPreset } from '@/lib/engines/gov-pdf-presets';
export type RecommendedMode = 'smart' | 'layout-exact' | 'reflow' | 'text-only' | 'ocr-deep' | 'gov-preset';

export interface TextSpan {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  bold: boolean;
}

export interface TextLine {
  spans: TextSpan[];
  y: number;
}

export interface TableRegion {
  rowCount: number;
  colCount: number;
  startY: number;
  endY: number;
}

export interface PageLayout {
  pageIndex: number;
  width: number;
  height: number;
  lines: TextLine[];
  tables: TableRegion[];
  charCount: number;
  weakTextLayer: boolean;
  thumb?: string;
}

export interface PdfProfile {
  pageCount: number;
  encrypted: boolean;
  docType: 'digital' | 'scanned' | 'mixed';
  tablesDetected: number;
  imageCount: number;
  columnCount: 1 | 2 | 3;
  languages: string[];
  recommendedMode: RecommendedMode;
  recommendedOcrLangs: string;
  govPresetSuggestion: string | null;
  pages: PageLayout[];
  sampleText: string;
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName?: string;
}

const MIN_CHARS_PER_PAGE = 40;

function detectScripts(text: string): string[] {
  const langs: string[] = [];
  if (/[ঀ-৿]/.test(text)) langs.push('Bengali');
  if (/[\u0900-\u097F]/.test(text)) langs.push('Hindi');
  if (/[\u0B80-\u0BFF]/.test(text)) langs.push('Tamil');
  if (/[\u0C00-\u0C7F]/.test(text)) langs.push('Telugu');
  if (/[A-Za-z]/.test(text)) langs.push('English');
  return langs.length ? langs : ['English'];
}

function extractLinesFromItems(items: TextItem[]): TextLine[] {
  const lineMap = new Map<number, TextSpan[]>();
  for (const it of items) {
    if (!it.str.trim()) continue;
    const x = it.transform[4];
    const y = Math.round(it.transform[5]);
    const fontSize = Math.abs(it.transform[0]) || 12;
    const bold = (it.fontName ?? '').toLowerCase().includes('bold');
    let bucket = lineMap.get(y);
    if (!bucket) {
      for (const [ly, spans] of lineMap) {
        if (Math.abs(ly - y) <= 4) {
          bucket = spans;
          break;
        }
      }
    }
    if (!bucket) {
      bucket = [];
      lineMap.set(y, bucket);
    }
    bucket.push({
      text: it.str,
      x,
      y,
      width: it.width || fontSize * it.str.length * 0.5,
      height: it.height || fontSize,
      fontSize,
      bold,
    });
  }
  return Array.from(lineMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([y, spans]) => ({
      y,
      spans: spans.sort((a, b) => a.x - b.x),
    }));
}

function detectTables(lines: TextLine[]): TableRegion[] {
  const tables: TableRegion[] = [];
  let runStart = -1;
  let runCols = 0;
  let runRows = 0;

  const flush = (endIdx: number) => {
    if (runRows >= 2 && runCols >= 2) {
      tables.push({
        rowCount: runRows,
        colCount: runCols,
        startY: lines[runStart]?.y ?? 0,
        endY: lines[endIdx]?.y ?? 0,
      });
    }
    runStart = -1;
    runCols = 0;
    runRows = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].spans.length;
    const isTableRow = cols >= 2 && lines[i].spans.every((s) => s.text.trim().length > 0);
    if (isTableRow) {
      if (runStart < 0) {
        runStart = i;
        runCols = cols;
        runRows = 1;
      } else if (Math.abs(cols - runCols) <= 1) {
        runRows++;
        runCols = Math.max(runCols, cols);
      } else {
        flush(i - 1);
        runStart = i;
        runCols = cols;
        runRows = 1;
      }
    } else if (runStart >= 0) {
      flush(i - 1);
    }
  }
  if (runStart >= 0) flush(lines.length - 1);
  return tables;
}

function detectColumns(lines: TextLine[]): 1 | 2 | 3 {
  const xs: number[] = [];
  for (const line of lines) {
    if (line.spans[0]) xs.push(line.spans[0].x);
  }
  if (xs.length < 4) return 1;
  const sorted = [...new Set(xs.map((x) => Math.round(x / 40) * 40))].sort((a, b) => a - b);
  if (sorted.length >= 3) return 3;
  if (sorted.length >= 2) return 2;
  return 1;
}

function pickMode(weakRatio: number, tables: number, gov: boolean): RecommendedMode {
  if (weakRatio > 0.6) return 'ocr-deep';
  if (gov && tables > 0) return 'gov-preset';
  if (tables >= 2) return 'layout-exact';
  if (weakRatio > 0.25) return 'ocr-deep';
  return 'smart';
}

export async function analyzePdfLayout(
  file: File,
  password?: string,
  onProgress?: (done: number, total: number, stage: string) => void,
): Promise<PdfProfile> {
  const encrypted = await isPdfEncrypted(file);
  const pdfjs = await loadPdfJs();
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data, password: password || undefined }).promise;
  const pageCount = doc.numPages;
  const pages: PageLayout[] = [];
  let weakPages = 0;
  let totalTables = 0;
  let sampleText = '';

  for (let i = 1; i <= pageCount; i++) {
    onProgress?.(i, pageCount, 'Analyzing pages');
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 0.35 });
    const content = await page.getTextContent();
    const items = content.items as TextItem[];
    const lines = extractLinesFromItems(items);
    const charCount = lines.reduce((n, l) => n + l.spans.reduce((s, sp) => s + sp.text.length, 0), 0);
    const weakTextLayer = charCount < MIN_CHARS_PER_PAGE;
    if (weakTextLayer) weakPages++;
    const tables = detectTables(lines);
    totalTables += tables.length;

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;

    pages.push({
      pageIndex: i - 1,
      width: viewport.width,
      height: viewport.height,
      lines,
      tables,
      charCount,
      weakTextLayer,
      thumb: canvas.toDataURL('image/jpeg', 0.65),
    });

    if (i <= 3) {
      sampleText += lines.map((l) => l.spans.map((s) => s.text).join(' ')).join('\n') + '\n';
    }
  }

  const weakRatio = pageCount > 0 ? weakPages / pageCount : 1;
  const docType: PdfProfile['docType'] =
    weakRatio > 0.8 ? 'scanned' : weakRatio > 0.2 ? 'mixed' : 'digital';

  const gov = detectGovPreset(sampleText);
  const languages = detectScripts(sampleText);
  const columnCount = detectColumns(pages[0]?.lines ?? []);

  const recommendedOcrLangs = gov?.ocrLangs ?? (languages.includes('Bengali') ? 'ben+eng' : languages.includes('Hindi') ? 'hin+eng' : 'eng');

  return {
    pageCount,
    encrypted,
    docType,
    tablesDetected: totalTables,
    imageCount: weakPages,
    columnCount,
    languages,
    recommendedMode: pickMode(weakRatio, totalTables, !!gov),
    recommendedOcrLangs,
    govPresetSuggestion: gov?.id ?? null,
    pages,
    sampleText,
  };
}

export function parsePageRange(spec: string, total: number): number[] {
  const trimmed = spec.trim();
  if (!trimmed || trimmed.toLowerCase() === 'all') {
    return Array.from({ length: total }, (_, i) => i);
  }
  const set = new Set<number>();
  for (const part of trimmed.split(',')) {
    const p = part.trim();
    if (!p) continue;
    if (p.includes('-')) {
      const [a, b] = p.split('-').map((x) => parseInt(x.trim(), 10));
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
        if (i >= 1 && i <= total) set.add(i - 1);
      }
    } else {
      const n = parseInt(p, 10);
      if (n >= 1 && n <= total) set.add(n - 1);
    }
  }
  return [...set].sort((a, b) => a - b);
}
