import { describe, it, expect } from 'vitest';
import { defaultSpendClass, getSpendClass, isAutoClass } from './spendClass';
import { Category } from '@/types';

const cat = (id: string, name: string, spendClass?: Category['spendClass']): Category =>
  ({ id, name, color: '#000', icon: 'x', spendClass });

describe('defaultSpendClass — built-in ids', () => {
  it.each([
    ['1', 'flexible'], ['2', 'flexible'], ['3', 'essential'], ['4', 'discretionary'],
    ['5', 'essential'], ['6', 'discretionary'], ['7', 'discretionary'], ['8', 'flexible'],
  ] as const)('id %s → %s', (id, expected) => {
    expect(defaultSpendClass(cat(id, 'anything'))).toBe(expected);
  });
});

describe('defaultSpendClass — keywords', () => {
  it.each([
    ['House Rent', 'essential'],
    ['Car EMI', 'essential'],
    ['Health Insurance', 'essential'],
    ['School tuition', 'essential'],
    ['Groceries', 'flexible'],
    ['Fuel & petrol', 'flexible'],
    ['Internet bill', 'essential'], // 'bill' (essential) checked before 'internet' — first-match order
    ['Movie tickets', 'discretionary'],
    ['Swiggy orders', 'discretionary'],
    ['Streaming subscription', 'discretionary'],
    ['Miscellaneous stuff', 'flexible'],
  ] as const)('%s → %s', (name, expected) => {
    expect(defaultSpendClass(cat('u1', name))).toBe(expected);
  });
});

describe('getSpendClass / isAutoClass', () => {
  it('returns the override when set', () => {
    expect(getSpendClass(cat('u1', 'Groceries', 'discretionary'))).toBe('discretionary');
    expect(isAutoClass(cat('u1', 'Groceries', 'discretionary'))).toBe(false);
  });
  it('falls back to auto when undefined', () => {
    expect(getSpendClass(cat('u1', 'Groceries'))).toBe('flexible');
    expect(isAutoClass(cat('u1', 'Groceries'))).toBe(true);
  });
});
