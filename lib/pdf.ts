'use client';

/** Universal PDF Engine helpers (pdfjs-dist for rendering). */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfJs = any;

let pdfjsPromise: Promise<PdfJs> | null = null;

export function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export async function renderPdfPages(
  file: File,
  scale = 1.5,
  onProgress?: (done: number, total: number) => void,
  password?: string,
): Promise<RenderedPage[]> {
  const pdfjs = await loadPdfJs();
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data, password: password || undefined }).promise;
  const pages: RenderedPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push({ canvas, width: viewport.width, height: viewport.height });
    onProgress?.(i, doc.numPages);
  }
  return pages;
}

export async function extractPdfText(file: File, onProgress?: (done: number, total: number) => void): Promise<string[]> {
  const pdfjs = await loadPdfJs();
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    interface TextItem { str: string; transform: number[] }
    const items = content.items as TextItem[];
    // Group items into lines by Y position
    const lines = new Map<number, { x: number; str: string }[]>();
    for (const it of items) {
      const y = Math.round(it.transform[5]);
      const x = it.transform[4];
      let line = lines.get(y);
      // merge lines within 3px
      if (!line) {
        for (const [ly, l] of lines) {
          if (Math.abs(ly - y) <= 3) { line = l; break; }
        }
      }
      if (!line) { line = []; lines.set(y, line); }
      line.push({ x, str: it.str });
    }
    const sorted = Array.from(lines.entries()).sort((a, b) => b[0] - a[0]);
    const text = sorted.map(([, l]) => l.sort((a, b) => a.x - b.x).map((s) => s.str).join(' ')).join('\n');
    pages.push(text);
    onProgress?.(i, doc.numPages);
  }
  return pages;
}
