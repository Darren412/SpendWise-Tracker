'use client';

import { useState } from 'react';
import { useBudgetStore, generateId } from '@/store/budgetStore';
import { Expense, RecurrenceFrequency, RecurringRule, TaxInfo, FundingSource } from '@/types';
import CategorySelect from '@/components/CategorySelect';
import DateInput from '@/components/DateInput';
import TaxFields from '@/components/TaxFields';
import FundingPicker, { ReserveShortfallDialog } from '@/components/balance/FundingPicker';
import { useReserve } from '@/hooks/useReserve';
import { validateFunding } from '@/lib/reserve';
import { todayLocalISO } from '@/utils/financialCycle';
import { ChevronDown } from 'lucide-react';

export default function ExpenseForm() {
  const { addExpense, addRecurringRule, categories, selectedCity } = useBudgetStore();
  const effectiveCity = selectedCity === 'Both' ? 'Bangalore' : selectedCity;
  const [formCity, setFormCity] = useState(effectiveCity);

  const expenseCategories = categories.filter(c => c.type !== 'income');
  const defaultCatId = expenseCategories[0]?.id ?? '';

  const [formData, setFormData] = useState({
    category:    defaultCatId,
    description: '',
    amount:      '',
    date:        todayLocalISO(),
  });

  // Collapsible "More details" — optional fields that don't clutter the main form
  const [showMore, setShowMore] = useState(false);
  const [payee, setPayee] = useState('');
  const [notes, setNotes] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [hasEnd, setHasEnd] = useState(false);
  const [endDate, setEndDate] = useState(todayLocalISO());
  const [tax, setTax] = useState<TaxInfo | undefined>(undefined);
  const [error, setError] = useState('');
  const [funding, setFunding] = useState<{ source: FundingSource; reserveAmount: string }>({ source: 'budget', reserveAmount: '' });
  const [shortfall, setShortfall] = useState<{ requested: number; available: number } | null>(null);
  const { availableOn } = useReserve();
  const { currency } = useBudgetStore();

  const resetMore = () => {
    setPayee(''); setNotes(''); setRepeat(false);
    setFrequency('monthly'); setHasEnd(false); setTax(undefined); setError('');
    setFunding({ source: 'budget', reserveAmount: '' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(formData.amount);
    if (!formData.category || !formData.description.trim() || !formData.amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please fill in category, description and a positive amount.');
      return;
    }
    if (repeat && hasEnd && endDate < formData.date) {
      setError('Repeat end date must be on or after the transaction date.');
      return;
    }
    const fundingErr = validateFunding({
      amount: parsedAmount, source: funding.source,
      reserveAmount: funding.source === 'split' ? parseFloat(funding.reserveAmount) : undefined,
    });
    if (fundingErr) { setError(fundingErr); return; }
    setError('');

    const requestedReserve = funding.source === 'reserve' ? parsedAmount
      : funding.source === 'split' ? parseFloat(funding.reserveAmount) : 0;

    // One-off expenses must not drive the reserve negative — the shortfall
    // dialog offers a budget+reserve fallback. Rules aren't checked: future
    // occurrences are validated when they appear.
    if (!repeat && requestedReserve > 0 && requestedReserve > availableOn(formData.date)) {
      setShortfall({ requested: requestedReserve, available: availableOn(formData.date) });
      return;
    }

    doSave(null);
  };

  /** Actually writes the txn/rule. `reservePart` overrides the split input when
   *  the shortfall dialog downgraded a full-reserve spend to a partial one. */
  const doSave = (reservePart: number | null) => {
    const parsedAmount = parseFloat(formData.amount);
    const buildFunding = (): Expense['funding'] => {
      if (funding.source === 'budget') return undefined;
      if (reservePart !== null) {
        return reservePart > 0 ? { source: 'split', reserveAmount: reservePart } : undefined;
      }
      if (funding.source === 'reserve') return { source: 'reserve' };
      return { source: 'split', reserveAmount: parseFloat(funding.reserveAmount) };
    };

    if (repeat) {
      // Create the rule — runRecurringGeneration (inside addRecurringRule)
      // generates the first occurrence exactly once; do NOT also addExpense.
      const rule: RecurringRule = {
        id: generateId('rec'),
        type: 'expense',
        amount: parsedAmount,
        category: formData.category,
        description: formData.description.trim(),
        city: selectedCity === 'Both' ? formCity : selectedCity,
        frequency,
        startDate: formData.date,
        endDate: hasEnd ? endDate : undefined,
        paused: false,
        createdAt: new Date().toISOString(),
        tax,
        funding: buildFunding(),
      };
      addRecurringRule(rule);
    } else {
      const [yearStr, monthStr] = formData.date.split('-');
      const expense: Expense = {
        id:          generateId('exp'),
        category:    formData.category,
        description: formData.description.trim(),
        amount:      parsedAmount,
        date:        formData.date,
        month:       monthStr,
        year:        parseInt(yearStr, 10),
        city:        selectedCity === 'Both' ? formCity : selectedCity,
        payee:       payee.trim() || undefined,
        notes:       notes.trim() || undefined,
        tax,
        funding:     buildFunding(),
      };
      addExpense(expense);
    }

    setFormData({
      category:    expenseCategories[0]?.id ?? '',
      description: '',
      amount:      '',
      date:        todayLocalISO(),
    });
    resetMore();
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text-500)',
    display: 'block',
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg-subtle)',
    border: '1.5px solid var(--border-default)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text-900)',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'all 0.15s',
  };

  const focusInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.background = 'var(--bg-surface)';
    e.target.style.borderColor = 'var(--brand-500)';
    e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)';
  };
  const blurInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.background = 'var(--bg-subtle)';
    e.target.style.borderColor = 'var(--border-default)';
    e.target.style.boxShadow = 'none';
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* City (Darren only) */}
      {selectedCity === 'Both' && (
        <div>
          <label style={labelStyle}>City</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Bangalore', 'Mangalore'].map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setFormCity(c)}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: 'var(--r-md)',
                  border: formCity === c ? '1.5px solid var(--brand-300)' : '1.5px solid var(--border-default)',
                  background: formCity === c ? 'var(--brand-600)' : 'var(--bg-subtle)',
                  color: formCity === c ? '#fff' : 'var(--text-600)',
                  fontSize: '0.8125rem',
                  fontWeight: formCity === c ? 700 : 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category */}
      <div>
        <label style={labelStyle}>Category</label>
        <CategorySelect
          categories={expenseCategories}
          value={formData.category}
          onChange={id => setFormData({ ...formData, category: id })}
          placeholder="Select expense category…"
        />
      </div>

      {/* Amount + Date */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <div>
          <label style={labelStyle}>Amount</label>
          <input
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={e => setFormData({ ...formData, amount: e.target.value })}
            placeholder="0.00"
            style={inputStyle}
            onFocus={focusInput}
            onBlur={blurInput}
          />
        </div>
        <div>
          <label style={labelStyle}>Date</label>
          <DateInput
            value={formData.date}
            onChange={date => setFormData({ ...formData, date })}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label style={labelStyle}>Description</label>
        <input
          type="text"
          value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
          placeholder="e.g., Weekly groceries"
          style={inputStyle}
          onFocus={focusInput}
          onBlur={blurInput}
        />
      </div>

      {/* Pay from (funding) */}
      <FundingPicker
        amount={parseFloat(formData.amount)}
        date={formData.date}
        source={funding.source}
        reserveAmount={funding.reserveAmount}
        onChange={setFunding}
      />

      {/* ── More details (payee, notes, repeat, tax) ── */}
      <div>
        <button
          type="button"
          onClick={() => setShowMore(v => !v)}
          aria-expanded={showMore}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: '0.78rem', fontWeight: 700, color: 'var(--brand-600)',
            fontFamily: 'inherit',
          }}
        >
          <ChevronDown size={13} style={{ transform: showMore ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          {showMore ? 'Fewer details' : 'More details'}
        </button>

        {showMore && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--border-default)' }}>
            {/* Payee */}
            <div>
              <label style={labelStyle}>Payee <span style={{ fontWeight: 400, color: 'var(--text-400)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
              <input
                type="text"
                value={payee}
                onChange={e => setPayee(e.target.value)}
                placeholder="e.g., DMart, Landlord, Netflix"
                style={inputStyle}
                onFocus={focusInput}
                onBlur={blurInput}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>Notes <span style={{ fontWeight: 400, color: 'var(--text-400)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any extra detail…"
                style={inputStyle}
                onFocus={focusInput}
                onBlur={blurInput}
              />
            </div>

            {/* Repeat */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={repeat}
                  onChange={e => setRepeat(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: 'var(--brand-600)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>
                  Repeat this expense
                </span>
              </label>
              {repeat && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 10 }}>
                  <div>
                    <label style={labelStyle} htmlFor="exp-freq">Repeats</label>
                    <select
                      id="exp-freq"
                      value={frequency}
                      onChange={e => setFrequency(e.target.value as RecurrenceFrequency)}
                      style={inputStyle}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={hasEnd} onChange={e => setHasEnd(e.target.checked)} style={{ accentColor: 'var(--brand-600)' }} />
                      Ends on
                    </label>
                    {hasEnd && <DateInput value={endDate} onChange={setEndDate} style={inputStyle} />}
                  </div>
                </div>
              )}
            </div>

            {/* Tax */}
            <TaxFields value={tax} onChange={setTax} defaultDate={formData.date} />
          </div>
        )}
      </div>

      {/* Inline validation message */}
      {error && (
        <div role="alert" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--red-500)', marginTop: -4 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: 'var(--r-md)',
          border: 'none',
          background: 'var(--red-500)',
          color: '#fff',
          fontSize: '0.9rem',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: 'var(--shadow-red)',
          transition: 'background 0.15s, transform 0.1s, box-shadow 0.15s',
          marginTop: 2,
        }}
        onMouseEnter={e => {
          (e.currentTarget.style.background = 'var(--red-600)');
          (e.currentTarget.style.transform = 'translateY(-1px)');
        }}
        onMouseLeave={e => {
          (e.currentTarget.style.background = 'var(--red-500)');
          (e.currentTarget.style.transform = 'none');
        }}
      >
        {repeat ? 'Add recurring expense' : 'Add Expense'}
      </button>

      {shortfall && (
        <ReserveShortfallDialog
          shortfall={shortfall}
          currency={currency}
          onUseAvailable={() => { setShortfall(null); doSave(shortfall.available); }}
          onChange={() => setShortfall(null)}
          onCancel={() => setShortfall(null)}
        />
      )}
    </form>
  );
}
