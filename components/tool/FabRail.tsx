'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Icon from '../Icon';
import { useUI } from '../GlobalUI';
import { useAuth } from '../providers/AuthProvider';
import { trackEvent } from '@/lib/analytics-client';
import { formatBytes } from '@/lib/download';
import type { ShareFile } from './ShareModal';
import ProUpgradePrompt from './ProUpgradePrompt';

const ShareModal = dynamic(() => import('./ShareModal'), { ssr: false });

type CloudProvider = 'google' | 'dropbox';

function isPro(plan?: string): boolean {
  return plan === 'pro' || plan === 'enterprise';
}

/* ─── Brand icons (official shapes, simplified) ─── */

function GoogleDriveIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill="#0066DA" d="M4.4 20.3 1.6 15.4c-.3-.6-.3-1.3 0-1.9L8.2 2.1h5.6L6.3 15.2l-1.9 5.1Z" />
      <path fill="#00AC47" d="M8.2 2.1h5.6l7.5 13.1H15.7L8.2 2.1Z" />
      <path fill="#EA4335" d="M1.6 15.4c-.3.6-.3 1.3 0 1.9l1.5 2.6c.3.6 1 1 1.7 1h12.9l-2.9-5.5H1.6Z" opacity=".9" />
      <path fill="#FFBA00" d="M22.4 15.4 15.7 3.6c-.3-.6-1-1-1.7-1h-3l7.5 13.1h3.9v-.3Z" opacity=".9" />
      <path fill="#2684FC" d="M14.8 15.2H6.3l-2.9 5.5c.2.1.4.1.6.1h14.9c.7 0 1.4-.4 1.7-1l1.4-2.5-2.9-5.2-4.3 3.1Z" opacity=".95" />
    </svg>
  );
}

function DropboxIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#0061FF" aria-hidden>
      <path d="M6 2 0 5.9l6 3.9 6-3.9L6 2Zm12 0-6 3.9 6 3.9 6-3.9L18 2ZM0 13.7l6 3.9 6-3.9-6-3.9-6 3.9Zm18-3.9-6 3.9 6 3.9 6-3.9-6-3.9ZM6.1 18.9l6 3.9 6-3.9-6-3.9-6 3.9Z" />
    </svg>
  );
}

/* ─── Cloud file picker modal ─── */

interface CloudFileEntry {
  id: string;
  name: string;
  size?: number;
  path?: string;
  mimeType?: string;
}

function CloudPickerModal({
  provider,
  onPick,
  onClose,
}: {
  provider: CloudProvider;
  onPick: (file: File) => void;
  onClose: () => void;
}) {
  const { toast } = useUI();
  const [files, setFiles] = useState<CloudFileEntry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const label = provider === 'google' ? 'Google Drive' : 'Dropbox';

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/cloud/${provider}/import`);
        if (res.status === 401) {
          window.location.href = `/api/cloud/${provider}/auth?returnTo=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        const json = (await res.json()) as {
          success: boolean;
          data?: { files: Array<{ id: string; name: string; size?: number | string; path_lower?: string; mimeType?: string }> };
          error?: string;
        };
        if (!json.success || !json.data) throw new Error(json.error || `Could not list ${label} files`);
        setFiles(json.data.files.map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size !== undefined ? Number(f.size) : undefined,
          path: f.path_lower,
          mimeType: f.mimeType,
        })));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load files');
      }
    })();
  }, [provider, label]);

  const pick = async (entry: CloudFileEntry) => {
    setBusy(entry.id);
    try {
      const param = provider === 'google' ? `fileId=${encodeURIComponent(entry.id)}` : `path=${encodeURIComponent(entry.path ?? '')}`;
      const res = await fetch(`/api/cloud/${provider}/import?${param}`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      onPick(new File([blob], entry.name, { type: entry.mimeType || blob.type || 'application/octet-stream' }));
      toast(`Imported ${entry.name} from ${label} ✓`);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal glass" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Import from ${label}`}>
        <button className="icon-btn share-modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {provider === 'google' ? <GoogleDriveIcon /> : <DropboxIcon />} Import from {label}
        </h3>
        <p className="muted share-modal-sub">Pick a file to load into this tool.</p>

        {error && <div className="error-box">⚠️ {error}</div>}
        {!error && files === null && <div className="notif-empty"><div className="spinner" /></div>}
        {files && files.length === 0 && <div className="notif-empty">No files found in {label}.</div>}
        {files && files.length > 0 && (
          <div className="cloud-picker-list">
            {files.map((f) => (
              <button key={f.id} className="cloud-picker-item" disabled={busy !== null} onClick={() => void pick(f)}>
                <Icon name="file-text" size={16} />
                <span className="cloud-picker-name">{f.name}</span>
                {f.size !== undefined && !Number.isNaN(f.size) && (
                  <span className="cloud-picker-size">{formatBytes(f.size)}</span>
                )}
                {busy === f.id && <div className="spinner spinner-sm" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── FAB rail ─── */

export interface FabRailProps {
  file?: ShareFile | null;
  toolSlug?: string;
  onFilesPasted?: (files: File[]) => void;
  onCloudImport?: (files: File[]) => void;
}

export default function FabRail({ file, toolSlug, onFilesPasted, onCloudImport }: FabRailProps) {
  const { toast } = useUI();
  const { user } = useAuth();
  const pro = isPro(user?.plan);
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null);
  const [cloudMenu, setCloudMenu] = useState<CloudProvider | null>(null);
  const [picker, setPicker] = useState<CloudProvider | null>(null);
  const [cloudBusy, setCloudBusy] = useState<CloudProvider | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const importHandler = onCloudImport ?? onFilesPasted;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (railRef.current && !railRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCloudMenu(null);
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

  const exportToCloud = useCallback(async (provider: CloudProvider) => {
    if (!file) {
      toast('Process a file first to export', 'error');
      return;
    }
    setCloudBusy(provider);
    try {
      const res = await fetch(`/api/cloud/${provider}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': file.blob.type || 'application/octet-stream',
          'x-file-name': file.name,
        },
        body: file.blob,
      });
      if (res.status === 401) {
        window.location.href = `/api/cloud/${provider}/auth?returnTo=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error || 'Export failed');
      toast(`Uploaded to ${provider === 'google' ? 'Google Drive' : 'Dropbox'} ✓`);
      trackEvent('fab_cloud_export', { provider, toolSlug }, user?.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Cloud export failed', 'error');
    } finally {
      setCloudBusy(null);
    }
  }, [file, toast, toolSlug, user?.id]);

  const openCloud = (provider: CloudProvider) => {
    if (!pro) {
      setUpgradeFeature(provider === 'google' ? 'Google Drive' : 'Dropbox');
      return;
    }
    setCloudMenu(cloudMenu === provider ? null : provider);
  };

  return (
    <>
      <div className={`fab-rail ${open ? 'fab-open' : ''}`} ref={railRef} role="toolbar" aria-label="Quick actions">
        <button
          className="fab-btn fab-main"
          onClick={() => { setOpen((o) => !o); setCloudMenu(null); }}
          aria-expanded={open}
          aria-label={open ? 'Close quick actions' : 'Open quick actions'}
          title="Quick Actions"
        >
          <Icon name={open ? 'x' : 'zap'} size={20} />
        </button>

        {open && (
          <div className="fab-items">
            <div className="fab-item-wrap">
              <button
                className={`fab-btn ${!pro ? 'fab-btn-locked' : ''}`}
                onClick={() => openCloud('google')}
                disabled={cloudBusy === 'google'}
                aria-label="Google Drive"
                title={pro ? 'Google Drive' : 'Google Drive (Pro)'}
              >
                <GoogleDriveIcon />
                {!pro && <span className="fab-lock" aria-hidden><Icon name="lock" size={10} /></span>}
              </button>
              {cloudMenu === 'google' && (
                <div className="fab-menu glass">
                  {importHandler && (
                    <button onClick={() => { setCloudMenu(null); setPicker('google'); }}>
                      <Icon name="download" size={14} /> Import from Drive
                    </button>
                  )}
                  <button disabled={!file} onClick={() => { setCloudMenu(null); void exportToCloud('google'); }}>
                    <Icon name="upload" size={14} /> Export to Drive
                  </button>
                </div>
              )}
            </div>

            <div className="fab-item-wrap">
              <button
                className={`fab-btn ${!pro ? 'fab-btn-locked' : ''}`}
                onClick={() => openCloud('dropbox')}
                disabled={cloudBusy === 'dropbox'}
                aria-label="Dropbox"
                title={pro ? 'Dropbox' : 'Dropbox (Pro)'}
              >
                <DropboxIcon />
                {!pro && <span className="fab-lock" aria-hidden><Icon name="lock" size={10} /></span>}
              </button>
              {cloudMenu === 'dropbox' && (
                <div className="fab-menu glass">
                  {importHandler && (
                    <button onClick={() => { setCloudMenu(null); setPicker('dropbox'); }}>
                      <Icon name="download" size={14} /> Import from Dropbox
                    </button>
                  )}
                  <button disabled={!file} onClick={() => { setCloudMenu(null); void exportToCloud('dropbox'); }}>
                    <Icon name="upload" size={14} /> Export to Dropbox
                  </button>
                </div>
              )}
            </div>

            <button
              className={`fab-btn ${!pro ? 'fab-btn-locked' : ''}`}
              onClick={() => {
                if (!pro) { setUpgradeFeature('Share Links'); return; }
                if (file) setShareOpen(true);
                else toast('Process a file first', 'error');
              }}
              aria-label="Share link"
              title={pro ? 'Share Link' : 'Share Link (Pro)'}
            >
              <Icon name="link" size={20} />
              {!pro && <span className="fab-lock" aria-hidden><Icon name="lock" size={10} /></span>}
            </button>

            {onFilesPasted && (
              <button className="fab-btn" onClick={() => void pasteFromClipboard()} aria-label="Paste from clipboard" title="Paste from Clipboard">
                <Icon name="clipboard" size={20} />
              </button>
            )}
          </div>
        )}
      </div>

      {picker && importHandler && (
        <CloudPickerModal
          provider={picker}
          onClose={() => setPicker(null)}
          onPick={(f) => importHandler([f])}
        />
      )}

      {file && shareOpen && (
        <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} file={file} toolSlug={toolSlug} />
      )}

      {upgradeFeature && (
        <ProUpgradePrompt onClose={() => setUpgradeFeature(null)} feature={upgradeFeature} />
      )}
    </>
  );
}
