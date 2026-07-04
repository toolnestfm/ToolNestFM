'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../Icon';
import { useUI } from '../GlobalUI';
import { useAuth } from '../providers/AuthProvider';
import { trackEvent } from '@/lib/analytics-client';

export interface ShareFile {
  name: string;
  blob: Blob;
}

export interface ShareInfo {
  url: string;
  expiresAt: string;
  hasPassword?: boolean;
}

const EXPIRY_OPTIONS = [
  { hours: 1, label: '1 Hour' },
  { hours: 24, label: '24 Hours' },
  { hours: 168, label: '7 Days' },
  { hours: 720, label: '30 Days' },
];

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  file: ShareFile;
  toolSlug?: string;
}

export default function ShareModal({ open, onClose, file, toolSlug }: ShareModalProps) {
  const { toast } = useUI();
  const { user } = useAuth();
  const [share, setShare] = useState<ShareInfo | null>(null);
  const [qrPng, setQrPng] = useState('');
  const [qrSvg, setQrSvg] = useState('');
  const [expiresIn, setExpiresIn] = useState(24);
  const [oneTime, setOneTime] = useState(false);
  const [downloadLimit, setDownloadLimit] = useState(0);
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setShare(null);
    setQrPng('');
    setQrSvg('');
  }, [open, file]);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const createShare = async (): Promise<ShareInfo | null> => {
    if (!user) {
      toast('Sign in to create share links — it is free', 'error');
      return null;
    }
    if (share) return share;
    if (file.blob.size > 25 * 1024 * 1024) {
      toast('Share links support files up to 25MB', 'error');
      return null;
    }
    setCreating(true);
    try {
      const form = new FormData();
      form.append('file', new File([file.blob], file.name, { type: file.blob.type }));
      form.append('expiresInHours', String(expiresIn));
      form.append('oneTime', String(oneTime));
      if (downloadLimit > 0) form.append('downloadLimit', String(downloadLimit));
      if (password.trim().length >= 4) form.append('password', password.trim());
      if (toolSlug) form.append('toolSlug', toolSlug);

      const res = await fetch('/api/share', { method: 'POST', body: form });
      const json = (await res.json()) as { success: boolean; data?: ShareInfo; error?: string };
      if (!json.success || !json.data) throw new Error(json.error || 'Could not create share link');

      setShare(json.data);
      const QRCode = (await import('qrcode')).default;
      setQrPng(await QRCode.toDataURL(json.data.url, { width: 480, margin: 2 }));
      setQrSvg(await QRCode.toString(json.data.url, { type: 'svg', margin: 2 }));

      trackEvent('fab_share_created', { toolSlug, expiresIn }, user?.id);
      toast('Secure link generated ✓');
      return json.data;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create share link', 'error');
      return null;
    } finally {
      setCreating(false);
    }
  };

  const copyUrl = async (info?: ShareInfo | null) => {
    const target = info ?? share;
    if (!target) return;
    await navigator.clipboard.writeText(target.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast('Link copied to clipboard ✓');
    trackEvent('share_copied', { toolSlug }, user?.id);
  };

  const webShare = async () => {
    const info = share ?? (await createShare());
    if (!info) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: file.name, text: `Download ${file.name} from ToolNest`, url: info.url });
        trackEvent('share_social', { channel: 'native' }, user?.id);
        return;
      } catch { /* cancelled */ }
    }
    await copyUrl(info);
  };

  const openSocial = (kind: 'whatsapp' | 'telegram' | 'email' | 'facebook' | 'x') => {
    if (!share) return;
    const url = encodeURIComponent(share.url);
    const text = encodeURIComponent(`Download ${file.name} from ToolNest`);
    const links: Record<typeof kind, string> = {
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      telegram: `https://t.me/share/url?url=${url}&text=${text}`,
      email: `mailto:?subject=${text}&body=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      x: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
    };
    window.open(links[kind], '_blank', 'noopener');
    trackEvent('share_social', { channel: kind }, user?.id);
  };

  const downloadQr = (format: 'png' | 'svg') => {
    const data = format === 'png' ? qrPng : `data:image/svg+xml,${encodeURIComponent(qrSvg)}`;
    if (!data) return;
    const a = document.createElement('a');
    a.href = data;
    a.download = `${file.name}-share-qr.${format}`;
    a.click();
    trackEvent('qr_downloaded', { format }, user?.id);
  };

  const printQr = () => {
    const w = window.open('', '_blank');
    if (!w || !qrSvg) return;
    w.document.write(`<html><head><title>QR — ${file.name}</title></head><body style="display:flex;flex-direction:column;align-items:center;font-family:sans-serif"><h2>${file.name}</h2>${qrSvg}<p>Scan to download</p></body></html>`);
    w.document.close();
    w.print();
  };

  if (!open) return null;

  return createPortal(
    <>
      <div className="share-modal-overlay" onClick={onClose} aria-hidden="true">
        <div
          ref={modalRef}
          className="share-modal glass"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Copy and share download link"
        >
          <button ref={closeBtnRef} className="icon-btn share-modal-close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
          <h3>Copy &amp; Share Download Link</h3>
          <p className="muted share-modal-sub">Share your processed file instantly — free for all signed-in users.</p>

          {!share ? (
            <>
              <div className="field">
                <label htmlFor="share-expiry">Expire after</label>
                <select id="share-expiry" value={expiresIn} onChange={(e) => setExpiresIn(+e.target.value)}>
                  {EXPIRY_OPTIONS.map((o) => (
                    <option key={o.hours} value={o.hours}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="share-limit">Download limit (0 = unlimited)</label>
                <input
                  id="share-limit"
                  type="number"
                  min={0}
                  max={100}
                  value={downloadLimit}
                  onChange={(e) => setDownloadLimit(+e.target.value)}
                />
              </div>
              <label className="checkbox-row">
                <input type="checkbox" checked={oneTime} onChange={(e) => setOneTime(e.target.checked)} />
                One-time download
              </label>
              <div className="field">
                <label htmlFor="share-pwd-opt">Password protection (optional, min 4 chars)</label>
                <input
                  id="share-pwd-opt"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Optional"
                  autoComplete="new-password"
                />
              </div>
              <button className="btn btn-primary w-full mt-2" disabled={creating} onClick={() => void createShare()}>
                <Icon name="link" size={15} /> {creating ? 'Generating…' : 'Generate Secure Link'}
              </button>
            </>
          ) : (
            <>
              <div className="share-url-row">
                <input readOnly value={share.url} onFocus={(e) => e.target.select()} aria-label="Share URL" />
                <button className="btn btn-primary btn-sm" onClick={() => void copyUrl()}>
                  <Icon name="copy" size={14} /> {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="muted share-expiry-note">
                Expires {new Date(share.expiresAt).toLocaleString()}
                {oneTime ? ' · one-time' : ''}
                {share.hasPassword ? ' · password protected' : ''}
              </p>

              {qrPng && (
                <div className="share-qr">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrPng} alt="QR code for download link" />
                  <p className="muted">Scan using your mobile to download instantly.</p>
                  <div className="share-qr-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => downloadQr('png')}>
                      <Icon name="download" size={14} /> PNG
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => downloadQr('svg')}>
                      <Icon name="download" size={14} /> SVG
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={printQr}>
                      <Icon name="printer" size={14} /> Print
                    </button>
                  </div>
                </div>
              )}

              <div className="share-social">
                <button className="btn btn-ghost btn-sm" onClick={() => void webShare()}><Icon name="share" size={14} /> Share</button>
                <button className="btn btn-ghost btn-sm" onClick={() => openSocial('whatsapp')}><Icon name="send" size={14} /> WhatsApp</button>
                <button className="btn btn-ghost btn-sm" onClick={() => openSocial('telegram')}><Icon name="plane" size={14} /> Telegram</button>
                <button className="btn btn-ghost btn-sm" onClick={() => openSocial('email')}><Icon name="mail" size={14} /> Email</button>
                <button className="btn btn-ghost btn-sm" onClick={() => openSocial('facebook')}><Icon name="facebook" size={14} /> Facebook</button>
                <button className="btn btn-ghost btn-sm" onClick={() => openSocial('x')}><Icon name="twitter" size={14} /> X</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
