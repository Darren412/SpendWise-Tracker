'use client';

import { create } from 'zustand';
import { Expense, Income, Category } from '@/types';
import { supabase } from '@/lib/supabase';
import { getFinancialPeriod, getCurrentFinancialPeriod } from '@/utils/financialCycle';

interface BudgetStore {
  expenses: Expense[];
  income: Income[];
  categories: Category[];
  selectedMonth: string;
  selectedYear: number;
  selectedCity: string;
  syncing: boolean;
  userId: string | null;
  currency: string;
  setUserId: (userId: string | null) => void;
  setCurrency: (currency: string) => void;
  setSelectedMonth: (month: string) => void;
  setSelectedYear: (year: number) => void;
  setSelectedCity: (city: string) => void;
  addExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;
  updateExpense: (id: string, expense: Partial<Expense>) => void;
  addIncome: (income: Income) => void;
  deleteIncome: (id: string) => void;
  addCategory: (category: Category) => void;
  updateCategory: (id: string, category: Partial<Category>) => void;
  deleteCategory: (id: string, reassignToId?: string) => void;
  reorderCategory: (fromIndex: number, toIndex: number) => void;
  selectedCategoryIds: string[];
  setSelectedCategoryIds: (ids: string[]) => void;
  excludedCategoryIds: string[];
  setExcludedCategoryIds: (ids: string[]) => void;
  updateIncome: (id: string, updates: Partial<Income>) => void;
  getExpensesByMonth: (month: string, year: number) => Expense[];
  getIncomeByMonth: (month: string, year: number) => Income[];
  getMonthlyTotal: (month: string, year: number) => number;
  getMonthlyIncome: (month: string, year: number) => number;
  getCategoryTotal: (category: string, month: string, year: number) => number;
  financialCycleStart: number;
  setFinancialCycleStart: (day: number) => void;
  migrateToFinancialCycle: () => void;
  loadFromLocalStorage: () => void;
}

const defaultCategories: Category[] = [
  // ─ Expense categories ────────────────────────────────────────────────────
  { id: '1', name: 'Dining & Food',           type: 'expense', color: '#ef4444', icon: '🍔' },
  { id: '2', name: 'Travel & Transport',      type: 'expense', color: '#f59e0b', icon: '🚗' },
  { id: '3', name: 'Utilities & Bills',       type: 'expense', color: '#3b82f6', icon: '💡' },
  { id: '4', name: 'Entertainment & Leisure', type: 'expense', color: '#8b5cf6', icon: '🎬' },
  { id: '5', name: 'Healthcare & Wellness',   type: 'expense', color: '#10b981', icon: '💪' },
  { id: '6', name: 'Retail & Shopping',       type: 'expense', color: '#ec4899', icon: '🛍️' },
  { id: '7', name: 'Café & Dining',           type: 'expense', color: '#06b6d4', icon: '🍽️' },
  { id: '8', name: 'Other Expenses',          type: 'expense', color: '#6b7280', icon: '📦' },
  // ─ Income categories ─────────────────────────────────────────────────────
  { id: 'inc_1', name: 'Salary Income',      type: 'income', color: '#10b981', icon: '💼' },
  { id: 'inc_2', name: 'Freelance Income',   type: 'income', color: '#3b82f6', icon: '💻' },
  { id: 'inc_3', name: 'Investment Returns', type: 'income', color: '#8b5cf6', icon: '📈' },
  { id: 'inc_4', name: 'Side Income',        type: 'income', color: '#f59e0b', icon: '🎯' },
  { id: 'inc_5', name: 'Business Income',    type: 'income', color: '#06b6d4', icon: '🏢' },
  { id: 'inc_6', name: 'Rental Income',      type: 'income', color: '#ec4899', icon: '🏠' },
  { id: 'inc_7', name: 'Other Income',       type: 'income', color: '#6b7280', icon: '💰' },
];

// ── Category name migration map (old name → new name) ────────────────────
const CATEGORY_NAME_MIGRATION: Record<string, string> = {
  // Expense renames
  'Food & Groceries':  'Dining & Food',
  'Food':              'Dining & Food',
  'Groceries':         'Dining & Food',
  'Groceries & Essentials': 'Dining & Food',
  'Transportation':    'Travel & Transport',
  'Travel':            'Travel & Transport',
  'Utilities':         'Utilities & Bills',
  'Bills':             'Utilities & Bills',
  'Entertainment':     'Entertainment & Leisure',
  'Health & Fitness':  'Healthcare & Wellness',
  'Health':            'Healthcare & Wellness',
  'Shopping':          'Retail & Shopping',
  'Retail & Shopping': 'Retail & Shopping',
  'Dining Out':        'Café & Dining',
  'Miscellaneous':     'Other Expenses',
  'Misc':              'Other Expenses',
  'Other':             'Other Expenses',
  // Income renames
  'Salary':            'Salary Income',
  'Freelance':         'Freelance Income',
  'Investment':        'Investment Returns',
  'Investments':       'Investment Returns',
  'Business':          'Business Income',
  'Rental':            'Rental Income',
};

function migrateCategories(categories: Category[]): { categories: Category[]; changed: boolean } {
  let changed = false;
  // Ensure income categories exist (merge if missing)
  const hasIncomeCategories = categories.some(c => c.type === 'income' || c.id.startsWith('inc_'));
  let merged = categories;
  if (!hasIncomeCategories) {
    const incomeCats = defaultCategories.filter(c => c.type === 'income');
    merged = [...categories, ...incomeCats];
    changed = true;
  }
  const migrated = merged.map(cat => {
    const newName = CATEGORY_NAME_MIGRATION[cat.name];
    // Apply type field if missing
    const needsType = cat.type === undefined;
    const inferredType: Category['type'] = cat.id.startsWith('inc_') ? 'income' : 'expense';
    if ((newName && newName !== cat.name) || needsType) {
      changed = true;
      return { ...cat, ...(newName ? { name: newName } : {}), ...(needsType ? { type: inferredType } : {}) };
    }
    return cat;
  });
  return { categories: migrated, changed };
}

// ── Supabase helpers ────────────────────────────────────────────────────────

interface RemoteData {
  expenses: Expense[];
  income: Income[];
  categories: Category[];
}

function backupToLocalStorage(data: RemoteData) {
  if (typeof window === 'undefined') return;
  const userId = useBudgetStore.getState().userId;
  const prefix = userId ? `budget_${userId}_` : 'budget_';
  try {
    localStorage.setItem(`${prefix}expenses`, JSON.stringify(data.expenses));
    localStorage.setItem(`${prefix}income`, JSON.stringify(data.income));
    localStorage.setItem(`${prefix}categories`, JSON.stringify(data.categories));
  } catch { /* quota exceeded — non-critical */ }
}

function getLocalBackup(userId: string | null): { expenses: string | null; income: string | null; categories: string | null } {
  if (typeof window === 'undefined') return { expenses: null, income: null, categories: null };
  const prefix = userId ? `budget_${userId}_` : 'budget_';
  return {
    expenses:   localStorage.getItem(`${prefix}expenses`) ?? localStorage.getItem('budget_expenses'),
    income:     localStorage.getItem(`${prefix}income`) ?? localStorage.getItem('budget_income'),
    categories: localStorage.getItem(`${prefix}categories`) ?? localStorage.getItem('budget_categories'),
  };
}


// ── Financial cycle init (reads localStorage before store creation) ─────────
function getSavedCycleStart(): number {
  if (typeof window === 'undefined') return 25;
  const saved = localStorage.getItem('spendwise_cycle_start');
  const n = saved ? parseInt(saved, 10) : 25;
  return isNaN(n) ? 25 : Math.min(28, Math.max(1, n));
}
const initCycleStart = getSavedCycleStart();
const initPeriod     = getCurrentFinancialPeriod(initCycleStart);

// --- Supabase sync with retry and network status ---
let syncRetryCount = 0;
let syncRetryTimeout: ReturnType<typeof setTimeout> | null = null;

async function syncToSupabase(data: RemoteData) {
  backupToLocalStorage(data);
  const userId = useBudgetStore.getState().userId;
  if (!userId) return;
  useBudgetStore.setState({ syncing: true, networkError: false });
  try {
    const { error } = await supabase
      .from('budget_data')
      .upsert({ user_id: userId, ...data }, { onConflict: 'user_id' });
    if (error) throw error;
    syncRetryCount = 0;
    if (syncRetryTimeout) clearTimeout(syncRetryTimeout);
    useBudgetStore.setState({ syncing: false, networkError: false });
  } catch (err) {
    useBudgetStore.setState({ syncing: false, networkError: true });
    // Exponential backoff retry
    syncRetryCount++;
    const delay = Math.min(60000, 2000 * Math.pow(2, syncRetryCount));
    if (syncRetryTimeout) clearTimeout(syncRetryTimeout);
    syncRetryTimeout = setTimeout(() => syncToSupabase(data), delay);
  }
}

async function loadFromSupabase() {
  const userId = useBudgetStore.getState().userId;
  if (!userId) return;

  const { data, error } = await supabase
    .from('budget_data')
    .select('expenses, income, categories')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // No remote data yet — restore from localStorage backup if available
    const local = getLocalBackup(userId);

    const rawCategories: Category[] = local.categories ? JSON.parse(local.categories) : defaultCategories;
    const { categories: migratedCats, changed } = migrateCategories(rawCategories);

    const migrated: RemoteData = {
      expenses:   local.expenses ? JSON.parse(local.expenses) : [],
      income:     local.income   ? JSON.parse(local.income)   : [],
      categories: migratedCats,
    };

    useBudgetStore.setState(migrated);

    // Push existing localStorage data up to Supabase (and if migration ran, persist it)
    if (local.expenses || local.income || local.categories || changed) {
      await syncToSupabase(migrated);
    }

    // Re-apply financial cycle mapping after data loads
    if (useBudgetStore.getState().financialCycleStart > 1) {
      useBudgetStore.getState().migrateToFinancialCycle();
    }
    return;
  }

  const rawRemoteCategories: Category[] = data.categories ?? defaultCategories;
  const { categories: migratedRemoteCats, changed: remoteCatsChanged } = migrateCategories(rawRemoteCategories);

  const remote: RemoteData = {
    expenses:   data.expenses ?? [],
    income:     data.income   ?? [],
    categories: migratedRemoteCats,
  };

  // Merge localStorage backup with Supabase data to prevent data loss
  const local = getLocalBackup(userId);

  const localExpenses: Expense[] = local.expenses ? JSON.parse(local.expenses) : [];
  const localIncome: Income[]    = local.income   ? JSON.parse(local.income)   : [];

  // Merge: add any local items not present in Supabase (by id)
  const remoteExpenseIds = new Set(remote.expenses.map((e) => e.id));
  const missingExpenses  = localExpenses.filter((e) => !remoteExpenseIds.has(e.id));

  const remoteIncomeIds = new Set(remote.income.map((i) => i.id));
  const missingIncome   = localIncome.filter((i) => !remoteIncomeIds.has(i.id));

  if (missingExpenses.length > 0 || missingIncome.length > 0 || remoteCatsChanged) {
    remote.expenses = [...remote.expenses, ...missingExpenses];
    remote.income   = [...remote.income, ...missingIncome];
    // Push merged data back to Supabase
    await syncToSupabase(remote);
  }

  useBudgetStore.setState(remote);
  backupToLocalStorage(remote);

  // Re-apply financial cycle mapping after data loads (in case cycle != calendar month)
  if (useBudgetStore.getState().financialCycleStart > 1) {
    useBudgetStore.getState().migrateToFinancialCycle();
  }
}

export const useBudgetStore = create<BudgetStore & { networkError: boolean }>((set, get) => ({
  expenses: [],
  income: [],
  categories: defaultCategories,
  selectedMonth: initPeriod.month,
  selectedYear: initPeriod.year,
  selectedCity: 'Bangalore',
  syncing: false,
  networkError: false,
  userId: null,
  currency: 'INR',
  excludedCategoryIds: [],
  selectedCategoryIds: [], // deprecated alias — mirrors excludedCategoryIds
  financialCycleStart: initCycleStart,

  setExcludedCategoryIds: (ids: string[]) => set({ excludedCategoryIds: ids, selectedCategoryIds: ids }),
  setSelectedCategoryIds: (ids: string[]) => set({ excludedCategoryIds: ids, selectedCategoryIds: ids }),

  setUserId: (userId: string | null) => {
    set({ userId });
    // Clean up old unscoped localStorage keys to prevent cross-user contamination
    if (userId && typeof window !== 'undefined') {
      localStorage.removeItem('budget_expenses');
      localStorage.removeItem('budget_income');
      localStorage.removeItem('budget_categories');
    }
  },

  setCurrency: (currency: string) => {
    set({ currency });
  },

  setSelectedMonth: (month: string) => {
    set({ selectedMonth: month });
  },

  setSelectedYear: (year: number) => {
    set({ selectedYear: year });
  },

  setSelectedCity: (city: string) => {
    set({ selectedCity: city });
  },

  setFinancialCycleStart: (day: number) => {
    const clamped = Math.min(28, Math.max(1, day));
    if (typeof window !== 'undefined') {
      localStorage.setItem('spendwise_cycle_start', String(clamped));
    }
    set({ financialCycleStart: clamped });
    // Re-migrate all data and jump to current financial period
    get().migrateToFinancialCycle();
    const period = getCurrentFinancialPeriod(clamped);
    set({ selectedMonth: period.month, selectedYear: period.year });
  },

  migrateToFinancialCycle: () => {
    const { financialCycleStart, expenses, income, categories } = get();
    const newExpenses = expenses.map(e =>
      e.date ? { ...e, ...getFinancialPeriod(e.date, financialCycleStart) } : e
    );
    const newIncome = income.map(i =>
      i.date ? { ...i, ...getFinancialPeriod(i.date, financialCycleStart) } : i
    );
    set({ expenses: newExpenses, income: newIncome });
    syncToSupabase({ expenses: newExpenses, income: newIncome, categories });
  },

  addExpense: (expense: Expense) => {
    const period = getFinancialPeriod(expense.date, get().financialCycleStart);
    const withPeriod = { ...expense, ...period };
    set((state) => {
      const newExpenses = [...state.expenses, withPeriod];
      syncToSupabase({ expenses: newExpenses, income: state.income, categories: state.categories });
      return { expenses: newExpenses };
    });
  },

  deleteExpense: (id: string) => {
    set((state) => {
      const newExpenses = state.expenses.filter((e) => e.id !== id);
      syncToSupabase({ expenses: newExpenses, income: state.income, categories: state.categories });
      return { expenses: newExpenses };
    });
  },

  updateExpense: (id: string, updates: Partial<Expense>) => {
    set((state) => {
      const newExpenses = state.expenses.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      );
      syncToSupabase({ expenses: newExpenses, income: state.income, categories: state.categories });
      return { expenses: newExpenses };
    });
  },

  addIncome: (income: Income) => {
    const period = getFinancialPeriod(income.date, get().financialCycleStart);
    const withPeriod = { ...income, ...period };
    set((state) => {
      const newIncome = [...state.income, withPeriod];
      syncToSupabase({ expenses: state.expenses, income: newIncome, categories: state.categories });
      return { income: newIncome };
    });
  },

  deleteIncome: (id: string) => {
    set((state) => {
      const newIncome = state.income.filter((i) => i.id !== id);
      syncToSupabase({ expenses: state.expenses, income: newIncome, categories: state.categories });
      return { income: newIncome };
    });
  },

  updateIncome: (id: string, updates: Partial<Income>) => {
    set((state) => {
      const newIncome = state.income.map((i) =>
        i.id === id ? { ...i, ...updates } : i
      );
      syncToSupabase({ expenses: state.expenses, income: newIncome, categories: state.categories });
      return { income: newIncome };
    });
  },

  addCategory: (category: Category) => {
    set((state) => {
      const newCategories = [...state.categories, category];
      syncToSupabase({ expenses: state.expenses, income: state.income, categories: newCategories });
      return { categories: newCategories };
    });
  },

  updateCategory: (id: string, updates: Partial<Category>) => {
    set((state) => {
      const newCategories = state.categories.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      );
      syncToSupabase({ expenses: state.expenses, income: state.income, categories: newCategories });
      return { categories: newCategories };
    });
  },

  deleteCategory: (id: string, reassignToId?: string) => {
    set((state) => {
      // Determine fallback: "Other Expenses" or first remaining category
      const fallbackId = reassignToId
        ?? state.categories.find(c => c.id !== id && c.name === 'Other Expenses')?.id
        ?? state.categories.find(c => c.id !== id)?.id
        ?? id;
      // Reassign all expenses in this category
      const newExpenses = state.expenses.map(e =>
        e.category === id ? { ...e, category: fallbackId } : e
      );
      const newCategories = state.categories.filter((c) => c.id !== id);
      syncToSupabase({ expenses: newExpenses, income: state.income, categories: newCategories });
      return { categories: newCategories, expenses: newExpenses };
    });
  },

  reorderCategory: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const newCategories = [...state.categories];
      const [removed] = newCategories.splice(fromIndex, 1);
      newCategories.splice(toIndex, 0, removed);
      syncToSupabase({ expenses: state.expenses, income: state.income, categories: newCategories });
      return { categories: newCategories };
    });
  },

  getExpensesByMonth: (month: string, year: number) => {
    const state = get();
    if (state.selectedCity === 'Both') {
      return state.expenses.filter((e) => e.month === month && e.year === year);
    }
    return state.expenses.filter(
      (e) => e.month === month && e.year === year && (e.city ?? 'Bangalore') === state.selectedCity
    );
  },

  getIncomeByMonth: (month: string, year: number) => {
    const state = get();
    return state.income.filter((i) => i.month === month && i.year === year);
  },

  getMonthlyTotal: (month: string, year: number) => {
    const state = get();
    return state
      .getExpensesByMonth(month, year)
      .reduce((total, expense) => total + expense.amount, 0);
  },

  getMonthlyIncome: (month: string, year: number) => {
    const state = get();
    return state
      .getIncomeByMonth(month, year)
      .reduce((total, income) => total + income.amount, 0);
  },

  getCategoryTotal: (category: string, month: string, year: number) => {
    const state = get();
    return state
      .getExpensesByMonth(month, year)
      .filter((e) => e.category === category)
      .reduce((total, expense) => total + expense.amount, 0);
  },

  loadFromLocalStorage: () => {
    // This now triggers the Supabase load; name kept for backward compat
    loadFromSupabase();
  },
}));
