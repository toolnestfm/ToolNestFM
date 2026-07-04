'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Icon from '../Icon';
import { useUI } from '../GlobalUI';
import { useAuth } from '../providers/AuthProvider';
import { trackEvent } from '@/lib/analytics-client';
import type { ShareFile } from './ShareModal';

const ShareModal = dynamic(() => import('./ShareModal'), { ssr: false });

/* ─── FAB rail ─── */

export interface FabRailProps {
  file?: ShareFile | null;
  toolSlug?: string;
  onFilesPasted?: (files: File[]) => void;
}

export default function FabRail({ file, toolSlug, onFilesPasted }: FabRailProps) {
  const { toast } = useUI();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (railRef.current && !railRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      const picked: File[] = [];
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/') || t === 'application/pdf' || t === 'text/plain');
        if (!type) continue;
        const blob = await item.getType(type);
        if (type === 'text/plain') {
          picked.push(new File([await blob.text()], `pasted-${Date.now()}.txt`, { type: 'text/plain' }));
        } else {
          const ext = type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
          picked.push(new File([blob], `pasted-${Date.now()}.${ext}`, { type }));
        }
      }
      if (picked.length === 0) {
        toast('No image, PDF, or text found in clipboard', 'error');
        return;
      }
      onFilesPasted?.(picked);
      trackEvent('fab_clipboard_paste', { toolSlug, count: picked.length }, user?.id);
      toast(`Pasted ${picked.length} file(s) from clipboard ✓`);
    } catch {
      toast('Clipboard access denied', 'error');
    }
  }, [onFilesPasted, toast, toolSlug, user?.id]);

  return (
    <>
      <div className={`fab-rail ${open ? 'fab-open' : ''}`} ref={railRef} role="toolbar" aria-label="Quick actions">
        <button
          className="fab-btn fab-main"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? 'Close quick actions' : 'Open quick actions'}
          title="Quick Actions"
        >
          <Icon name={open ? 'x' : 'zap'} size={20} />
        </button>

        {open && (
          <div className="fab-items">
            {file && (
              <button
                className="fab-btn"
                onClick={() => {
                  const url = URL.createObjectURL(file.blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = file.name; a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 30_000);
                }}
                aria-label="Download"
                title="Download"
              >
                <Icon name="download" size={20} />
              </button>
            )}

            <button
              className="fab-btn"
              onClick={() => {
                if (file) setShareOpen(true);
                else toast('Process a file first', 'error');
              }}
              aria-label="Share link"
              title="Share Link"
            >
              <Icon name="link" size={20} />
            </button>

            {onFilesPasted && (
              <button className="fab-btn" onClick={() => void pasteFromClipboard()} aria-label="Paste from clipboard" title="Paste from Clipboard">
                <Icon name="clipboard" size={20} />
              </button>
            )}
          </div>
        )}
      </div>

      {file && shareOpen && (
        <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} file={file} toolSlug={toolSlug} />
      )}
    </>
  );
}
