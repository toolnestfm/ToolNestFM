'use client';

import { extractPdfText, renderPdfPages } from '@/lib/pdf';
import { normalizeIndicPage } from '@/lib/indic-normalize';

/**
 * Smart PDF text extraction with OCR fallback.
 *
 * Many PDFs (scans, or files whose fonts lack toUnicode maps — common with
 * Bengali/Hindi government PDFs) have little or no usable text layer, so
 * pdfjs returns almost nothing. When the text layer looks too thin we
 * re-extract by rendering each page and running Tesseract OCR (Bengali +
 * English + Hindi are the scripts our users convert most).
 */

const MIN_CHARS_PER_PAGE = 40;

export function textLayerLooksWeak(pages: string[]): boolean {
  if (pages.length === 0) return true;
  const total = pages.reduce((n, p) => n + p.replace(/\s+/g, '').length, 0);
  return total / pages.length < MIN_CHARS_PER_PAGE;
}

export async function ocrPdfPages(
  file: File,
  onProgress?: (done: number, total: number) => void,
  langs = 'ben+eng',
): Promise<string[]> {
  const rendered = await renderPdfPages(file, 2);
  const Tesseract = await import('tesseract.js');
  const worker = await Tesseract.createWorker(langs, 1);
  const pages: string[] = [];
  try {
    for (let i = 0; i < rendered.length; i++) {
      const { data } = await worker.recognize(rendered[i].canvas);
      pages.push(data.text.trim());
      onProgress?.(i + 1, rendered.length);
    }
  } finally {
    await worker.terminate();
  }
  return pages;
}

export interface SmartExtractResult {
  pages: string[];
  usedOcr: boolean;
}

/**
 * Extract text from every page; falls back to OCR when the text layer is
 * missing or too thin to be the real content.
 */
export async function extractPdfTextSmart(
  file: File,
  onProgress?: (done: number, total: number, stage: 'text' | 'ocr') => void,
): Promise<SmartExtractResult> {
  const rawPages = await extractPdfText(file, (d, t) => onProgress?.(d, t, 'text'));
  const pages = rawPages.map(normalizeIndicPage);
  if (!textLayerLooksWeak(pages)) return { pages, usedOcr: false };

  const ocrPages = (await ocrPdfPages(file, (d, t) => onProgress?.(d, t, 'ocr'))).map(normalizeIndicPage);
  // Prefer whichever source produced more content per page.
  const merged = ocrPages.map((ocr, i) => {
    const layer = pages[i] ?? '';
    return ocr.replace(/\s+/g, '').length >= layer.replace(/\s+/g, '').length ? ocr : layer;
  });
  return { pages: merged, usedOcr: true };
}
