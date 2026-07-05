'use client';

import { useEffect, useRef } from 'react';
import Icon from '@/components/Icon';

type AdminModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  danger?: boolean;
};

export default function AdminModal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
  danger,
}: AdminModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        className={`modal admin-modal ${wide ? 'admin-modal-wide' : ''} ${danger ? 'admin-modal-danger' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="admin-modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p className="modal-sub">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="admin-modal-body">{children}</div>
        {footer && <div className="modal-actions admin-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
