import { describe, it, expect } from 'vitest';
import { analyzeSavings, SavingsInput, SavingsAnalysis } from './savings';
import { Category, Expense, RecurringRule } from '@/types';

const CATS: Category[] = [
  { id: 'rent',   name: 'House Rent',   color: '#111', icon: '🏠' },
  { id: 'groc',   name: 'Groceries',    color: '#222', icon: '🛒' },
  { id: 'dining', name: 'Dining Out',   color: '#333', icon: '🍽️' },
  { id: 'fun',    name: 'Movies',       color: '#444', icon: '🎬' },
];

let uid = 0;
const ALPHA = 'abcdefghijklmnopqrstuvwxyz';
const word = (i: number) => ALPHA[i % 26] + ALPHA[Math.floor(i / 26) % 26] + ALPHA[Math.floor(i / 676) % 26];
const exp = (category: string, amount: number, date: string, desc?: string, extra: Partial<Expense> = {}): Expense => ({
  id: `e${++uid}`,
  category, amount, date,
  month: date.slice(5, 7), year: parseInt(date.slice(0, 4), 10),
  description: desc ?? `purchase ${word(uid)}`, // unique word-descs avoid accidental subscription detection
  ...extra,
});

// spread `total` as `n` txns across a month; unique desc per txn
const monthSpend = (cat: string, yyyymm: string, txns: [number, number][]): Expense[] =>
  txns.map(([amt, day]) => exp(cat, amt, `${yyyymm}-${String(day).padStart(2, '0')}`));

const repeatMonthly = (cat: string, months: string[], amount: number, day = 5): Expense[] =>
  months.flatMap(m => [exp(cat, amount, `${m}-${String(day).padStart(2, '0')}`)]);

const base = (overrides: Partial<SavingsInput> = {}): SavingsInput => ({
  expenses: [], categories: CATS, recurring: [], categoryBudgets: {},
  financialCycleStart: 1,
  selectedMonth: '07', selectedYear: 2026,      // July 2026
  selectedCity: 'Both', excludedCategoryIds: [],
  baselineWindow: 3, today: '2026-07-15',
  dismissed: [], mutedCategoryIds: [], spendingTargets: {}, currency: 'INR',
  ...overrides,
});

const opp = (a: SavingsAnalysis, id: string) =>
  a.status === 'ok' ? [...a.opportunities, ...a.dismissedOpportunities].find(o => o.id === id) : undefined;

// Standard baseline: Mar, Apr, May, Jun all have dining spend → June-complete analyses
const JUNE = { selectedMonth: '06', today: '2026-07-15' } as const;
const BASE3 = ['2026-03', '2026-04', '2026-05']; // baseline when analysing June

describe('insufficient history', () => {
  it('<3 baseline months → insufficient, no estimates', () => {
    const a = analyzeSavings(base({
      expenses: repeatMonthly('dining', ['2026-04', '2026-05', '2026-06'], 2000),
      ...JUNE,
    }));
    expect(a.status).toBe('insufficient');
    if (a.status === 'insufficient') {
      expect(a.monthsAvailable).toBe(2); // Apr & May are the only complete periods ≥ history start
      expect(a.monthsNeeded).toBe(3);
    }
  });
});

describe('baseline window', () => {
  it('excludes months before history start, counts zero-spend months after it', () => {
    const a = analyzeSavings(base({
      expenses: [
        ...repeatMonthly('groc', ['2026-01'], 3000),  // history start = Jan
        ...repeatMonthly('groc', ['2026-05', '2026-06'], 3000),
      ],
      ...JUNE,
    }));
    expect(a.status).toBe('ok');
    if (a.status === 'ok') {
      expect(a.windowUsed).toBe(3);
      expect(a.baselineLabels).toEqual(["Mar '26", "Apr '26", "May '26"]); // Mar & Apr = 0 spend, still count
    }
  });

  it('windowUsed < window when fewer eligible months exist', () => {
    const a = analyzeSavings(base({
      expenses: repeatMonthly('groc', ['2026-02', '2026-03', '2026-04', '2026-05'], 1000),
      baselineWindow: 12, ...JUNE,
    }));
    if (a.status === 'ok') {
      expect(a.windowUsed).toBe(4); // only Feb–May eligible (history starts Feb)
    }
  });
});

describe('analysis period', () => {
  it('falls back to last complete month when <7 days elapsed', () => {
    const a = analyzeSavings(base({
      expenses: repeatMonthly('groc', ['2026-04', '2026-05', '2026-06'], 3000),
      today: '2026-07-03',
    }));
    if (a.status === 'ok') {
      expect(a.periodKey).toBe('2026-06');
      expect(a.inProgress).toBe(false);
      expect(a.basisNote).toContain('only 3 days');
      expect(a.baselineLabels).toEqual(["Mar '26", "Apr '26", "May '26"]);
    }
  });

  it('same-point-in-month comparison for in-progress periods', () => {
    // baseline: 500 in first 15 days + 500 later → avgToDate 500, avgMonthly 1000
    const a = analyzeSavings(base({
      expenses: [
        ...monthSpend('dining', '2026-04', [[500, 3], [500, 20]]),
        ...monthSpend('dining', '2026-05', [[500, 3], [500, 20]]),
        ...monthSpend('dining', '2026-06', [[500, 3], [500, 20]]),
        ...monthSpend('dining', '2026-07', [[1000, 3]]),
      ],
    }));
    const o = opp(a, 'cat:dining');
    expect(o).toBeDefined();
    expect(o!.avgToDate).toBe(500);
    expect(o!.avgMonthly).toBe(1000);
    expect(o!.currentToDate).toBe(1000);
    expect(o!.pctVsAvg).toBe(100);
    expect(o!.habitualPctVsAvg).toBe(100);
    // additive projection: habitual baseline 1000 + excess 500 = 1500
    expect(o!.habitualProjected).toBe(1500);
    expect(o!.projectedMonthly).toBe(1500);
    expect(o!.estMonthly).toBe(600);        // 1500 − (1000 × 0.9)
  });

  it('below-pace months project the typical remainder, floored at spend to date', () => {
    // baseline 500 early + 500 late; July only 200 so far → projected = 1000 − 300
    const a = analyzeSavings(base({
      expenses: [
        ...monthSpend('dining', '2026-04', [[500, 3], [500, 20]]),
        ...monthSpend('dining', '2026-05', [[500, 3], [500, 20]]),
        ...monthSpend('dining', '2026-06', [[500, 3], [500, 20]]),
        ...monthSpend('dining', '2026-07', [[200, 3]]),
      ],
      categoryBudgets: { dining: 150 }, // over budget → signal (c) keeps the opp
    }));
    const o = opp(a, 'cat:dining');
    expect(o).toBeDefined();
    expect(o!.habitualProjected).toBe(700);   // max(200, 1000 − 300)
    expect(o!.projectedMonthly).toBe(700);
    expect(o!.estMonthly).toBe(550);          // habitual 700 − budget target 150
  });
});

describe('priority tiers', () => {
  const mk = (june: number, extra: Partial<SavingsInput> = {}) =>
    analyzeSavings(base({
      expenses: [...repeatMonthly('dining', BASE3, 4000), exp('dining', june, '2026-06-10')],
      ...JUNE, ...extra,
    }));

  it('exactly +10% → Medium', () => {
    expect(opp(mk(4400), 'cat:dining')!.priority).toBe('Medium');
  });
  it('exactly +20% → Medium', () => {
    expect(opp(mk(4800), 'cat:dining')!.priority).toBe('Medium');
  });
  it('+20.1% → High', () => {
    expect(opp(mk(4805), 'cat:dining')!.priority).toBe('High');
  });
  it('+9.9% fires only via another signal → Low', () => {
    const a = mk(4396, { categoryBudgets: { dining: 4300 } }); // 102% of budget → signal (c)
    const o = opp(a, 'cat:dining');
    expect(o).toBeDefined();
    expect(o!.pctVsAvg).toBeCloseTo(9.9, 1);
    expect(o!.priority).toBe('Low');
  });
  it('+5% on a huge base → no opportunity (absolute amount never raises priority)', () => {
    const a = analyzeSavings(base({
      expenses: [...repeatMonthly('dining', BASE3, 40000), exp('dining', 42000, '2026-06-10')],
      ...JUNE,
    }));
    expect(opp(a, 'cat:dining')).toBeUndefined();
  });
});

describe('essential categories', () => {
  const mk = (june: number) =>
    analyzeSavings(base({
      expenses: [...repeatMonthly('rent', BASE3, 10000), exp('rent', june, '2026-06-01')],
      ...JUNE,
    }));

  it('+25% → no opportunity (essential needs ≥30%)', () => {
    expect(opp(mk(12500), 'cat:rent')).toBeUndefined();
  });
  it('+35% → Medium (essential capped, ≤50%)', () => {
    const o = opp(mk(13500), 'cat:rent');
    expect(o).toBeDefined();
    expect(o!.priority).toBe('Medium');
    expect(o!.spendClass).toBe('essential');
  });
  it('+60% → High (cap lifted above 50%)', () => {
    expect(opp(mk(16000), 'cat:rent')!.priority).toBe('High');
  });
});

describe('anomaly handling', () => {
  it('one-off spike is excluded from the habitual % and the estimate', () => {
    // baseline dining: 10 txns of ~200/mo → mean 200, small sd; June: 10×200 + one ₹3,000 spike
    const pattern: [number, number][] = [[180, 2], [190, 4], [200, 6], [210, 8], [220, 10], [180, 12], [190, 14], [200, 16], [210, 18], [220, 20]];
    const a = analyzeSavings(base({
      expenses: [
        ...monthSpend('dining', '2026-03', pattern),
        ...monthSpend('dining', '2026-04', pattern),
        ...monthSpend('dining', '2026-05', pattern),
        ...monthSpend('dining', '2026-06', [[200, 2], [200, 4], [200, 6], [200, 8], [200, 10], [200, 12], [200, 14], [200, 16], [200, 18], [200, 20]]),
        exp('dining', 3000, '2026-06-15', 'wedding gift'),
      ],
      ...JUNE,
    }));
    const o = opp(a, 'cat:dining');
    expect(o).toBeDefined();
    // overall spend is +150% vs avg, but habitual spend is flat → Low tier
    expect(o!.pctVsAvg).toBe(150);
    expect(o!.habitualPctVsAvg).toBe(0);
    expect(o!.priority).toBe('Low');
    expect(o!.anomalyTxnIds).toHaveLength(1);
    const reasons = o!.reasons.join(' ');
    expect(reasons).toContain('unusual expense');
    expect(reasons).toContain('vs usual');         // "Excluding one unusual expense … +0% vs usual"
    expect(reasons).toContain('may not repeat');   // anomaly ≥50% of overall above-avg
    expect(o!.estMonthly).toBe(500);               // 10 small txns → 2000 − 25% of 2000
    expect(o!.habitualToDate).toBe(2000);          // spike removed
  });

  it('uniform-ish grocery spend never trips the anomaly rule (median check)', () => {
    // baseline 2000/2400/3200 → mean+2σ ≈ 3531, median 2400 → 4400 is >2σ but <2×median
    const pattern: [number, number][] = [[2000, 3], [2400, 12], [3200, 22]];
    const a = analyzeSavings(base({
      expenses: [
        ...monthSpend('groc', '2026-03', pattern),
        ...monthSpend('groc', '2026-04', pattern),
        ...monthSpend('groc', '2026-05', pattern),
        ...monthSpend('groc', '2026-06', [[2000, 3], [2400, 12], [4400, 20]]),
      ],
      ...JUNE,
    }));
    const o = opp(a, 'cat:groc');
    expect(o).toBeDefined(); // +15.8% habitual → Medium via signal (a)
    expect(o!.anomalyTxnIds).toHaveLength(0);
    expect(o!.reasons.join(' ')).not.toContain('unusual');
    expect(o!.habitualPctVsAvg).toBeCloseTo(15.8, 1);
  });

  it('a large one-off against small typical txns IS an anomaly', () => {
    // June = habitual 2590 (+30% → signal a) + a ₹5,000 one-off
    const pattern: [number, number][] = [[380, 3], [400, 8], [420, 13], [400, 19], [390, 25]];
    const a = analyzeSavings(base({
      expenses: [
        ...monthSpend('dining', '2026-03', pattern),
        ...monthSpend('dining', '2026-04', pattern),
        ...monthSpend('dining', '2026-05', pattern),
        ...monthSpend('dining', '2026-06', pattern),
        exp('dining', 600, '2026-06-16'),
        exp('dining', 5000, '2026-06-15', 'anniversary'),
      ],
      ...JUNE,
    }));
    const o = opp(a, 'cat:dining');
    expect(o).toBeDefined();
    expect(o!.anomalyTxnIds).toHaveLength(1);
    expect(o!.habitualToDate).toBe(2590); // spike excluded from habitual
    expect(o!.habitualPctVsAvg).toBeCloseTo(30.2, 0);
    expect(o!.reasons.join(' ')).toContain('unusual expense');
  });
});

describe('frequent small purchases', () => {
  it('many small txns below the median threshold create an opportunity', () => {
    // baseline dining 3000/mo in ~300 txns → threshold ~300; June: 12 × ₹100
    const pattern: [number, number][] = [[300, 3], [300, 7], [300, 11], [300, 15], [300, 19], [300, 23], [300, 25], [300, 27], [300, 28], [300, 30]];
    const june: [number, number][] = Array.from({ length: 12 }, (_, i) => [100, i + 1]);
    const a = analyzeSavings(base({
      expenses: [
        ...monthSpend('dining', '2026-03', pattern),
        ...monthSpend('dining', '2026-04', pattern),
        ...monthSpend('dining', '2026-05', pattern),
        ...monthSpend('dining', '2026-06', june),
      ],
      ...JUNE,
    }));
    const o = opp(a, 'cat:dining');
    expect(o).toBeDefined();
    expect(o!.smallTxnIds.length).toBe(12);
    expect(o!.reasons.join(' ')).toContain('small purchases');
    expect(o!.estMonthly).toBe(300); // habitual 1200 − (1200 − 0.25×1200)
  });
});

describe('recurring separation (no double counting)', () => {
  const rule: RecurringRule = {
    id: 'r1', type: 'expense', amount: 1000, category: 'dining', description: 'Netflix',
    frequency: 'monthly', startDate: '2026-01-01', paused: false, createdAt: '2026-01-01T00:00:00Z',
  };
  const mk = () => analyzeSavings(base({
    expenses: [
      ...BASE3.flatMap(m => [
        exp('dining', 1000, `${m}-01`, 'Netflix', { recurringId: 'r1' }),
        exp('dining', 1000, `${m}-10`),
      ]),
      exp('dining', 1000, '2026-06-01', 'Netflix', { recurringId: 'r1' }),
      exp('dining', 1500, '2026-06-10'),
    ],
    recurring: [rule],
    ...JUNE,
  }));

  it('category estimate covers habitual spend only; subscriptions listed once', () => {
    const a = mk();
    const d = opp(a, 'cat:dining')!;
    const s = opp(a, 'subscriptions')!;
    expect(d.recurringTxnIds).toHaveLength(1); // the June StreamFlix/Netflix txn
    expect(d.estMonthly).toBe(600);              // 1500 habitual − 900 target (baseline habitual 1000 × 0.9)
    expect(s.estMonthly).toBe(250);              // 25% of 1000 non-essential
    expect(s.priority).toBe('Medium');           // 1000 ≥ 5% of avgTotal 2000
    if (a.status === 'ok') {
      expect(a.potentialMonthly).toBe(850);      // 600 + 250, nothing double counted
      expect(a.potentialMonthly).toBe(a.opportunities.filter(o => o.includedInTotal).reduce((x, o) => x + o.estMonthly, 0));
    }
  });

  it('what-if is never included in totals', () => {
    const a = mk();
    if (a.status === 'ok') {
      expect(a.whatIf.estMonthly).toBe(150);     // 10% of 1500 discretionary habitual projected
      expect(a.potentialMonthly).toBe(850);      // does not include the 150
    }
  });
});

describe('dismissal & muting', () => {
  const expenses = [
    ...BASE3.flatMap(m => [exp('dining', 2000, `${m}-10`), exp('groc', 5000, `${m}-10`)]),
    exp('dining', 3000, '2026-06-10'), exp('groc', 5000, '2026-06-10'),
  ];
  it('dismissed for this period → moved to dismissedOpportunities, excluded from totals', () => {
    const a = analyzeSavings(base({
      expenses, ...JUNE,
      dismissed: ['2026-06:cat:dining'],
    }));
    if (a.status === 'ok') {
      expect(a.opportunities.find(o => o.id === 'cat:dining')).toBeUndefined();
      expect(a.dismissedOpportunities.find(o => o.id === 'cat:dining')).toBeDefined();
      expect(a.potentialMonthly).toBe(a.opportunities.reduce((s, o) => s + o.estMonthly, 0));
    }
  });
  it('muted category never suggested', () => {
    const a = analyzeSavings(base({ expenses, ...JUNE, mutedCategoryIds: ['dining'] }));
    expect(opp(a, 'cat:dining')).toBeUndefined();
  });
  it('a dismissal keyed to a different period does not hide this one', () => {
    const a = analyzeSavings(base({
      expenses, ...JUNE,
      dismissed: ['2026-05:cat:dining'],
    }));
    expect(a.status === 'ok' && a.opportunities.find(o => o.id === 'cat:dining')).toBeDefined();
  });
});

describe('estimates', () => {
  it('estMonthly rounds to the nearest 10', () => {
    const a = analyzeSavings(base({
      expenses: [...repeatMonthly('dining', BASE3, 4000), exp('dining', 4450, '2026-06-10')],
      ...JUNE,
    }));
    const o = opp(a, 'cat:dining')!;
    expect(o.estMonthly % 10).toBe(0);
    expect(o.estAnnual).toBe(o.estMonthly * 12);
  });
  it('new category (no baseline) reports at Low with no % shown', () => {
    const a = analyzeSavings(base({
      expenses: [
        ...repeatMonthly('groc', BASE3, 5000),
        exp('groc', 5000, '2026-06-10'),
        exp('dining', 800, '2026-06-12'),   // new category, ≥5% of avgTotal (5000×0.05=250)
      ],
      ...JUNE,
    }));
    const o = opp(a, 'cat:dining');
    expect(o).toBeDefined();
    expect(o!.pctVsAvg).toBeNull();
    expect(o!.priority).toBe('Low');
  });
});

// ── Worked example used in the handoff report ────────────────────────────────
describe('worked example (6-month realistic dataset)', () => {
  it('produces sane opportunities', () => {
    const R = (id: string, cat: string, amount: number, desc: string, frequency: RecurringRule['frequency'] = 'monthly'): RecurringRule =>
      ({ id, type: 'expense', amount, category: cat, description: desc, frequency, startDate: '2026-01-01', paused: false, createdAt: '2026-01-01T00:00:00Z' });
    const months = ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
    const july = '2026-07';
    const expenses: Expense[] = [
      // Rent: stable essential 15000/mo (never an opportunity)
      ...months.flatMap(m => [exp('rent', 15000, `${m}-01`, 'House rent')]),
      exp('rent', 15000, `${july}-01`, 'House rent'),
      // Groceries: ~8000/mo habitual, July pace up ~30%
      ...months.flatMap(m => [
        exp('groc', 3000, `${m}-03`), exp('groc', 2500, `${m}-12`), exp('groc', 2500, `${m}-22`),
      ]),
      exp('groc', 3200, `${july}-03`), exp('groc', 3400, `${july}-12`), // ~10400 projected vs 8000 avg
      // Dining: ~4000/mo + Netflix-like subscription 999; July spiking + one-off party 5000
      ...months.flatMap(m => [
        exp('dining', 999, `${m}-02`, 'StreamFlix', { recurringId: 'r-sub1' }),
        exp('dining', 1500, `${m}-08`), exp('dining', 1300, `${m}-16`), exp('dining', 1200, `${m}-25`),
      ]),
      exp('dining', 999, `${july}-02`, 'StreamFlix', { recurringId: 'r-sub1' }),
      exp('dining', 1600, `${july}-06`), exp('dining', 1800, `${july}-12`), exp('dining', 5000, `${july}-13`, 'Birthday party'),
      // Movies: ~1200/mo discretionary, small frequent purchases in July
      ...months.flatMap(m => [exp('fun', 600, `${m}-10`), exp('fun', 600, `${m}-24`)]),
      ...Array.from({ length: 9 }, (_, i) => exp('fun', 250, `${july}-${String(i + 1).padStart(2, '0')}`)),
    ];
    const a = analyzeSavings(base({
      expenses,
      categories: CATS,
      recurring: [R('r-sub1', 'dining', 999, 'StreamFlix')],
      today: '2026-07-15',
    }));
    expect(a.status).toBe('ok');
    if (a.status === 'ok') {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(a.opportunities.map(o => ({
        id: o.id, name: o.name, priority: o.priority, pctVsAvg: o.pctVsAvg,
        habitualPctVsAvg: o.habitualPctVsAvg ?? null,
        projectedMonthly: o.projectedMonthly,
        estMonthly: o.estMonthly, estAnnual: o.estAnnual, score: o.score,
        suggestedReductionPct: o.suggestedReductionPct, reasons: o.reasons,
      })), null, 1));
      expect(a.opportunities.length).toBeGreaterThan(0);
      expect(a.opportunities.every(o => o.estMonthly % 10 === 0)).toBe(true);

      // Sanity bound: no estimate can exceed the spend it applies to, and the
      // total can't exceed habitual projections + non-essential recurring
      const nonEssRecurring = opp(a, 'subscriptions')?.subscriptionItems
        ?.filter(i => !i.isEssential).reduce((s, i) => s + i.monthly, 0) ?? 0;
      for (const o of a.opportunities) {
        const base = o.kind === 'subscriptions' ? nonEssRecurring : (o.habitualProjected ?? Infinity);
        expect(o.estMonthly).toBeLessThanOrEqual(Math.floor(base));
      }
      const catBase = a.opportunities.reduce((s, o) =>
        s + (o.kind === 'subscriptions' ? nonEssRecurring : (o.habitualProjected ?? 0)), 0);
      expect(a.potentialMonthly).toBeLessThanOrEqual(Math.floor(catBase));

      // Expected headline numbers for this fixture
      expect(opp(a, 'cat:fun')!.estMonthly).toBe(1770);       // habitual 2850 − target 1080
      expect(opp(a, 'cat:fun')!.priority).toBe('High');
      expect(opp(a, 'cat:dining')!.estMonthly).toBe(2300);    // habitual 5900 − target 3600
      expect(opp(a, 'cat:dining')!.habitualPctVsAvg).toBeCloseTo(126.7, 1);
      expect(opp(a, 'cat:groc')!.estMonthly).toBe(1500);      // habitual 9100 − target 7600
      expect(opp(a, 'subscriptions')!.priority).toBe('Low');  // only ₹999 non-essential
      expect(a.potentialMonthly).toBe(1770 + 2300 + 1500 + 250);
    }
  });
});
