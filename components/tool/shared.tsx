'use client';

import React, { useCallback, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Icon from '../Icon';
import { formatBytes } from '@/lib/download';

const ShareModal = dynamic(() => import('./ShareModal'), { ssr: false });

/* ─────────── Inline share button (secure URL + QR + Web Share) ─────────── */

export function ShareButton({ file, toolSlug }: { file: ResultFile; toolSlug?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-outline" onClick={() => setOpen(true)}>
        <Icon name="link" size={15} /> Share Link
      </button>
      {open && <ShareModal open={open} onClose={() => setOpen(false)} file={file} toolSlug={toolSlug} />}
    </>
  );
}

/* ─────────── Universal Upload Engine UI ─────────── */

export interface FileDropProps {
  accept?: string;
  multiple?: boolean;
  files: File[];
  onFiles: (files: File[]) => void;
  hint?: string;
}

/** Does a file match an HTML accept string (.ext, type/*, exact mime)? */
export function fileMatchesAccept(file: File, accept?: string): boolean {
  if (!accept?.trim()) return true;
  const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
  const mime = file.type.toLowerCase();
  return accept.split(',').some((raw) => {
    const t = raw.trim().toLowerCase();
    if (!t) return false;
    if (t.endsWith('/*')) return mime.startsWith(t.slice(0, -1));
    if (t.startsWith('.')) return ext === t;
    return mime === t;
  });
}

/** Human label + icon for an accept string — "PDF files", "Images", ... */
export function acceptKind(accept?: string): { label: string; icon: string } {
  const a = (accept ?? '').toLowerCase();
  if (!a) return { label: 'Any input', icon: 'upload' };
  const kinds: string[] = [];
  if (a.includes('pdf')) kinds.push('PDF');
  if (a.includes('image')) kinds.push('Images');
  if (a.includes('video')) kinds.push('Video');
  if (a.includes('audio')) kinds.push('Audio');
  if (/\.docx?|\.xlsx?|\.csv|\.txt|\.md|\.html/.test(a)) kinds.push('Documents');
  const label = kinds.length ? kinds.join(' · ') : accept!.toUpperCase();
  const icon =
    kinds[0] === 'PDF' ? 'file-text' :
    kinds[0] === 'Images' ? 'image' :
    kinds[0] === 'Video' ? 'video' :
    kinds[0] === 'Audio' ? 'music' : 'file-text';
  return { label, icon };
}

export function FileDrop({ accept, multiple, files, onFiles, hint }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const kind = acceptKind(accept);

  const add = useCallback(
    (incoming: FileList | File[] | null) => {
      if (!incoming) return;
      const arr = Array.from(incoming);
      const ok = arr.filter((f) => fileMatchesAccept(f, accept));
      const bad = arr.filter((f) => !fileMatchesAccept(f, accept));
      if (bad.length > 0) {
        setRejected(`${bad[0].name} — ye tool sirf ${kind.label} leta hai`);
        setTimeout(() => setRejected(null), 4000);
      }
      if (ok.length === 0) return;
      setRejected(null);
      onFiles(multiple ? [...files, ...ok] : ok.slice(0, 1));
    },
    [files, multiple, onFiles, accept, kind.label],
  );

  return (
    <div>
      <div
        className={`dropzone ${drag ? 'drag-over' : ''} ${rejected ? 'drop-rejected' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        role="button"
        tabIndex={0}
        aria-label={`Upload ${kind.label}`}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <span className="dropzone-icon"><Icon name={kind.icon} size={26} /></span>
        <b>{drag ? `Drop your ${kind.label} here` : 'Drag & drop or click to browse'}</b>
        <span className="dropzone-kind">{kind.label}{multiple ? ' · multiple files' : ''}</span>
        <span>{hint || 'Processed 100% in your browser — files kabhi upload nahi hote'}</span>
      </div>
      {rejected && (
        <p className="dropzone-error" role="alert">
          <Icon name="alert-triangle" size={13} /> {rejected}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => { add(e.target.files); e.target.value = ''; }}
      />
      <button
        className="btn btn-ghost btn-sm mt-2"
        onClick={async () => {
          try {
            const items = await navigator.clipboard.read();
            const picked: File[] = [];
            for (const item of items) {
              const type = item.types.find((t) => t.startsWith('image/') || t === 'application/pdf');
              if (!type) continue;
              const blob = await item.getType(type);
              const ext = type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
              picked.push(new File([blob], `pasted-${Date.now()}.${ext}`, { type }));
            }
            if (picked.length === 0) return;
            add(picked); // same type validation as drag & drop
          } catch {
            /* clipboard permission denied or no file content */
          }
        }}
      >
        <Icon name="copy" size={14} /> Paste from Clipboard
      </button>
      {files.length > 0 && (
        <div className="file-list">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="file-item">
              <Icon name="file-text" size={16} />
              <span className="file-name">{f.name}</span>
              <span className="file-size">{formatBytes(f.size)}</span>
              <button className="file-remove" onClick={() => onFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}>
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────── Processing / Result / Error views ─────────── */

export function Processing({ label, progress }: { label?: string; progress?: number }) {
  return (
    <div className="processing-box">
      <div className="spinner" />
      <b>{label || 'Processing your file...'}</b>
      <div className="progress-track">
        <div
          className={`progress-fill ${progress === undefined ? 'indeterminate' : ''}`}
          style={{ width: progress === undefined ? undefined : `${Math.round(progress * 100)}%` }}
        />
      </div>
      {progress !== undefined && <span className="muted mono">{Math.round(progress * 100)}%</span>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-box">
      ⚠️ {message}
      {onRetry && (
        <div className="mt-2">
          <button className="btn btn-ghost btn-sm" onClick={onRetry}>Try Again</button>
        </div>
      )}
    </div>
  );
}

export interface ResultFile {
  name: string;
  blob: Blob;
}

export function ResultView({
  files,
  before,
  after,
  previewUrl,
  onReset,
  children,
}: {
  files: ResultFile[];
  before?: number;
  after?: number;
  previewUrl?: string;
  onReset: () => void;
  children?: React.ReactNode;
}) {
  const download = (f: ResultFile) => {
    const url = URL.createObjectURL(f.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return (
    <div className="result-box">
      <span className="result-badge"><Icon name="check-circle" size={16} /> Done! Your file is ready</span>
      {before !== undefined && after !== undefined && (
        <span className="size-compare">
          {formatBytes(before)} → <b>{formatBytes(after)}</b>{' '}
          {before > after && `(−${Math.round((1 - after / before) * 100)}%)`}
        </span>
      )}
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Result preview" className="result-preview" />
      )}
      {children}
      <div className="result-actions">
        {files.map((f) => (
          <button key={f.name} className="btn btn-primary" onClick={() => download(f)}>
            <Icon name="download" size={16} /> Download {files.length > 1 ? f.name : ''}
          </button>
        ))}
        {files.length > 0 && <ShareButton file={files[0]} />}
        <button className="btn btn-ghost" onClick={onReset}><Icon name="refresh" size={15} /> Process Another File</button>
      </div>
    </div>
  );
}

/* ─────────── Copyable output block ─────────── */

export function OutputBlock({ text, filename }: { text: string; filename?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="w-full">
      <div className="output-area">{text}</div>
      <div className="mt-2" style={{ display: 'flex', gap: 10 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            void navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          <Icon name="copy" size={14} /> {copied ? 'Copied!' : 'Copy'}
        </button>
        {filename && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
              a.download = filename;
              a.click();
            }}
          >
            <Icon name="download" size={14} /> Download
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────── Simple state machine hook ─────────── */

export type ToolPhase = 'idle' | 'working' | 'done' | 'error';

export function useToolPhase() {
  const [phase, setPhase] = useState<ToolPhase>('idle');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const fail = (e: unknown) => {
    setError(e instanceof Error ? e.message : String(e));
    setPhase('error');
  };
  const reset = () => { setPhase('idle'); setError(''); setProgress(undefined); };
  return { phase, setPhase, error, fail, reset, progress, setProgress };
}
