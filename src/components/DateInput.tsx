'use client';

import { useRef } from 'react';
import { Calendar } from 'lucide-react';

interface DateInputProps {
  value: string;           // ISO format YYYY-MM-DD
  onChange: (iso: string) => void;
  style?: React.CSSProperties;
  className?: string;
  onFocus?: (e: React.FocusEvent<HTMLDivElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLDivElement>) => void;
}

/** Format YYYY-MM-DD → DD/MM/YYYY for display */
function formatDisplay(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Custom date input that always shows DD/MM/YYYY regardless of OS locale.
 * Uses a hidden native date picker for the calendar popup.
 */
export default function DateInput({ value, onChange, style, className, onFocus, onBlur }: DateInputProps) {
  const hiddenRef = useRef<HTMLInputElement>(null);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        ...style,
      }}
      className={className}
      onClick={() => hiddenRef.current?.showPicker?.()}
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={0}
    >
      {/* Displayed value in DD/MM/YYYY */}
      <span style={{
        flex: 1,
        fontSize: 'inherit',
        color: value ? 'inherit' : 'var(--text-400)',
        userSelect: 'none',
        pointerEvents: 'none',
      }}>
        {value ? formatDisplay(value) : 'DD/MM/YYYY'}
      </span>

      {/* Calendar icon */}
      <Calendar size={15} style={{ color: 'var(--text-400)', flexShrink: 0, pointerEvents: 'none' }} />

      {/* Hidden native date input for the picker */}
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          width: '100%',
          height: '100%',
          cursor: 'pointer',
          zIndex: 1,
        }}
        tabIndex={-1}
      />
    </div>
  );
}
