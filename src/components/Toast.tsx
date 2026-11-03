'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ToastProps {
  open: boolean;
  message: string;
  /** Optional accent colour (CSS var / hex); defaults to the brand colour. */
  accent?: string;
  durationMs?: number;   // default 6000
  onClose: () => void;
}

/**
 * Small transient toast, bottom-centre. Auto-hides after `durationMs`,
 * closable, announced via aria-live. Reusable for any notification.
 */
export default function Toast({ open, message, accent = 'var(--brand-600)', durationMs = 6000, onClose }: ToastProps) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 200, maxWidth: 'min(92vw, 420px)',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 14px', borderRadius: 'var(--r-lg)',
        background: 'var(--bg-surface)', border: `1.5px solid ${accent}`,
        boxShadow: '0 8px 30px rgba(15,23,42,0.18)',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 99, background: accent, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-800)' }}>{message}</span>
      <button
        onClick={onClose}
        aria-label="Dismiss notification"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-400)', padding: 2, display: 'flex' }}
      >
        <X size={13} />
      </button>
    </div>
  );
}
