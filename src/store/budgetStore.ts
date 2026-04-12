'use client';

import { create } from 'zustand';
import { Expense, Income, Category } from '@/types';
import { supabase } from '@/lib/supabase';

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
  deleteCategory: (id: string) => void;
  reorderCategory: (fromIndex: number, toIndex: number) => void;
  getExpensesByMonth: (month: string, year: number) => Expense[];
  getIncomeByMonth: (month: string, year: number) => Income[];
  getMonthlyTotal: (month: string, year: number) => number;
  getMonthlyIncome: (month: string, year: number) => number;
  getCategoryTotal: (category: string, month: string, year: number) => number;
  loadFromLocalStorage: () => void;
}

const defaultCategories: Category[] = [
  { id: '1', name: 'Food & Groceries', color: '#ef4444', icon: '🍔', budget: 8000 },
  { id: '2', name: 'Transportation', color: '#f59e0b', icon: '🚗', budget: 4000 },
  { id: '3', name: 'Utilities', color: '#3b82f6', icon: '💡', budget: 3000 },
  { id: '4', name: 'Entertainment', color: '#8b5cf6', icon: '🎬', budget: 2000 },
  { id: '5', name: 'Health & Fitness', color: '#10b981', icon: '💪', budget: 2000 },
  { id: '6', name: 'Shopping', color: '#ec4899', icon: '🛍️', budget: 4000 },
  { id: '7', name: 'Dining Out', color: '#06b6d4', icon: '🍽️', budget: 3000 },
  { id: '8', name: 'Miscellaneous', color: '#6b7280', icon: '📦', budget: 2000 },
];

// ── Supabase helpers ────────────────────────────────────────────────────────

interface RemoteData {
  expenses: Expense[];
  income: Income[];
  categories: Category[];
}

function backupToLocalStorage(data: RemoteData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('budget_expenses', JSON.stringify(data.expenses));
    localStorage.setItem('budget_income', JSON.stringify(data.income));
    localStorage.setItem('budget_categories', JSON.stringify(data.categories));
  } catch { /* quota exceeded — non-critical */ }
}

async function syncToSupabase(data: RemoteData) {
  // Always backup to localStorage first
  backupToLocalStorage(data);

  const userId = useBudgetStore.getState().userId;
  if (!userId) return;

  await supabase
    .from('budget_data')
    .upsert({ user_id: userId, ...data }, { onConflict: 'user_id' });
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
    if (typeof window !== 'undefined') {
      const savedExpenses   = localStorage.getItem('budget_expenses');
      const savedIncome     = localStorage.getItem('budget_income');
      const savedCategories = localStorage.getItem('budget_categories');

      const migrated: RemoteData = {
        expenses:   savedExpenses   ? JSON.parse(savedExpenses)   : [],
        income:     savedIncome     ? JSON.parse(savedIncome)     : [],
        categories: savedCategories ? JSON.parse(savedCategories) : defaultCategories,
      };

      useBudgetStore.setState(migrated);

      // Push existing localStorage data up to Supabase
      if (savedExpenses || savedIncome || savedCategories) {
        await syncToSupabase(migrated);
      }
    }
    return;
  }

  const remote: RemoteData = {
    expenses:   data.expenses   ?? [],
    income:     data.income     ?? [],
    categories: data.categories ?? defaultCategories,
  };

  useBudgetStore.setState(remote);
  // Keep localStorage in sync with latest Supabase data
  backupToLocalStorage(remote);
}

export const useBudgetStore = create<BudgetStore>((set, get) => ({
  expenses: [],
  income: [],
  categories: defaultCategories,
  selectedMonth: (new Date().getMonth() + 1).toString().padStart(2, '0'),
  selectedYear: new Date().getFullYear(),
  selectedCity: 'Bangalore',
  syncing: false,
  userId: null,
  currency: 'INR',

  setUserId: (userId: string | null) => {
    set({ userId });
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

  addExpense: (expense: Expense) => {
    set((state) => {
      const newExpenses = [...state.expenses, expense];
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
    set((state) => {
      const newIncome = [...state.income, income];
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

  deleteCategory: (id: string) => {
    set((state) => {
      const newCategories = state.categories.filter((c) => c.id !== id);
      syncToSupabase({ expenses: state.expenses, income: state.income, categories: newCategories });
      return { categories: newCategories };
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
