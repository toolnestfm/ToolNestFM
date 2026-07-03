'use client';

import { useState, useCallback, useMemo } from 'react';
import type { Tool } from '@/data/tools';
import { FileDrop, Processing, ErrorBox, ResultView, useToolPhase, type ResultFile } from '../shared';
import { extractPdfText, renderPdfPages } from '@/lib/pdf';
import { canvasToBlob } from '@/lib/image';
import { replaceExt, formatBytes } from '@/lib/download';
import Icon from '@/components/Icon';

type SourceFormat = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'pptx' | 'jpg' | 'png' | 'txt' | 'html' | 'md' | 'unknown';
type TargetFormat = 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'jpg' | 'png' | 'txt' | 'html' | 'md' | 'csv';

interface ConversionOptions {
  preserveLayout: boolean;
  detectTables: boolean;
  dpi: 72 | 150 | 300;
  outputMode: 'zip' | 'merged';
  includePageNumbers: boolean;
  pageSize: 'a4' | 'letter' | 'auto';
  orientation: 'portrait' | 'landscape';
  margins: 'none' | 'normal' | 'wide';
  pageRange: string;
}

const FORMAT_LABELS: Record<TargetFormat, string> = {
  pdf: 'PDF',
  docx: 'Word (.docx)',
  xlsx: 'Excel (.xlsx)',
  pptx: 'PowerPoint (.pptx)',
  jpg: 'JPG Image',
  png: 'PNG Image',
  txt: 'Plain Text',
  html: 'HTML',
  md: 'Markdown',
  csv: 'CSV',
};

const FORMAT_ICONS: Record<TargetFormat, string> = {
  pdf: 'file-text',
  docx: 'file-text',
  xlsx: 'table',
  pptx: 'presentation',
  jpg: 'image',
  png: 'image',
  txt: 'type',
  html: 'code',
  md: 'type',
  csv: 'table',
};

const PDF_TARGETS: TargetFormat[] = ['docx', 'xlsx', 'pptx', 'jpg', 'png', 'txt', 'html', 'md', 'csv'];
const TO_PDF_SOURCES: SourceFormat[] = ['docx', 'xlsx', 'csv', 'pptx', 'jpg', 'png', 'txt', 'html', 'md'];

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

function getValidTargets(source: SourceFormat): TargetFormat[] {
  if (source === 'pdf') return PDF_TARGETS;
  if (TO_PDF_SOURCES.includes(source)) return ['pdf'];
  return ['pdf'];
}

const DEFAULT_OPTIONS: ConversionOptions = {
  preserveLayout: true,
  detectTables: true,
  dpi: 150,
  outputMode: 'zip',
  includePageNumbers: false,
  pageSize: 'a4',
  orientation: 'portrait',
  margins: 'normal',
  pageRange: '',
};

export default function PdfConverterAdvanced({ tool }: { tool: Tool }) {
  const { phase, setPhase, error, fail, reset, progress, setProgress } = useToolPhase();
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ResultFile[]>([]);
  const [status, setStatus] = useState('Converting...');
  const [detectedFormat, setDetectedFormat] = useState<SourceFormat | null>(null);
  const [targetFormat, setTargetFormat] = useState<TargetFormat | null>(null);
  const [options, setOptions] = useState<ConversionOptions>(DEFAULT_OPTIONS);
  const [fileInfo, setFileInfo] = useState<{ pages?: number; size: number } | null>(null);

  const validTargets = useMemo(() => {
    if (!detectedFormat) return [];
    return getValidTargets(detectedFormat);
  }, [detectedFormat]);

  const handleFiles = useCallback((incoming: File[]) => {
    setFiles(incoming);
    if (incoming.length > 0) {
      const fmt = detectFormat(incoming[0]);
      setDetectedFormat(fmt);
      setFileInfo({ size: incoming[0].size });

      const targets = getValidTargets(fmt);
      if (targets.length === 1) {
        setTargetFormat(targets[0]);
      } else {
        setTargetFormat(null);
      }
    } else {
      setDetectedFormat(null);
      setTargetFormat(null);
      setFileInfo(null);
    }
  }, []);

  const updateOption = <K extends keyof ConversionOptions>(key: K, value: ConversionOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const convert = async () => {
    if (!files.length || !targetFormat || !detectedFormat) return;
    setPhase('working');
    setProgress(0);

    try {
      const file = files[0];
      const out: ResultFile[] = [];

      if (detectedFormat === 'pdf' && targetFormat === 'docx') {
        setStatus('Extracting text from PDF...');
        const pages = await extractPdfText(file, (d, t) => setProgress((d / t) * 0.7));
        setStatus('Building Word document...');
        const { Document, Packer, Paragraph, TextRun, PageBreak } = await import('docx');
        const children = pages.flatMap((pageText, pi) => {
          const paras = pageText.split('\n').filter(Boolean).map(
            (line) => new Paragraph({ children: [new TextRun({ text: line, size: 22 })], spacing: { after: 120 } }),
          );
          if (pi < pages.length - 1) paras.push(new Paragraph({ children: [new PageBreak()] }));
          return paras;
        });
        const doc = new Document({ sections: [{ children }] });
        const blob = await Packer.toBlob(doc);
        setProgress(1);
        out.push({ name: replaceExt(file.name, 'docx'), blob });

      } else if (detectedFormat === 'pdf' && targetFormat === 'xlsx') {
        setStatus('Extracting tables from PDF...');
        const pages = await extractPdfText(file, (d, t) => setProgress((d / t) * 0.7));
        setStatus('Building Excel workbook...');
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        pages.forEach((pageText, i) => {
          const rows = pageText.split('\n').map((line) => line.split(/\s{2,}|\t/).map((c) => c.trim())).filter((r) => r.some(Boolean));
          const ws = XLSX.utils.aoa_to_sheet(rows.length ? rows : [['']]);
          XLSX.utils.book_append_sheet(wb, ws, `Page ${i + 1}`);
        });
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
        setProgress(1);
        out.push({ name: replaceExt(file.name, 'xlsx'), blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) });

      } else if (detectedFormat === 'pdf' && targetFormat === 'csv') {
        setStatus('Extracting text data from PDF...');
        const pages = await extractPdfText(file, (d, t) => setProgress((d / t) * 0.8));
        setStatus('Building CSV...');
        const csvLines = pages.flatMap((p) =>
          p.split('\n').filter(Boolean).map((line) => {
            const cells = line.split(/\s{2,}|\t/).map((c) => c.trim());
            return cells.map((c) => c.includes(',') ? `"${c}"` : c).join(',');
          }),
        );
        const csvBlob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
        setProgress(1);
        out.push({ name: replaceExt(file.name, 'csv'), blob: csvBlob });

      } else if (detectedFormat === 'pdf' && targetFormat === 'pptx') {
        setStatus('Rendering PDF pages...');
        const renderedPages = await renderPdfPages(file, 2, (d, t) => setProgress((d / t) * 0.6));
        setStatus('Building PowerPoint presentation...');
        const pptxgenjs = (await import('pptxgenjs')).default;
        const pptx = new pptxgenjs();
        for (let i = 0; i < renderedPages.length; i++) {
          const slide = pptx.addSlide();
          const blob = await canvasToBlob(renderedPages[i].canvas, 'image/png');
          const base64 = await blobToBase64(blob);
          slide.addImage({ data: base64, x: 0, y: 0, w: '100%', h: '100%' });
          setProgress(0.6 + ((i + 1) / renderedPages.length) * 0.4);
        }
        const pptxBlob = await pptx.write({ outputType: 'blob' }) as Blob;
        out.push({ name: replaceExt(file.name, 'pptx'), blob: pptxBlob });

      } else if (detectedFormat === 'pdf' && (targetFormat === 'jpg' || targetFormat === 'png')) {
        const scale = options.dpi === 72 ? 1 : options.dpi === 150 ? 2 : 4;
        const imgType = targetFormat === 'jpg' ? 'image/jpeg' : 'image/png';
        setStatus(`Rendering PDF pages at ${options.dpi} DPI...`);
        const pages = await renderPdfPages(file, scale, (d, t) => setProgress((d / t) * 0.7));

        if (options.outputMode === 'merged' && pages.length > 1) {
          setStatus('Merging pages into one image...');
          const totalH = pages.reduce((s, p) => s + p.height, 0);
          const maxW = Math.max(...pages.map((p) => p.width));
          const canvas = document.createElement('canvas');
          canvas.width = maxW;
          canvas.height = totalH;
          const ctx = canvas.getContext('2d')!;
          let y = 0;
          for (const p of pages) { ctx.drawImage(p.canvas, 0, y); y += p.height; }
          const blob = await canvasToBlob(canvas, imgType, 0.92);
          out.push({ name: replaceExt(file.name, targetFormat), blob });
        } else {
          setStatus('Packing pages into ZIP...');
          const JSZip = (await import('jszip')).default;
          const zip = new JSZip();
          for (let i = 0; i < pages.length; i++) {
            const blob = await canvasToBlob(pages[i].canvas, imgType, 0.92);
            zip.file(`page-${i + 1}.${targetFormat}`, blob);
            setProgress(0.7 + ((i + 1) / pages.length) * 0.3);
          }
          out.push({ name: replaceExt(file.name, 'zip'), blob: await zip.generateAsync({ type: 'blob' }) });
        }

      } else if (detectedFormat === 'pdf' && targetFormat === 'txt') {
        setStatus('Extracting text from PDF...');
        const pages = await extractPdfText(file, (d, t) => setProgress(d / t));
        const sep = options.includePageNumbers
          ? pages.map((p, i) => `--- Page ${i + 1} ---\n${p}`).join('\n\n')
          : pages.join('\n\n');
        out.push({ name: replaceExt(file.name, 'txt'), blob: new Blob([sep], { type: 'text/plain' }) });

      } else if (detectedFormat === 'pdf' && targetFormat === 'md') {
        setStatus('Extracting text as Markdown...');
        const pages = await extractPdfText(file, (d, t) => setProgress(d / t));
        const md = pages.map((p, i) => {
          const lines = p.split('\n');
          const formatted = lines.map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return '';
            if (trimmed.length < 60 && trimmed === trimmed.toUpperCase() && trimmed.length > 3) return `## ${trimmed}`;
            return trimmed;
          }).join('\n');
          return options.includePageNumbers ? `---\n### Page ${i + 1}\n\n${formatted}` : formatted;
        }).join('\n\n');
        out.push({ name: replaceExt(file.name, 'md'), blob: new Blob([md], { type: 'text/markdown' }) });

      } else if (detectedFormat === 'pdf' && targetFormat === 'html') {
        setStatus('Converting PDF to HTML...');
        const pages = await extractPdfText(file, (d, t) => setProgress(d / t));
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${file.name}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6}
.page{margin-bottom:2em;padding-bottom:1em;border-bottom:1px solid #eee}h2{color:#333}</style></head>
<body>
${pages.map((p, i) => `<div class="page"><h2>Page ${i + 1}</h2>${p.split('\n').map((l) => `<p>${l || '&nbsp;'}</p>`).join('\n')}</div>`).join('\n')}
</body></html>`;
        out.push({ name: replaceExt(file.name, 'html'), blob: new Blob([htmlContent], { type: 'text/html' }) });

      } else if (detectedFormat === 'docx' && targetFormat === 'pdf') {
        setStatus('Reading Word document...');
        setProgress(0.2);
        const mammoth = await import('mammoth');
        const { value: text } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        setStatus('Building PDF...');
        setProgress(0.5);
        const { PDFDocument, StandardFonts } = await import('@cantoo/pdf-lib');
        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const fontSize = 11;
        const lineHeight = 16;
        const marginVal = options.margins === 'none' ? 20 : options.margins === 'wide' ? 72 : 50;
        const pageW = options.pageSize === 'letter' ? 612 : 595.28;
        const pageH = options.pageSize === 'letter' ? 792 : 841.89;
        const maxWidth = pageW - marginVal * 2;
        const paragraphs = text.split('\n');
        const lines: string[] = [];
        for (const para of paragraphs) {
          if (!para.trim()) { lines.push(''); continue; }
          let current = '';
          for (const word of para.split(/\s+/)) {
            const safeWord = word.replace(/[^\x20-\x7E]/g, '?');
            const attempt = current ? `${current} ${safeWord}` : safeWord;
            if (font.widthOfTextAtSize(attempt, fontSize) > maxWidth && current) {
              lines.push(current);
              current = safeWord;
            } else {
              current = attempt;
            }
          }
          if (current) lines.push(current);
        }
        let page = doc.addPage([pageW, pageH]);
        let y = pageH - marginVal;
        for (const line of lines) {
          if (y < marginVal) { page = doc.addPage([pageW, pageH]); y = pageH - marginVal; }
          if (line) page.drawText(line, { x: marginVal, y, size: fontSize, font });
          y -= lineHeight;
        }
        setProgress(1);
        out.push({ name: replaceExt(file.name, 'pdf'), blob: new Blob([new Uint8Array(await doc.save())], { type: 'application/pdf' }) });

      } else if ((detectedFormat === 'xlsx' || detectedFormat === 'csv') && targetFormat === 'pdf') {
        setStatus('Reading spreadsheet...');
        setProgress(0.2);
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        setStatus('Building PDF...');
        setProgress(0.5);
        const { PDFDocument, StandardFonts, rgb } = await import('@cantoo/pdf-lib');
        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const bold = await doc.embedFont(StandardFonts.HelveticaBold);
        const isLandscape = options.orientation === 'landscape';
        const pageW = isLandscape ? 841.89 : 595.28;
        const pageH = isLandscape ? 595.28 : 841.89;
        for (const sheetName of wb.SheetNames) {
          const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], { header: 1, raw: false, defval: '' }) as unknown as string[][];
          let page = doc.addPage([pageW, pageH]);
          let y = pageH - 40;
          page.drawText(sheetName, { x: 40, y, size: 14, font: bold, color: rgb(0.3, 0.15, 0.7) });
          y -= 24;
          const colW = Math.max(60, (pageW - 80) / Math.max(1, rows[0]?.length || 1));
          for (const row of rows) {
            if (y < 40) { page = doc.addPage([pageW, pageH]); y = pageH - 40; }
            row.forEach((cell, ci) => {
              const textVal = String(cell ?? '').replace(/[^\x20-\x7E]/g, '?').slice(0, Math.floor(colW / 5));
              if (textVal) page.drawText(textVal, { x: 40 + ci * colW, y, size: 8, font });
            });
            y -= 13;
          }
        }
        setProgress(1);
        out.push({ name: replaceExt(file.name, 'pdf'), blob: new Blob([new Uint8Array(await doc.save())], { type: 'application/pdf' }) });

      } else if ((detectedFormat === 'jpg' || detectedFormat === 'png') && targetFormat === 'pdf') {
        setStatus('Building PDF from images...');
        const { PDFDocument } = await import('@cantoo/pdf-lib');
        const doc = await PDFDocument.create();
        const imgs = files.filter((f) => f.type.startsWith('image/'));
        if (imgs.length === 0) throw new Error('No image files found.');
        for (let i = 0; i < imgs.length; i++) {
          const bytes = await imgs[i].arrayBuffer();
          const embedded = imgs[i].type === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          const pageW = options.pageSize === 'auto' ? embedded.width : (options.pageSize === 'letter' ? 612 : 595.28);
          const pageH = options.pageSize === 'auto' ? embedded.height : (options.pageSize === 'letter' ? 792 : 841.89);
          const page = doc.addPage([pageW, pageH]);
          if (options.pageSize === 'auto') {
            page.drawImage(embedded, { x: 0, y: 0, width: pageW, height: pageH });
          } else {
            const margin = options.margins === 'none' ? 0 : options.margins === 'wide' ? 72 : 36;
            const s = Math.min((pageW - margin * 2) / embedded.width, (pageH - margin * 2) / embedded.height);
            const w = embedded.width * s;
            const h = embedded.height * s;
            page.drawImage(embedded, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
          }
          setProgress((i + 1) / imgs.length);
        }
        out.push({ name: 'converted.pdf', blob: new Blob([new Uint8Array(await doc.save())], { type: 'application/pdf' }) });

      } else if ((detectedFormat === 'txt' || detectedFormat === 'md' || detectedFormat === 'html') && targetFormat === 'pdf') {
        setStatus('Reading text content...');
        setProgress(0.3);
        const text = await file.text();
        setStatus('Building PDF...');
        const { PDFDocument, StandardFonts } = await import('@cantoo/pdf-lib');
        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const fontSize = 11;
        const lineHeight = 15;
        const marginVal = options.margins === 'none' ? 20 : options.margins === 'wide' ? 72 : 50;
        const pageW = options.pageSize === 'letter' ? 612 : 595.28;
        const pageH = options.pageSize === 'letter' ? 792 : 841.89;
        const maxWidth = pageW - marginVal * 2;
        const rawLines = text.split('\n');
        const wrappedLines: string[] = [];
        for (const raw of rawLines) {
          const clean = raw.replace(/[#*_~`>]/g, '').trim();
          if (!clean) { wrappedLines.push(''); continue; }
          let current = '';
          for (const word of clean.split(/\s+/)) {
            const safe = word.replace(/[^\x20-\x7E]/g, '?');
            const attempt = current ? `${current} ${safe}` : safe;
            if (font.widthOfTextAtSize(attempt, fontSize) > maxWidth && current) {
              wrappedLines.push(current);
              current = safe;
            } else {
              current = attempt;
            }
          }
          if (current) wrappedLines.push(current);
        }
        let page = doc.addPage([pageW, pageH]);
        let y = pageH - marginVal;
        for (const line of wrappedLines) {
          if (y < marginVal) { page = doc.addPage([pageW, pageH]); y = pageH - marginVal; }
          if (line) page.drawText(line, { x: marginVal, y, size: fontSize, font });
          y -= lineHeight;
        }
        setProgress(1);
        out.push({ name: replaceExt(file.name, 'pdf'), blob: new Blob([new Uint8Array(await doc.save())], { type: 'application/pdf' }) });

      } else {
        throw new Error(`Conversion from ${detectedFormat?.toUpperCase()} to ${targetFormat?.toUpperCase()} is not yet supported.`);
      }

      setResults(out);
      setPhase('done');
    } catch (e) {
      fail(e);
    }
  };

  const resetAll = () => {
    reset();
    setFiles([]);
    setResults([]);
    setDetectedFormat(null);
    setTargetFormat(null);
    setFileInfo(null);
    setOptions(DEFAULT_OPTIONS);
  };

  if (phase === 'working') return <Processing label={status} progress={progress} />;

  if (phase === 'done') {
    const before = files.reduce((s, f) => s + f.size, 0);
    const after = results.reduce((s, f) => s + f.blob.size, 0);
    return (
      <ResultView files={results} before={before} after={after} onReset={resetAll}>
        {targetFormat && detectedFormat === 'pdf' && validTargets.length > 1 && (
          <button
            className="btn btn-ghost"
            style={{ marginTop: 8 }}
            onClick={() => { setResults([]); setPhase('idle'); setTargetFormat(null); }}
          >
            <Icon name="refresh" size={15} /> Convert to Another Format
          </button>
        )}
      </ResultView>
    );
  }

  return (
    <div className="pdf-converter-workspace">
      {/* Left: Upload + Format Detection */}
      <div className="pdf-converter-main">
        <FileDrop
          accept={tool.accept}
          multiple={detectedFormat === 'jpg' || detectedFormat === 'png'}
          files={files}
          onFiles={handleFiles}
          hint="Supports: PDF, DOCX, XLSX, PPTX, JPG, PNG, TXT, HTML, CSV, MD — up to 25MB (Free) / 2GB (Pro)"
        />

        {detectedFormat && fileInfo && (
          <div className="format-detected glass">
            <div className="format-detected-badge">
              <Icon name={FORMAT_ICONS[detectedFormat as TargetFormat] || 'file-text'} size={18} />
              <span className="format-tag">{detectedFormat.toUpperCase()} detected</span>
              <span className="muted">{formatBytes(fileInfo.size)}</span>
            </div>
          </div>
        )}

        {detectedFormat && validTargets.length > 0 && (
          <div className="target-selector">
            <h3>
              {detectedFormat === 'pdf' ? 'Convert PDF to:' : `Convert ${detectedFormat.toUpperCase()} to:`}
            </h3>
            <div className="target-chips">
              {validTargets.map((t) => (
                <button
                  key={t}
                  className={`target-chip ${targetFormat === t ? 'active' : ''}`}
                  onClick={() => setTargetFormat(t)}
                >
                  <Icon name={FORMAT_ICONS[t]} size={16} />
                  {FORMAT_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'error' && <ErrorBox message={error} onRetry={reset} />}
      </div>

      {/* Right: Options + CTA */}
      <div className="pdf-converter-options">
        <h3>Conversion Options</h3>

        {!detectedFormat && (
          <p className="muted" style={{ fontSize: 13 }}>Upload a file to see available options.</p>
        )}

        {detectedFormat && !targetFormat && validTargets.length > 1 && (
          <p className="muted" style={{ fontSize: 13 }}>Select a target format to configure options.</p>
        )}

        {targetFormat && detectedFormat === 'pdf' && targetFormat === 'docx' && (
          <>
            <label className="checkbox-row">
              <input type="checkbox" checked={options.preserveLayout} onChange={(e) => updateOption('preserveLayout', e.target.checked)} />
              Preserve layout (best for visual docs)
            </label>
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Text-based PDFs convert best. For scanned PDFs, try PDF OCR first.
            </p>
          </>
        )}

        {targetFormat && detectedFormat === 'pdf' && (targetFormat === 'xlsx' || targetFormat === 'csv') && (
          <>
            <label className="checkbox-row">
              <input type="checkbox" checked={options.detectTables} onChange={(e) => updateOption('detectTables', e.target.checked)} />
              Detect tables automatically
            </label>
            <div className="field">
              <label>Page range (optional)</label>
              <input
                placeholder="e.g. 1-5, 8, 10-12 (leave blank for all)"
                value={options.pageRange}
                onChange={(e) => updateOption('pageRange', e.target.value)}
              />
            </div>
          </>
        )}

        {targetFormat && detectedFormat === 'pdf' && (targetFormat === 'jpg' || targetFormat === 'png') && (
          <>
            <div className="field">
              <label>DPI (Resolution)</label>
              <select value={options.dpi} onChange={(e) => updateOption('dpi', +e.target.value as 72 | 150 | 300)}>
                <option value={72}>72 DPI (web, small file)</option>
                <option value={150}>150 DPI (standard)</option>
                <option value={300}>300 DPI (print quality)</option>
              </select>
            </div>
            <div className="field">
              <label>Output mode</label>
              <select value={options.outputMode} onChange={(e) => updateOption('outputMode', e.target.value as 'zip' | 'merged')}>
                <option value="zip">ZIP of individual pages</option>
                <option value="merged">Merged long image</option>
              </select>
            </div>
          </>
        )}

        {targetFormat && detectedFormat === 'pdf' && (targetFormat === 'txt' || targetFormat === 'md') && (
          <label className="checkbox-row">
            <input type="checkbox" checked={options.includePageNumbers} onChange={(e) => updateOption('includePageNumbers', e.target.checked)} />
            Include page separators
          </label>
        )}

        {targetFormat === 'pdf' && detectedFormat !== 'pdf' && (
          <>
            <div className="field">
              <label>Page size</label>
              <select value={options.pageSize} onChange={(e) => updateOption('pageSize', e.target.value as 'a4' | 'letter' | 'auto')}>
                <option value="a4">A4</option>
                <option value="letter">Letter (US)</option>
                <option value="auto">Auto (fit to content)</option>
              </select>
            </div>
            {(detectedFormat === 'xlsx' || detectedFormat === 'csv') && (
              <div className="field">
                <label>Orientation</label>
                <select value={options.orientation} onChange={(e) => updateOption('orientation', e.target.value as 'portrait' | 'landscape')}>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            )}
            <div className="field">
              <label>Margins</label>
              <select value={options.margins} onChange={(e) => updateOption('margins', e.target.value as 'none' | 'normal' | 'wide')}>
                <option value="none">None</option>
                <option value="normal">Normal</option>
                <option value="wide">Wide</option>
              </select>
            </div>
          </>
        )}

        <button
          className="btn btn-primary"
          disabled={!files.length || !targetFormat}
          onClick={() => void convert()}
          style={{ marginTop: 16 }}
        >
          <Icon name="zap" size={16} />
          {targetFormat ? `Convert to ${FORMAT_LABELS[targetFormat]} →` : 'Select a target format'}
        </button>

        {detectedFormat && targetFormat && (
          <p className="muted" style={{ fontSize: 11, marginTop: 8, textAlign: 'center' }}>
            100% browser-based · No server upload · Files never leave your device
          </p>
        )}
      </div>
    </div>
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}
