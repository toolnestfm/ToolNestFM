'use client';

import { useState } from 'react';
import type { Tool } from '@/data/tools';
import { FileDrop, Processing, ErrorBox, ResultView, useToolPhase, type ResultFile } from '../shared';
import { extractPdfText } from '@/lib/pdf';
import { extractPdfTextSmart } from '@/lib/pdf-smart-text';
import { replaceExt } from '@/lib/download';
import { looksBrokenBengali, restoreBengaliText } from '@/lib/text-restore';

export default function PdfConvertRunner({ tool }: { tool: Tool }) {
  const { phase, setPhase, error, fail, reset, progress, setProgress } = useToolPhase();
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ResultFile[]>([]);
  const [status, setStatus] = useState('Converting...');
  const [aiFix, setAiFix] = useState(true);

  const mode = tool.mode;

  /** AI-repair shattered Bengali text page-by-page (PDF text layers break Indic scripts).
   *  Fail-soft: any AI failure keeps that page's original text — conversion never aborts. */
  const repairPages = async (pages: string[]): Promise<string[]> => {
    if (!aiFix || !pages.some((p) => looksBrokenBengali(p))) return pages;
    const fixed: string[] = [];
    for (let i = 0; i < pages.length; i++) {
      setStatus(`Fixing Bengali text with AI (page ${i + 1}/${pages.length})...`);
      setProgress(0.7 + ((i + 1) / pages.length) * 0.25);
      if (!looksBrokenBengali(pages[i])) {
        fixed.push(pages[i]);
        continue;
      }
      try {
        const repaired = await restoreBengaliText(pages[i]);
        fixed.push(repaired.trim() ? repaired : pages[i]);
      } catch {
        fixed.push(pages[i]);
      }
    }
    return fixed;
  };

  const run = async () => {
    const file = files[0];
    if (!file) return;
    setPhase('working');
    try {
      const out: ResultFile[] = [];

      if (mode === 'pdf2word') {
        setStatus('Extracting text from PDF...');
        const { pages: rawPages, usedOcr } = await extractPdfTextSmart(file, (d, t, stage) => {
          if (stage === 'ocr') setStatus(`Running OCR on page ${d}/${t} (scanned PDF)...`);
          setProgress((d / t) * 0.7);
        });
        if (!rawPages.some((p) => p.trim())) {
          throw new Error('No readable text found in this PDF, even with OCR. The scan quality may be too low.');
        }
        if (usedOcr) setStatus('OCR complete — building document...');
        const pages = await repairPages(rawPages);
        setStatus('Building Word document...');
        const { Document, Packer, Paragraph, TextRun, PageBreak } = await import('docx');
        const children = pages.flatMap((pageText, pi) => {
          const paras = pageText.split('\n').map(
            (line) => new Paragraph({ children: [new TextRun({ text: line, size: 22 })], spacing: { after: 120 } }),
          );
          if (pi < pages.length - 1) paras.push(new Paragraph({ children: [new PageBreak()] }));
          return paras;
        });
        const doc = new Document({ sections: [{ children }] });
        const blob = await Packer.toBlob(doc);
        out.push({ name: replaceExt(file.name, 'docx'), blob });
      } else if (mode === 'pdf2excel') {
        setStatus('Extracting tables from PDF...');
        const pages = await extractPdfText(file, (d, t) => setProgress((d / t) * 0.7));
        setStatus('Building Excel workbook...');
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        pages.forEach((pageText, i) => {
          const rows = pageText.split('\n').map((line) => line.split(/\s{2,}|\t/).map((c) => c.trim()));
          const ws = XLSX.utils.aoa_to_sheet(rows.length ? rows : [['']]);
          XLSX.utils.book_append_sheet(wb, ws, `Page ${i + 1}`);
        });
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
        out.push({ name: replaceExt(file.name, 'xlsx'), blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) });
      } else if (mode === 'word2pdf') {
        setStatus('Reading Word document...');
        const mammoth = await import('mammoth');
        const { value: text } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        setStatus('Building PDF...');
        const { PDFDocument, StandardFonts } = await import('@cantoo/pdf-lib');
        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const fontSize = 11;
        const lineHeight = 16;
        const margin = 50;
        const pageW = 595.28;
        const pageH = 841.89;
        const maxWidth = pageW - margin * 2;
        // naive word wrap
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
          lines.push(current);
        }
        let page = doc.addPage([pageW, pageH]);
        let y = pageH - margin;
        for (const line of lines) {
          if (y < margin) { page = doc.addPage([pageW, pageH]); y = pageH - margin; }
          if (line) page.drawText(line, { x: margin, y, size: fontSize, font });
          y -= lineHeight;
        }
        out.push({ name: replaceExt(file.name, 'pdf'), blob: new Blob([new Uint8Array(await doc.save())], { type: 'application/pdf' }) });
      } else if (mode === 'excel2pdf') {
        setStatus('Reading spreadsheet...');
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        setStatus('Building PDF...');
        const { PDFDocument, StandardFonts, rgb } = await import('@cantoo/pdf-lib');
        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const bold = await doc.embedFont(StandardFonts.HelveticaBold);
        for (const sheetName of wb.SheetNames) {
          const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], { header: 1, raw: false, defval: '' }) as unknown as string[][];
          const pageW = 841.89;
          const pageH = 595.28; // landscape A4
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
        out.push({ name: replaceExt(file.name, 'pdf'), blob: new Blob([new Uint8Array(await doc.save())], { type: 'application/pdf' }) });
      } else {
        throw new Error(`Unknown mode: ${mode}`);
      }

      setResults(out);
      setPhase('done');
    } catch (e) {
      fail(e);
    }
  };

  const resetAll = () => { reset(); setFiles([]); setResults([]); };

  if (phase === 'working') return <Processing label={status} progress={progress} />;
  if (phase === 'done') return <ResultView files={results} onReset={resetAll} />;

  const notes: Record<string, string> = {
    pdf2word: 'Text-based PDFs convert best. For scanned PDFs, run PDF OCR first.',
    pdf2excel: 'Works best with table-style PDFs (bank statements, reports).',
    word2pdf: 'DOCX text content is converted; complex layouts are simplified.',
    excel2pdf: 'Each sheet becomes a landscape A4 section.',
  };

  return (
    <div className="workspace-grid">
      <div><FileDrop accept={tool.accept} files={files} onFiles={setFiles} /></div>
      <div className="options-panel">
        <h3>Options</h3>
        <p className="muted" style={{ fontSize: 13 }}>{notes[mode]}</p>
        {mode === 'pdf2word' && (
          <label className="checkbox-row">
            <input type="checkbox" checked={aiFix} onChange={(e) => setAiFix(e.target.checked)} />
            AI Bengali text repair — ভাঙা কার/যুক্তাক্ষর ঠিক করুন
          </label>
        )}
        {phase === 'error' && <ErrorBox message={error} onRetry={reset} />}
        <button className="btn btn-primary" disabled={files.length === 0} onClick={() => void run()}>Convert Now</button>
      </div>
    </div>
  );
}
