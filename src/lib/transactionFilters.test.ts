import { describe, it, expect } from 'vitest';
import {
  applyTransactionFilters, countActiveFilters, describeFilters, EMPTY_FILTERS,
  TransactionFilters, FilterContext,
} from '@/lib/transactionFilters';
import { Category, Expense, Income } from '@/types';

const cats: Category[] = [
  { id: 'food', name: 'Food', color: '#000', icon: '🍔' },
  { id: 'rent', name: 'Rent', color: '#000', icon: '🏠', tax: { isTaxRelated: true, taxCategory: 'HRA', deductible: true } },
  { id: 'sal', name: 'Salary', color: '#000', icon: '💰', type: 'income' },
];

const exp = (over: Partial<Expense>): Expense => ({
  id: over.id ?? 'e1', category: 'food', description: 'x', amount: 100,
  date: '2026-11-10', month: '11', year: 2026, ...over,
});
const inc = (over: Partial<Income>): Income => ({
  id: over.id ?? 'i1', source: 'x', amount: 500,
  date: '2026-11-10', month: '11', year: 2026, ...over,
});

const ctx = (over: Partial<FilterContext> = {}): FilterContext => ({
  periodStart: new Date('2026-11-01T00:00:00'),
  periodEnd: new Date('2026-11-30T23:59:59'),
  selectedCity: 'Both',
  excludedCategoryIds: [],
  categories: cats,
  ...over,
});

const F = (over: Partial<TransactionFilters> = {}): TransactionFilters => ({ ...EMPTY_FILTERS, ...over });

const baseExpenses = [
  exp({ id: 'e1', description: 'Groceries', city: 'Bangalore', payee: 'DMart', notes: 'weekly', recurringId: 'r1' }),
  exp({ id: 'e2', description: 'Coffee', amount: 20, city: 'Mangalore', date: '2026-11-05' }),
  exp({ id: 'e3', description: 'Flat rent', category: 'rent', amount: 900, date: '2026-10-28' }),
  exp({ id: 'e4', description: 'Snack', amount: 10, category: 'food', date: '2026-11-15', tax: { isTaxRelated: true, taxCategory: '80C', deductible: false } }),
];
const baseIncome = [
  inc({ id: 'i1', source: 'Acme Corp', category: 'sal', recurringId: 'r2' }),
  inc({ id: 'i2', source: 'Gift', amount: 50, date: '2026-11-20' }),
];

describe('period & custom range', () => {
  it('filters to the financial period by default', () => {
    const rows = applyTransactionFilters(baseExpenses, [], F(), ctx());
    expect(rows.map(r => r.id).sort()).toEqual(['e1', 'e2', 'e4']); // e3 is in Oct
  });

  it('custom date range REPLACES the period when either bound set', () => {
    const rows = applyTransactionFilters(baseExpenses, [], F({ dateFrom: '2026-10-01' }), ctx());
    expect(rows.map(r => r.id)).toContain('e3');
    const only = applyTransactionFilters(baseExpenses, [], F({ dateFrom: '2026-10-01', dateTo: '2026-10-31' }), ctx());
    expect(only.map(r => r.id)).toEqual(['e3']);
  });
});

describe('legacy rules preserved', () => {
  it('global city scope drops expenses with a different city', () => {
    const rows = applyTransactionFilters(baseExpenses, [], F(), ctx({ selectedCity: 'Bangalore' }));
    expect(rows.map(r => r.id).sort()).toEqual(['e1', 'e4']); // e2 Mangalore out; city-less e3 outside period anyway
  });

  it('excludedCategoryIds applies to expenses only', () => {
    const rows = applyTransactionFilters(baseExpenses, baseIncome, F(), ctx({ excludedCategoryIds: ['food'] }));
    expect(rows.filter(r => r._type === 'expense')).toEqual([]); // e1/e2/e4 are food; e3 is out of period
    expect(rows.filter(r => r._type === 'income')).toHaveLength(2); // income unaffected
  });

  it('city filter defaults missing city to Bangalore', () => {
    const e5 = exp({ id: 'e5', description: 'NoCity', city: undefined });
    const rows = applyTransactionFilters([...baseExpenses, e5], [], F({ city: 'Bangalore' }), ctx());
    expect(rows.map(r => r.id)).toContain('e5');
    const mlr = applyTransactionFilters([...baseExpenses, e5], [], F({ city: 'Mangalore' }), ctx());
    expect(mlr.map(r => r.id)).toEqual(['e2']);
  });
});

describe('search', () => {
  it('matches description, payee, notes, category name, city, tax category (case-insensitive)', () => {
    expect(applyTransactionFilters(baseExpenses, [], F({ search: ' dmart ' }), ctx()).map(r => r.id)).toEqual(['e1']);
    expect(applyTransactionFilters(baseExpenses, [], F({ search: 'WEEKLY' }), ctx()).map(r => r.id)).toEqual(['e1']);
    expect(applyTransactionFilters(baseExpenses, [], F({ search: 'food' }), ctx()).map(r => r.id).sort()).toEqual(['e1', 'e2', 'e4']);
    expect(applyTransactionFilters(baseExpenses, [], F({ search: '80c' }), ctx()).map(r => r.id)).toEqual(['e4']);
    expect(applyTransactionFilters(baseExpenses, baseIncome, F({ search: 'acme' }), ctx()).map(r => r.id)).toEqual(['i1']);
  });
});

describe('category / type / amount / recurring / tax', () => {
  it('categoryIds: expenses and categorised income filtered; uncategorised income excluded', () => {
    const rows = applyTransactionFilters(baseExpenses, baseIncome, F({ categoryIds: ['rent', 'sal'] }), ctx());
    // rent expense is outside the period → only sal income remains
    expect(rows.map(r => r.id)).toEqual(['i1']);
  });

  it('type filter', () => {
    expect(applyTransactionFilters(baseExpenses, baseIncome, F({ type: 'expense' }), ctx()).every(r => r._type === 'expense')).toBe(true);
    expect(applyTransactionFilters(baseExpenses, baseIncome, F({ type: 'income' }), ctx()).map(r => r.id)).toEqual(['i1', 'i2']);
  });

  it('amount bounds', () => {
    expect(applyTransactionFilters(baseExpenses, [], F({ amountMin: 50 }), ctx()).map(r => r.id).sort()).toEqual(['e1']);
    expect(applyTransactionFilters(baseExpenses, [], F({ amountMax: 30 }), ctx()).map(r => r.id).sort()).toEqual(['e2', 'e4']);
    expect(applyTransactionFilters(baseExpenses, [], F({ amountMin: 30, amountMax: 200 }), ctx()).map(r => r.id)).toEqual(['e1']);
  });

  it('recurring only/exclude', () => {
    const only = applyTransactionFilters(baseExpenses, baseIncome, F({ recurring: 'only' }), ctx());
    expect(only.map(r => r.id).sort()).toEqual(['e1', 'i1']);
    const excl = applyTransactionFilters(baseExpenses, baseIncome, F({ recurring: 'exclude' }), ctx());
    expect(excl.map(r => r.id).sort()).toEqual(['e2', 'e4', 'i2']);
  });

  it('tax only/deductible/non-deductible/exclude incl. category inheritance', () => {
    const withRent = applyTransactionFilters(
      [exp({ id: 'r1', category: 'rent', date: '2026-11-03' }), ...baseExpenses], baseIncome, F({ tax: 'only' }), ctx());
    expect(withRent.map(r => r.id).sort()).toEqual(['e4', 'r1']); // rent inherits HRA deductible; e4 own 80C non-ded
    expect(applyTransactionFilters(
      [exp({ id: 'r1', category: 'rent', date: '2026-11-03' }), ...baseExpenses], [], F({ tax: 'deductible' }), ctx())
      .map(r => r.id)).toEqual(['r1']);
    expect(applyTransactionFilters(
      [exp({ id: 'r1', category: 'rent', date: '2026-11-03' }), ...baseExpenses], [], F({ tax: 'non-deductible' }), ctx())
      .map(r => r.id)).toEqual(['e4']);
    const excl = applyTransactionFilters(baseExpenses, baseIncome, F({ tax: 'exclude' }), ctx());
    expect(excl.map(r => r.id).sort()).toEqual(['e1', 'e2', 'i1', 'i2']);
  });
});

describe('combinations & empty', () => {
  it('search + amount + type', () => {
    const rows = applyTransactionFilters(baseExpenses, baseIncome, F({ search: 'a', type: 'expense', amountMin: 15, amountMax: 100 }), ctx());
    expect(rows.map(r => r.id).sort()).toEqual(['e1', 'e2']); // e1 'Groceries'... 'a'? e4 'Snack' <15
  });

  it('category + tax + custom range', () => {
    const rows = applyTransactionFilters(
      [exp({ id: 'r1', category: 'rent', date: '2026-10-05' })],
      [], F({ categoryIds: ['rent'], tax: 'only', dateFrom: '2026-10-01', dateTo: '2026-10-31' }), ctx());
    expect(rows.map(r => r.id)).toEqual(['r1']);
  });

  it('empty result when nothing matches', () => {
    expect(applyTransactionFilters(baseExpenses, baseIncome, F({ search: 'zzz-nothing' }), ctx())).toEqual([]);
  });
});

describe('countActiveFilters', () => {
  it('counts each non-default dimension', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters(F({ search: 'x', amountMin: 1, tax: 'only', type: 'income' }))).toBe(4);
    expect(countActiveFilters(F({ dateFrom: '2026-01-01', categoryIds: ['a'], city: 'Bangalore', recurring: 'exclude' }))).toBe(4);
  });
});

describe('funding filter', () => {
  const funded = [
    exp({ id: 'fb', description: 'Budget txn', date: '2026-11-10' }),
    exp({ id: 'fr', description: 'Balance txn', date: '2026-11-10', funding: { source: 'balance' } }),
    exp({ id: 'fs', description: 'Split txn', date: '2026-11-10', funding: { source: 'split', balanceAmount: 40 } }),
    exp({ id: 'fl', description: 'Legacy reserve txn', date: '2026-11-10', funding: { source: 'reserve' } }), // legacy → 'balance'
  ];

  it('all → every expense + income; specific → matching source only, income excluded', () => {
    expect(applyTransactionFilters(funded, baseIncome, F(), ctx()).map(r => r.id)).toEqual(
      ['fb', 'fr', 'fs', 'fl', 'i1', 'i2']);
    expect(applyTransactionFilters(funded, baseIncome, F({ funding: 'balance' }), ctx()).map(r => r.id)).toEqual(['fr', 'fl']);
    expect(applyTransactionFilters(funded, baseIncome, F({ funding: 'split' }), ctx()).map(r => r.id)).toEqual(['fs']);
    expect(applyTransactionFilters(funded, baseIncome, F({ funding: 'budget' }), ctx()).map(r => r.id)).toEqual(['fb']);
  });

  it('income is excluded whenever a non-all funding filter is set (even type=income)', () => {
    expect(applyTransactionFilters([], baseIncome, F({ funding: 'balance', type: 'income' }), ctx())).toEqual([]);
  });

  it('count + describe cover the funding dimension', () => {
    expect(countActiveFilters(F({ funding: 'balance' }))).toBe(1);
    expect(describeFilters(F({ funding: 'balance' }), cats, '₹').join(' ')).toContain('Funding: existing balance');
  });
});
