'use client';

import { useState } from 'react';
import type { Tool } from '@/data/tools';
import { FileDrop, Processing, ErrorBox, OutputBlock, useToolPhase } from '../shared';
import { renderPdfPages } from '@/lib/pdf';
import { hasBengaliText, restoreBengaliText } from '@/lib/text-restore';
import { normalizeIndicPage } from '@/lib/indic-normalize';
import Icon from '../../Icon';

export default function OcrRunner({ tool }: { tool: Tool }) {
  const { phase, setPhase, error, fail, reset, progress, setProgress } = useToolPhase();
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState('');
  const [lang, setLang] = useState('eng');
  const [status, setStatus] = useState('Recognizing text...');
  const [aiFix, setAiFix] = useState(true);
  const [fixing, setFixing] = useState(false);

  const run = async () => {
    const file = files[0];
    if (!file) return;
    setPhase('working');
    try {
      setStatus('Loading OCR engine...');
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker(lang, 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setProgress(m.progress);
        },
      });

      let result = '';
      if (tool.mode === 'pdf') {
        setStatus('Rendering PDF pages...');
        const pages = await renderPdfPages(file, 2);
        for (let i = 0; i < pages.length; i++) {
          setStatus(`OCR page ${i + 1} of ${pages.length}...`);
          const { data } = await worker.recognize(pages[i].canvas);
          result += `--- Page ${i + 1} ---\n${data.text}\n\n`;
        }
      } else {
        setStatus('Recognizing text...');
        const { data } = await worker.recognize(file);
        result = data.text;
      }
      await worker.terminate();
      // Deterministic Unicode normalization always runs (fixes vowel order /
      // conjuncts even when AI repair is off or unavailable).
      let finalText = normalizeIndicPage(result.trim());
      if (finalText && aiFix && hasBengaliText(finalText)) {
        setStatus('Fixing Bengali text with AI...');
        try {
          finalText = await restoreBengaliText(finalText, (d, t) => setProgress(d / t));
        } catch {
          /* keep raw OCR text if AI repair is unavailable */
        }
      }
      setText(finalText || '(No text detected)');
      setPhase('done');
    } catch (e) {
      fail(e);
    }
  };

  const resetAll = () => { reset(); setFiles([]); setText(''); };

  if (phase === 'working') return <Processing label={status} progress={progress} />;
  if (phase === 'done') {
    return (
      <div className="result-box">
        <span className="result-badge"><Icon name="check-circle" size={16} /> Text extracted</span>
        <OutputBlock text={text} filename="extracted-text.txt" />
        {hasBengaliText(text) && (
          <button
            className="btn btn-ghost"
            disabled={fixing}
            onClick={async () => {
              setFixing(true);
              try { setText(await restoreBengaliText(text)); } catch { /* keep as-is */ }
              setFixing(false);
            }}
          >
            <Icon name="sparkles" size={15} /> {fixing ? 'Fixing…' : 'Fix Bengali Text with AI'}
          </button>
        )}
        <button className="btn btn-ghost" onClick={resetAll}><Icon name="refresh" size={15} /> Process Another File</button>
      </div>
    );
  }

  return (
    <div className="workspace-grid">
      <div><FileDrop accept={tool.accept} files={files} onFiles={setFiles} /></div>
      <div className="options-panel">
        <h3>Options</h3>
        <div className="field">
          <label>Language</label>
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="eng">English</option>
            <option value="hin">Hindi</option>
            <option value="ben">Bengali</option>
            <option value="spa">Spanish</option>
            <option value="fra">French</option>
            <option value="deu">German</option>
            <option value="ara">Arabic</option>
            <option value="chi_sim">Chinese (Simplified)</option>
          </select>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={aiFix} onChange={(e) => setAiFix(e.target.checked)} />
          AI Bengali text repair — ভাঙা কার/যুক্তাক্ষর ঠিক করুন
        </label>
        <p className="muted" style={{ fontSize: 13 }}>OCR runs 100% in your browser — files never leave your device. First run downloads the language model.</p>
        {phase === 'error' && <ErrorBox message={error} onRetry={reset} />}
        <button className="btn btn-primary" disabled={files.length === 0} onClick={() => void run()}>Extract Text</button>
      </div>
    </div>
  );
}
