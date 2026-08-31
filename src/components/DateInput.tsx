'use client';

import { useRef, useState, useEffect } from 'react';
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
function isoToDisplay(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/** Parse DD/MM/YYYY → YYYY-MM-DD, returns '' if invalid */
function displayToIso(display: string): string {
  // Accept DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const parts = display.split(/[\/\-\.]/);
  if (parts.length !== 3) return '';
  const [dd, mm, yyyy] = parts;
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return '';
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) return '';
  // Validate the date is real
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return `${yyyy.padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Custom date input that always shows DD/MM/YYYY regardless of OS locale.
 * Supports both typing a date and using the native calendar picker.
 */
export default function DateInput({ value, onChange, style, className, onFocus, onBlur }: DateInputProps) {
  const hiddenRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const [textValue, setTextValue] = useState(isoToDisplay(value));
  const [editing, setEditing] = useState(false);

  // Sync display when value changes externally (e.g. from calendar picker)
  useEffect(() => {
    if (!editing) {
      setTextValue(isoToDisplay(value));
    }
  }, [value, editing]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTextValue(raw);

    // Try to parse complete date — update value live as the user types/edits
    const iso = displayToIso(raw);
    if (iso) {
      onChange(iso);
    }
  };

  const handleTextBlur = () => {
    setEditing(false);
    // On blur, if current text isn't a valid date, revert to the last good value
    const iso = displayToIso(textValue);
    if (iso) {
      onChange(iso);
      setTextValue(isoToDisplay(iso));
    } else {
      setTextValue(isoToDisplay(value));
    }
  };

  const handleTextFocus = () => {
    setEditing(true);
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        ...style,
      }}
      className={className}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {/* Editable text input showing DD/MM/YYYY */}
      <input
        ref={textRef}
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/YYYY"
        value={textValue}
        onChange={handleTextChange}
        onFocus={handleTextFocus}
        onBlur={handleTextBlur}
        maxLength={10}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 'inherit',
          fontFamily: 'inherit',
          color: 'inherit',
          padding: 0,
          width: '100%',
          minWidth: 0,
        }}
      />

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
          padding: '0 0 0 6px',
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
        onChange={e => {
          onChange(e.target.value);
          setTextValue(isoToDisplay(e.target.value));
          setEditing(false);
        }}
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
