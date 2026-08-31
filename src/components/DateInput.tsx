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
};

/**
 * Segmented date input: DD / MM / YYYY
 * Tab moves between segments, then to the next form field.
 * Typing replaces the selected segment value.
 */
export default function DateInput({ value, onChange, style, className, onFocus, onBlur }: DateInputProps) {
  const hiddenRef = useRef<HTMLInputElement>(null);
  const ddRef = useRef<HTMLInputElement>(null);
  const mmRef = useRef<HTMLInputElement>(null);
  const yyRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const parts = parseParts(value);
  const [dd, setDd] = useState(parts.dd);
  const [mm, setMm] = useState(parts.mm);
  const [yyyy, setYyyy] = useState(parts.yyyy);

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

  // Select all text in the input on focus
  const selectAll = (ref: React.RefObject<HTMLInputElement | null>) => {
    setTimeout(() => ref.current?.select(), 0);
  };

  // Clamp and pad a segment value
  const clamp = (val: string, min: number, max: number, pad: number): string => {
    let n = parseInt(val, 10);
    if (isNaN(n)) n = min;
    n = Math.max(min, Math.min(max, n));
    return String(n).padStart(pad, '0');
  };

  const handleDdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(-2);
    setDd(raw);
    // Auto-advance to MM after typing 2 digits
    if (raw.length === 2) {
      const clamped = clamp(raw, 1, 31, 2);
      setDd(clamped);
      commit(clamped, mm, yyyy);
      mmRef.current?.focus();
    }
  };

  const handleMmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(-2);
    setMm(raw);
    if (raw.length === 2) {
      const clamped = clamp(raw, 1, 12, 2);
      setMm(clamped);
      commit(dd, clamped, yyyy);
      yyRef.current?.focus();
    }
  };

  const handleYyyyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(-4);
    setYyyy(raw);
    if (raw.length === 4) {
      commit(dd, mm, raw);
    }
  };

  // On blur of each segment, clamp + pad + commit
  const handleDdBlur = () => {
    const clamped = clamp(dd, 1, 31, 2);
    setDd(clamped);
    commit(clamped, mm, yyyy);
  };
  const handleMmBlur = () => {
    const clamped = clamp(mm, 1, 12, 2);
    setMm(clamped);
    commit(dd, clamped, yyyy);
  };
  const handleYyyyBlur = () => {
    let y = parseInt(yyyy, 10);
    if (isNaN(y) || y < 1900) y = new Date().getFullYear();
    if (y > 2100) y = 2100;
    const padded = String(y).padStart(4, '0');
    setYyyy(padded);
    commit(dd, mm, padded);
  };

  // Arrow up/down to increment/decrement
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    segment: 'dd' | 'mm' | 'yyyy',
  ) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
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
    }
  };

  const separatorStyle: React.CSSProperties = {
    color: 'var(--text-400)',
    fontSize: 'inherit',
    userSelect: 'none',
    pointerEvents: 'none',
    lineHeight: 1,
  };

  return (
    <div
      ref={containerRef}
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
        onChange={handleDdChange}
        onFocus={() => selectAll(ddRef)}
        onBlur={handleDdBlur}
        onKeyDown={e => handleKeyDown(e, 'dd')}
        maxLength={2}
        style={{ ...segStyle, width: '2ch' }}
        aria-label="Day"
      />
      <span style={separatorStyle}>/</span>
      {/* MM */}
      <input
        ref={mmRef}
        type="text"
        inputMode="numeric"
        value={mm}
        onChange={handleMmChange}
        onFocus={() => selectAll(mmRef)}
        onBlur={handleMmBlur}
        onKeyDown={e => handleKeyDown(e, 'mm')}
        maxLength={2}
        style={{ ...segStyle, width: '2ch' }}
        aria-label="Month"
      />
      <span style={separatorStyle}>/</span>
      {/* YYYY */}
      <input
        ref={yyRef}
        type="text"
        inputMode="numeric"
        value={yyyy}
        onChange={handleYyyyChange}
        onFocus={() => selectAll(yyRef)}
        onBlur={handleYyyyBlur}
        onKeyDown={e => handleKeyDown(e, 'yyyy')}
        maxLength={4}
        style={{ ...segStyle, width: '4ch' }}
        aria-label="Year"
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
