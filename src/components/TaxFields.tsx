'use client';

import { TaxInfo } from '@/types';
import { taxYearForDate } from '@/lib/tax';
import { todayLocalISO } from '@/utils/financialCycle';

interface TaxFieldsProps {
  value: TaxInfo | undefined;
  onChange: (v: TaxInfo | undefined) => void;
  /** Date used to default the tax year (e.g. the form's transaction date). */
  defaultDate?: string;
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em',
  textTransform: 'uppercase', color: 'var(--text-500)',
  display: 'block', marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px',
  background: 'var(--bg-subtle)',
  border: '1.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  color: 'var(--text-900)', fontSize: '0.8125rem',
  fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
};

function fyOptions(dateISO: string): string[] {
  const [y, m] = dateISO.split('-').map(Number);
  const fyStart = y && m ? (m >= 4 ? y : y - 1) : new Date().getFullYear();
  return [fyStart - 1, fyStart, fyStart + 1].map(
    s => `FY ${s}-${String((s + 1) % 100).padStart(2, '0')}`
  );
}

/**
 * Shared tax sub-form: tax-related checkbox → tax category, tax year,
 * deductible flag and notes. Emits `undefined` when unchecked so the field
 * simply isn't set (a transaction then inherits its category's tax default).
 */
export default function TaxFields({ value, onChange, defaultDate }: TaxFieldsProps) {
  const enabled = !!value?.isTaxRelated;
  const dateForYear = defaultDate || todayLocalISO();
  const years = fyOptions(dateForYear);
  if (value?.taxYear && !years.includes(value.taxYear)) years.unshift(value.taxYear);

  const update = (patch: Partial<TaxInfo>) => onChange({ ...(value ?? { isTaxRelated: true }), ...patch });

  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => {
            if (e.target.checked) {
              onChange({ isTaxRelated: true, taxYear: taxYearForDate(dateForYear), deductible: false });
            } else {
              onChange(undefined);
            }
          }}
          style={{ width: 15, height: 15, accentColor: 'var(--brand-600)', cursor: 'pointer' }}
        />
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>
          Tax-related
        </span>
      </label>

      {enabled && value && (
        <div style={{
          marginTop: 10, padding: 12,
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--r-md)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle} htmlFor="tax-category">Tax category</label>
              <input
                id="tax-category"
                type="text"
                value={value.taxCategory ?? ''}
                onChange={e => update({ taxCategory: e.target.value })}
                placeholder='e.g., 80C, HRA, Business'
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="tax-year">Tax year</label>
              <select
                id="tax-year"
                value={value.taxYear ?? taxYearForDate(dateForYear)}
                onChange={e => update({ taxYear: e.target.value })}
                style={inputStyle}
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Deductible</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([true, false] as const).map(v => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => update({ deductible: v })}
                  style={{
                    flex: 1, padding: '7px 0',
                    borderRadius: 'var(--r-sm)',
                    border: (value.deductible ?? false) === v ? '1.5px solid var(--brand-300)' : '1.5px solid var(--border-default)',
                    background: (value.deductible ?? false) === v ? 'var(--brand-600)' : 'var(--bg-surface)',
                    color: (value.deductible ?? false) === v ? '#fff' : 'var(--text-600)',
                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {v ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle} htmlFor="tax-notes">Tax notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <input
              id="tax-notes"
              type="text"
              value={value.notes ?? ''}
              onChange={e => update({ notes: e.target.value })}
              placeholder="e.g., Section 80C ELSS contribution"
              style={inputStyle}
            />
          </div>
        </div>
      )}
    </div>
  );
}
