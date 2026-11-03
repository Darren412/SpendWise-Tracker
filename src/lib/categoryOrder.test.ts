import { describe, it, expect, beforeEach } from 'vitest';
import { moveById, moveByOffset } from '@/lib/categoryOrder';
import { Category } from '@/types';

const cat = (id: string, name = id): Category => ({ id, name, color: '#000', icon: 'x' });

describe('moveById / moveByOffset', () => {
  const list = [cat('a'), cat('b'), cat('c'), cat('d')];

  it('moveById places the item at the target index', () => {
    expect(moveById(list, 'a', 'c').map(x => x.id)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveById(list, 'd', 'b').map(x => x.id)).toEqual(['a', 'd', 'b', 'c']);
    expect(moveById(list, 'a', 'd').map(x => x.id)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('moveByOffset swaps one position', () => {
    expect(moveByOffset(list, 'b', -1).map(x => x.id)).toEqual(['b', 'a', 'c', 'd']);
    expect(moveByOffset(list, 'b', 1).map(x => x.id)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('result is a pure permutation — same references, no loss', () => {
    const moved = moveById(list, 'a', 'd');
    expect(moved.length).toBe(list.length);
    expect(new Set(moved)).toEqual(new Set(list));
    moved.forEach((x) => expect(list).toContain(x));
    // object references preserved
    expect(moved[3]).toBe(list[0]);
    expect(moved[0]).toBe(list[1]);
    // input untouched
    expect(list.map(x => x.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('no-ops on unknown ids, same id, or out-of-range offsets', () => {
    expect(moveById(list, 'zz', 'a').map(x => x.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(moveById(list, 'a', 'zz').map(x => x.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(moveById(list, 'a', 'a').map(x => x.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(moveByOffset(list, 'zz', 1).map(x => x.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(moveByOffset(list, 'a', -1).map(x => x.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(moveByOffset(list, 'd', 1).map(x => x.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('moveCategory persistence (store + localStorage stub)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('moveCategory persists the new order to the budget_categories backup', async () => {
    const { useBudgetStore } = await import('@/store/budgetStore');
    const s = useBudgetStore.getState();

    const original = s.categories;
    const custom: Category[] = [
      cat('k1', 'K1'), cat('k2', 'K2'), cat('k3', 'K3'),
    ];
    useBudgetStore.setState({ categories: custom });

    s.moveCategory('k3', 'k1');

    expect(useBudgetStore.getState().categories.map(c => c.id)).toEqual(['k3', 'k1', 'k2']);
    const backedUp = JSON.parse(localStorage.getItem('budget_categories') ?? '[]') as Category[];
    expect(backedUp.map(c => c.id)).toEqual(['k3', 'k1', 'k2']);

    // restore for any other consumers of the module-level store
    useBudgetStore.setState({ categories: original });
  });
});
