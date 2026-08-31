'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Calendar } from 'lucide-react';

interface DateInputProps {
  value: string;           // ISO format YYYY-MM-DD
  onChange: (iso: string) => void;
  style?: React.CSSProperties;
  className?: string;
  onFocus?: (e: React.FocusEvent<HTMLDivElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLDivElement>) => void;
}

function parseParts(iso: string): { dd: string; mm: string; yyyy: string } {
  if (!iso) {
    const now = new Date();
    return {
      dd: String(now.getDate()).padStart(2, '0'),
      mm: String(now.getMonth() + 1).padStart(2, '0'),
      yyyy: String(now.getFullYear()),
    };
  }
  const [yyyy, mm, dd] = iso.split('-');
  return { dd: dd ?? '01', mm: mm ?? '01', yyyy: yyyy ?? '2026' };
}

function buildIso(dd: string, mm: string, yyyy: string): string {
  const d = parseInt(dd, 10), m = parseInt(mm, 10), y = parseInt(yyyy, 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return '';
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return '';
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return '';
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function clamp(val: number, min: number, max: number, pad: number): string {
  const n = Math.max(min, Math.min(max, isNaN(val) ? min : val));
  return String(n).padStart(pad, '0');
}

const segStyle: React.CSSProperties = {
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: 'inherit',
  fontFamily: 'inherit',
  color: 'inherit',
  padding: 0,
  textAlign: 'center',
  caretColor: 'transparent',
  fontVariantNumeric: 'tabular-nums',
  cursor: 'default',
};

/**
 * Segmented date input: DD / MM / YYYY
 *
 * All digit input is handled via onKeyDown to avoid browser selection/timing
 * issues. The inputs are read-only from React's perspective (value is set by
 * state only), so there are no race conditions with select() or onChange.
 */
export default function DateInput({ value, onChange, style, className, onFocus, onBlur }: DateInputProps) {
  const hiddenRef = useRef<HTMLInputElement>(null);
  const ddRef = useRef<HTMLInputElement>(null);
  const mmRef = useRef<HTMLInputElement>(null);
  const yyRef = useRef<HTMLInputElement>(null);

  const parts = parseParts(value);
  const [dd, setDd] = useState(parts.dd);
  const [mm, setMm] = useState(parts.mm);
  const [yyyy, setYyyy] = useState(parts.yyyy);

  // Digit buffer: collects typed digits since last focus. Reset on focus/advance.
  const bufferRef = useRef('');
  // Skip blur handler when keyDown already committed and advanced
  const skipBlurRef = useRef(false);

  // Sync from parent value
  useEffect(() => {
    const p = parseParts(value);
    setDd(p.dd);
    setMm(p.mm);
    setYyyy(p.yyyy);
  }, [value]);

  const commit = useCallback((d: string, m: string, y: string) => {
    const iso = buildIso(d, m, y);
    if (iso) onChange(iso);
  }, [onChange]);

  // On focus: reset buffer, visually select text
  const handleFocus = (ref: React.RefObject<HTMLInputElement | null>) => {
    bufferRef.current = '';
    setTimeout(() => ref.current?.select(), 0);
  };

  // All digit handling via keyDown — no onChange needed
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    segment: 'dd' | 'mm' | 'yyyy',
  ) => {
    const isDigit = e.key >= '0' && e.key <= '9';

    if (isDigit) {
      e.preventDefault();
      const digit = e.key;
      const maxLen = segment === 'yyyy' ? 4 : 2;

      // Build up the buffer from scratch since focus
      bufferRef.current += digit;

      // If buffer exceeds maxLen, keep only the latest digits
      if (bufferRef.current.length > maxLen) {
        bufferRef.current = bufferRef.current.slice(-maxLen);
      }

      const buf = bufferRef.current;

      if (segment === 'dd') {
        if (buf.length === 2) {
          const clamped = clamp(parseInt(buf, 10), 1, 31, 2);
          setDd(clamped);
          commit(clamped, mm, yyyy);
          bufferRef.current = '';
          skipBlurRef.current = true;
          mmRef.current?.focus();
        } else {
          // First digit — if > 3, it can't start a valid day, auto-pad and advance
          const n = parseInt(buf, 10);
          if (n > 3) {
            const clamped = clamp(n, 1, 31, 2);
            setDd(clamped);
            commit(clamped, mm, yyyy);
            bufferRef.current = '';
            skipBlurRef.current = true;
            mmRef.current?.focus();
          } else {
            setDd(buf);
          }
        }
      } else if (segment === 'mm') {
        if (buf.length === 2) {
          const clamped = clamp(parseInt(buf, 10), 1, 12, 2);
          setMm(clamped);
          commit(dd, clamped, yyyy);
          bufferRef.current = '';
          skipBlurRef.current = true;
          yyRef.current?.focus();
        } else {
          const n = parseInt(buf, 10);
          if (n > 1) {
            const clamped = clamp(n, 1, 12, 2);
            setMm(clamped);
            commit(dd, clamped, yyyy);
            bufferRef.current = '';
            skipBlurRef.current = true;
            yyRef.current?.focus();
          } else {
            setMm(buf);
          }
        }
      } else {
        setYyyy(buf);
        if (buf.length === 4) {
          commit(dd, mm, buf);
          bufferRef.current = '';
        }
      }
      return;
    }

    // Arrow up/down
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      bufferRef.current = '';
      const delta = e.key === 'ArrowUp' ? 1 : -1;
      if (segment === 'dd') {
        let n = parseInt(dd, 10) + delta;
        if (n < 1) n = 31; if (n > 31) n = 1;
        const v = String(n).padStart(2, '0');
        setDd(v); commit(v, mm, yyyy);
      } else if (segment === 'mm') {
        let n = parseInt(mm, 10) + delta;
        if (n < 1) n = 12; if (n > 12) n = 1;
        const v = String(n).padStart(2, '0');
        setMm(v); commit(dd, v, yyyy);
      } else {
        let n = parseInt(yyyy, 10) + delta;
        if (n < 1900) n = 1900; if (n > 2100) n = 2100;
        const v = String(n);
        setYyyy(v); commit(dd, mm, v);
      }
      return;
    }

    // Backspace — clear buffer and reset to "0" for the segment
    if (e.key === 'Backspace') {
      e.preventDefault();
      bufferRef.current = '';
      if (segment === 'dd') setDd('');
      else if (segment === 'mm') setMm('');
      else setYyyy('');
      return;
    }
  };

  // On blur: clamp + pad + commit (skip if keyDown already handled it)
  const handleDdBlur = () => {
    bufferRef.current = '';
    if (skipBlurRef.current) { skipBlurRef.current = false; return; }
    const clamped = clamp(parseInt(dd, 10) || 1, 1, 31, 2);
    setDd(clamped);
    commit(clamped, mm, yyyy);
  };
  const handleMmBlur = () => {
    bufferRef.current = '';
    if (skipBlurRef.current) { skipBlurRef.current = false; return; }
    const clamped = clamp(parseInt(mm, 10) || 1, 1, 12, 2);
    setMm(clamped);
    commit(dd, clamped, yyyy);
  };
  const handleYyyyBlur = () => {
    bufferRef.current = '';
    if (skipBlurRef.current) { skipBlurRef.current = false; return; }
    let y = parseInt(yyyy, 10);
    if (isNaN(y) || y < 1900) y = new Date().getFullYear();
    if (y > 2100) y = 2100;
    const padded = String(y).padStart(4, '0');
    setYyyy(padded);
    commit(dd, mm, padded);
  };

  const separatorStyle: React.CSSProperties = {
    color: 'var(--text-400)',
    fontSize: 'inherit',
    userSelect: 'none',
    pointerEvents: 'none',
    lineHeight: 1,
  };

  // Suppress onChange since we handle everything in onKeyDown
  const noop = () => {};

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        ...style,
      }}
      className={className}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {/* DD */}
      <input
        ref={ddRef}
        type="text"
        inputMode="numeric"
        value={dd}
        onChange={noop}
        onFocus={() => handleFocus(ddRef)}
        onBlur={handleDdBlur}
        onKeyDown={e => handleKeyDown(e, 'dd')}
        style={{ ...segStyle, width: '2.2ch' }}
        aria-label="Day"
        autoComplete="off"
      />
      <span style={separatorStyle}>/</span>
      {/* MM */}
      <input
        ref={mmRef}
        type="text"
        inputMode="numeric"
        value={mm}
        onChange={noop}
        onFocus={() => handleFocus(mmRef)}
        onBlur={handleMmBlur}
        onKeyDown={e => handleKeyDown(e, 'mm')}
        style={{ ...segStyle, width: '2.2ch' }}
        aria-label="Month"
        autoComplete="off"
      />
      <span style={separatorStyle}>/</span>
      {/* YYYY */}
      <input
        ref={yyRef}
        type="text"
        inputMode="numeric"
        value={yyyy}
        onChange={noop}
        onFocus={() => handleFocus(yyRef)}
        onBlur={handleYyyyBlur}
        onKeyDown={e => handleKeyDown(e, 'yyyy')}
        style={{ ...segStyle, width: '4.2ch' }}
        aria-label="Year"
        autoComplete="off"
      />

      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {/* Calendar icon — opens native picker */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          hiddenRef.current?.showPicker?.();
        }}
        style={{
          background: 'none',
          border: 'none',
          padding: '0 0 0 4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
        tabIndex={-1}
      >
        <Calendar size={15} style={{ color: 'var(--text-400)' }} />
      </button>

      {/* Hidden native date input for the picker */}
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          position: 'absolute',
          opacity: 0,
          width: 0,
          height: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
        tabIndex={-1}
      />
    </div>
  );
}
