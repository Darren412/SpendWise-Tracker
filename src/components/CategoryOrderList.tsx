'use client';

import { useState } from 'react';
import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { Category, TaxInfo } from '@/types';
import TaxFields from '@/components/TaxFields';
import { todayLocalISO } from '@/utils/financialCycle';

// Visually-hidden helper (for the aria-live announcements)
const srOnly: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
};

function Section({
  title,
  cats,
  onMove,
  taxEditId,
  setTaxEditId,
  onTaxChange,
}: {
  title: string;
  cats: Category[];
  onMove: (cat: Category, section: Category[], offset: -1 | 1) => void;
  taxEditId: string | null;
  setTaxEditId: (id: string | null) => void;
  onTaxChange: (id: string, tax: TaxInfo | undefined) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const { moveCategory } = useBudgetStore();

  if (cats.length === 0) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
        {title}
      </div>
      <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {cats.map((cat, idx) => (
          <div key={cat.id} role="listitem">
            <div
              tabIndex={0}
              draggable
              onDragStart={e => { setDragId(cat.id); e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={e => {
                e.preventDefault();
                if (dragId && dragId !== cat.id) moveCategory(dragId, cat.id);
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
              onKeyDown={e => {
                if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); onMove(cat, cats, -1); }
                if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); onMove(cat, cats, 1); }
              }}
              aria-label={`${cat.name}, position ${idx + 1} of ${cats.length}. Press Alt plus arrow keys to reorder.`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 8px',
                background: dragId === cat.id ? 'var(--brand-50)' : 'var(--bg-surface)',
                border: `1px solid ${dragId === cat.id ? 'var(--brand-300)' : 'var(--border-default)'}`,
                borderRadius: 'var(--r-md)',
                outline: 'none',
              }}
            >
              <GripVertical size={13} style={{ color: 'var(--text-300)', cursor: 'grab', flexShrink: 0 }} aria-hidden="true" />
              <div style={{
                width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                background: `${cat.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
              }}>
                {cat.icon}
              </div>
              <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-800)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cat.name}
                {cat.tax?.isTaxRelated && (
                  <span style={{ marginLeft: 6, fontSize: '0.625rem', fontWeight: 800, color: 'var(--amber-600)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    tax
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setTaxEditId(taxEditId === cat.id ? null : cat.id)}
                aria-label={`Edit tax defaults for ${cat.name}`}
                aria-expanded={taxEditId === cat.id}
                title="Tax defaults"
                style={{
                  padding: '4px 9px', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: '0.68rem', fontWeight: 700,
                  border: taxEditId === cat.id ? '1px solid var(--amber-600)' : '1px solid var(--border-default)',
                  background: taxEditId === cat.id || cat.tax?.isTaxRelated ? 'var(--amber-50)' : 'var(--bg-subtle)',
                  color: taxEditId === cat.id || cat.tax?.isTaxRelated ? 'var(--amber-600)' : 'var(--text-500)',
                }}
              >
                Tax
              </button>
              <button
                type="button"
                onClick={() => onMove(cat, cats, -1)}
                disabled={idx === 0}
                aria-label={`Move ${cat.name} up`}
                style={{
                  width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border-default)',
                  background: 'var(--bg-subtle)', cursor: idx === 0 ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: idx === 0 ? 'var(--text-300)' : 'var(--text-500)',
                }}
              >
                <ChevronUp size={12} />
              </button>
              <button
                type="button"
                onClick={() => onMove(cat, cats, 1)}
                disabled={idx === cats.length - 1}
                aria-label={`Move ${cat.name} down`}
                style={{
                  width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border-default)',
                  background: 'var(--bg-subtle)', cursor: idx === cats.length - 1 ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: idx === cats.length - 1 ? 'var(--text-300)' : 'var(--text-500)',
                }}
              >
                <ChevronDown size={12} />
              </button>
            </div>

            {/* Inline tax editor */}
            {taxEditId === cat.id && (
              <div style={{
                margin: '4px 0 6px', padding: 12,
                background: 'var(--bg-subtle)',
                border: '1px dashed var(--border-strong)',
                borderRadius: 'var(--r-md)',
              }}>
                <TaxFields
                  value={cat.tax}
                  onChange={tax => onTaxChange(cat.id, tax)}
                  defaultDate={todayLocalISO()}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Categories order editor: expense/income sections rendered in store order.
 * Reordering maps to moveCategory on the GLOBAL category array; the Tax
 * toggle edits category-level tax defaults via updateCategory (reorder never
 * calls updateCategory).
 */
export default function CategoryOrderList() {
  const { categories, moveCategory, updateCategory } = useBudgetStore();
  const [announcement, setAnnouncement] = useState('');
  const [taxEditId, setTaxEditId] = useState<string | null>(null);

  // Same type split as CategoryFilterBar / the txn forms
  const expenseCats = categories.filter(c => c.type !== 'income');
  const incomeCats = categories.filter(c => c.type === 'income' || c.type === 'both');

  const move = (cat: Category, section: Category[], offset: -1 | 1) => {
    const idx = section.findIndex(c => c.id === cat.id);
    const target = section[idx + offset];
    if (!target) return;
    moveCategory(cat.id, target.id);
    setAnnouncement(`${cat.name} moved to position ${idx + offset + 1} of ${section.length}`);
  };

  const onTaxChange = (id: string, tax: TaxInfo | undefined) => {
    updateCategory(id, { tax });
  };

  return (
    <div>
      <div aria-live="polite" style={srOnly}>{announcement}</div>
      <Section title="Expense categories" cats={expenseCats} onMove={move} taxEditId={taxEditId} setTaxEditId={setTaxEditId} onTaxChange={onTaxChange} />
      <Section title="Income categories" cats={incomeCats} onMove={move} taxEditId={taxEditId} setTaxEditId={setTaxEditId} onTaxChange={onTaxChange} />
      <p style={{ fontSize: '0.72rem', color: 'var(--text-400)', marginTop: 8 }}>
        Drag to reorder, or use the arrow buttons. Keyboard: focus a row and press Alt + ↑ / Alt + ↓.
      </p>
    </div>
  );
}
