'use client';

import { useState } from 'react';
import { SavingsGoal } from '@/types';
import { validateGoal, GoalErrors } from '@/lib/goals';
import { todayLocalISO } from '@/utils/financialCycle';
import { useBudgetStore, generateId } from '@/store/budgetStore';
import { currencySymbol } from '@/utils/currency';
import DateInput from '@/components/DateInput';

interface GoalFormProps {
  initial?: SavingsGoal;          // undefined → create
  onSave: (goal: SavingsGoal) => void;
  onCancel: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 'var(--r-md)',
  border: '1.5px solid var(--border-default)', background: 'var(--bg-surface)',
  color: 'var(--text-900)', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-400)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
};

const errorStyle: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--red-500)', fontWeight: 600, marginTop: 4 };

/** Create/edit savings-goal form with inline validation. */
export default function GoalForm({ initial, onSave, onCancel }: GoalFormProps) {
  const { currency } = useBudgetStore();
  const sym = currencySymbol(currency);
  const isNew = !initial;

  const [name, setName]             = useState(initial?.name ?? '');
  const [target, setTarget]         = useState(initial ? String(initial.targetAmount) : '');
  const [saved, setSaved]           = useState(initial ? String(initial.savedAmount) : '0');
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? '');
  const [errors, setErrors]         = useState<GoalErrors>({});

  const submit = () => {
    const input = {
      name,
      targetAmount: parseFloat(target),
      savedAmount: saved === '' ? 0 : parseFloat(saved),
      targetDate: targetDate || undefined,
    };
    const errs = validateGoal(input, todayLocalISO(), { isNew });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const now = new Date().toISOString();
    onSave({
      id: initial?.id ?? generateId('goal'),
      name: name.trim(),
      targetAmount: input.targetAmount,
      savedAmount: input.savedAmount,
      targetDate: targetDate || undefined,
      archived: initial?.archived ?? false,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  };

  return (
    <div>
      {/* Name */}
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="goal-name" style={labelStyle}>Goal name</label>
        <input
          id="goal-name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Emergency fund, New bike"
          maxLength={80}
          style={{ ...inputStyle, borderColor: errors.name ? 'var(--red-400)' : 'var(--border-default)' }}
        />
        {errors.name && <div role="alert" style={errorStyle}>{errors.name}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
        {/* Target amount */}
        <div>
          <label htmlFor="goal-target" style={labelStyle}>Target ({sym})</label>
          <input
            id="goal-target"
            type="number" inputMode="decimal" min={0} step="0.01"
            value={target}
            onChange={e => setTarget(e.target.value)}
            placeholder="50000"
            style={{ ...inputStyle, borderColor: errors.targetAmount ? 'var(--red-400)' : 'var(--border-default)' }}
          />
          {errors.targetAmount && <div role="alert" style={errorStyle}>{errors.targetAmount}</div>}
        </div>
        {/* Saved so far */}
        <div>
          <label htmlFor="goal-saved" style={labelStyle}>Saved so far ({sym})</label>
          <input
            id="goal-saved"
            type="number" inputMode="decimal" min={0} step="0.01"
            value={saved}
            onChange={e => setSaved(e.target.value)}
            style={{ ...inputStyle, borderColor: errors.savedAmount ? 'var(--red-400)' : 'var(--border-default)' }}
          />
          {errors.savedAmount && <div role="alert" style={errorStyle}>{errors.savedAmount}</div>}
        </div>
      </div>

      {/* Target date */}
      <div style={{ marginBottom: 18 }}>
        <label htmlFor="goal-date" style={labelStyle}>Target date <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
        <DateInput value={targetDate} onChange={setTargetDate} />
        {errors.targetDate
          ? <div role="alert" style={errorStyle}>{errors.targetDate}</div>
          : <div style={{ fontSize: '0.68rem', color: 'var(--text-400)', marginTop: 4 }}>Needed per month is shown when a date is set.</div>}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={submit}
          style={{
            flex: 1, padding: '10px', borderRadius: 'var(--r-md)', border: 'none',
            background: 'var(--brand-600)', color: '#fff',
            fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {isNew ? 'Create goal' : 'Save changes'}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '10px 18px', borderRadius: 'var(--r-md)',
            background: 'var(--bg-surface)', color: 'var(--text-600)',
            border: '1.5px solid var(--border-default)',
            fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
