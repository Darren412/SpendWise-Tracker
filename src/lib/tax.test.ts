import { describe, it, expect } from 'vitest';
import { taxYearForDate, getEffectiveTax, summarizeTax } from '@/lib/tax';
import { Category } from '@/types';

describe('taxYearForDate', () => {
  it('maps Apr–Mar to the Indian FY label', () => {
    expect(taxYearForDate('2026-04-01')).toBe('FY 2026-27');
    expect(taxYearForDate('2026-06-15')).toBe('FY 2026-27');
    expect(taxYearForDate('2027-03-31')).toBe('FY 2026-27');
    expect(taxYearForDate('2026-03-31')).toBe('FY 2025-26');
    expect(taxYearForDate('2026-01-01')).toBe('FY 2025-26');
    expect(taxYearForDate('2026-12-31')).toBe('FY 2026-27');
  });
});

const cats: Category[] = [
  { id: 'c1', name: 'Donations', color: '#000', icon: '🎁', tax: { isTaxRelated: true, taxCategory: '80G', deductible: true } },
  { id: 'c2', name: 'Food', color: '#000', icon: '🍔' },
  { id: 'c3', name: 'Biz', color: '#000', icon: '💼', tax: { isTaxRelated: true, taxCategory: 'Business', deductible: false, taxYear: 'FY 2025-26' } },
  { id: 'c4', name: 'NoTax', color: '#000', icon: '📦', tax: { isTaxRelated: false, taxCategory: 'ShouldNotApply' } },
];

describe('getEffectiveTax', () => {
  it('returns the transaction tax when defined', () => {
    const own = { isTaxRelated: true, taxCategory: '80C' };
    expect(getEffectiveTax({ tax: own, category: 'c1' }, cats)).toBe(own);
  });

  it('transaction tax {isTaxRelated:false} overrides a tax-tagged category', () => {
    expect(getEffectiveTax({ tax: { isTaxRelated: false }, category: 'c1' }, cats))
      .toEqual({ isTaxRelated: false });
  });

  it('inherits category tax when tax-related', () => {
    const eff = getEffectiveTax({ category: 'c1', date: '2026-08-10' }, cats);
    expect(eff?.isTaxRelated).toBe(true);
    expect(eff?.taxCategory).toBe('80G');
  });

  it('fills missing taxYear from the transaction date when inheriting', () => {
    expect(getEffectiveTax({ category: 'c1', date: '2026-08-10' }, cats)?.taxYear).toBe('FY 2026-27');
    expect(getEffectiveTax({ category: 'c1', date: '2027-02-10' }, cats)?.taxYear).toBe('FY 2026-27');
  });

  it('keeps the category taxYear when pinned', () => {
    expect(getEffectiveTax({ category: 'c3', date: '2026-08-10' }, cats)?.taxYear).toBe('FY 2025-26');
  });

  it('returns undefined for non-tax categories and no category', () => {
    expect(getEffectiveTax({ category: 'c2' }, cats)).toBeUndefined();
    expect(getEffectiveTax({ category: 'c4' }, cats)).toBeUndefined();
    expect(getEffectiveTax({}, cats)).toBeUndefined();
  });
});

describe('summarizeTax', () => {
  const rows = [
    { _type: 'expense' as const, amount: 100, category: 'c1', date: '2026-05-01' }, // inherits 80G deductible
    { _type: 'expense' as const, amount: 50, category: 'c1', date: '2026-06-01' },
    { _type: 'expense' as const, amount: 200, category: 'c3', date: '2026-05-01' }, // inherits Business non-ded, pinned FY25-26
    { _type: 'expense' as const, amount: 80, category: 'c2', date: '2026-05-01', tax: { isTaxRelated: true, taxCategory: '80C', deductible: true } },
    { _type: 'income' as const, amount: 500, date: '2026-05-01', tax: { isTaxRelated: true, taxCategory: 'Freelance', deductible: false, taxYear: 'FY 2026-27' } },
    { _type: 'expense' as const, amount: 999, category: 'c2', date: '2026-05-01' }, // not tax related
  ];

  const summary = summarizeTax(rows, cats);

  it('groups by tax year derived from dates/category', () => {
    expect(Object.keys(summary).sort()).toEqual(['FY 2025-26', 'FY 2026-27']);
  });

  it('keeps deductible and non-deductible totals separate per category', () => {
    const fy27 = summary['FY 2026-27'];
    expect(fy27.expense['80G']).toEqual({ deductible: 150, nonDeductible: 0, count: 2 });
    expect(fy27.expense['80C']).toEqual({ deductible: 80, nonDeductible: 0, count: 1 });
    expect(fy27.income['Freelance']).toEqual({ deductible: 0, nonDeductible: 500, count: 1 });
  });

  it('honours a category-pinned tax year', () => {
    expect(summary['FY 2025-26'].expense['Business']).toEqual({ deductible: 0, nonDeductible: 200, count: 1 });
  });

  it('skips non-tax transactions entirely', () => {
    const all = Object.values(summary).flatMap(y => [...Object.values(y.expense), ...Object.values(y.income)]);
    expect(all.reduce((s, b) => s + b.count, 0)).toBe(5);
  });

  it('falls back to "Uncategorised" tax category', () => {
    const s = summarizeTax(
      [{ _type: 'expense' as const, amount: 10, date: '2026-05-01', tax: { isTaxRelated: true, deductible: true, taxYear: 'FY 2026-27' } }],
      []
    );
    expect(s['FY 2026-27'].expense['Uncategorised'].deductible).toBe(10);
  });
});
