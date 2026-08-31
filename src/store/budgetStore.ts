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
  // Budget tracker — per-month budgets keyed by "MM-YYYY"
  monthlyBudgets: Record<string, number>;
  budgetCategoryIds: string[];
  setMonthlyBudget: (month: string, year: number, amount: number) => void;
  getMonthlyBudget: (month: string, year: number) => number;
  setBudgetCategoryIds: (ids: string[]) => void;
  savingsTarget: number;  // percentage (0-100)
  setSavingsTarget: (pct: number) => void;
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

// ── Unique ID generator (avoids Date.now() collisions on rapid calls) ───────

let _idCounter = 0;
export function generateId(prefix = ''): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  const seq = (++_idCounter).toString(36);
  return prefix ? `${prefix}_${ts}${rand}${seq}` : `${ts}${rand}${seq}`;
}

// ── Supabase helpers ────────────────────────────────────────────────────────

interface UserSettings {
  currency: string;
  financialCycleStart: number;
  monthlyBudgets: Record<string, number>;
  budgetCategoryIds: string[];
  excludedCategoryIds: string[];
  selectedCity: string;
  savingsTarget: number;
}

interface RemoteData {
  expenses: Expense[];
  income: Income[];
  categories: Category[];
  settings?: UserSettings | null;
}

function backupToLocalStorage(data: RemoteData) {
  if (typeof window === 'undefined') return;
  const userId = useBudgetStore.getState().userId;
  const prefix = userId ? `budget_${userId}_` : 'budget_';
  try {
    localStorage.setItem(`${prefix}expenses`, JSON.stringify(data.expenses));
    localStorage.setItem(`${prefix}income`, JSON.stringify(data.income));
    localStorage.setItem(`${prefix}categories`, JSON.stringify(data.categories));
    if (data.settings) {
      localStorage.setItem('spendwise_currency', data.settings.currency);
      localStorage.setItem('spendwise_cycle_start', String(data.settings.financialCycleStart));
      localStorage.setItem('spendwise_monthly_budgets', JSON.stringify(data.settings.monthlyBudgets));
      localStorage.setItem('spendwise_budget_categories', JSON.stringify(data.settings.budgetCategoryIds));
    }
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

function getSavedCurrency(): string {
  if (typeof window === 'undefined') return 'INR';
  return localStorage.getItem('spendwise_currency') ?? 'INR';
}
const initCurrency = getSavedCurrency();

// --- Supabase sync with debounce, retry, and network status ---
//
// IMPORTANT: Every store mutation was previously calling syncToSupabase() with a
// captured data snapshot. When two mutations fired in quick succession (e.g.
// addCategory → addExpense), two async upserts raced. If the FIRST upsert
// resolved after the second, it overwrote Supabase with stale data — silently
// dropping the expense.
//
// Fix: debounce writes so rapid mutations consolidate into ONE sync that always
// reads the latest store state. localStorage backup remains immediate.

let syncRetryCount = 0;
let syncRetryTimeout: ReturnType<typeof setTimeout> | null = null;
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let syncInFlight = false;
let syncPendingAfterFlight = false;
let loadVersion = 0; // guards against concurrent loadFromSupabase calls

/** Read the latest state from the store and return the sync payload. */
function getLatestSyncPayload(): RemoteData {
  const { expenses, income, categories, currency, financialCycleStart, monthlyBudgets, budgetCategoryIds, excludedCategoryIds, selectedCity, savingsTarget } = useBudgetStore.getState();
  return {
    expenses, income, categories,
    settings: { currency, financialCycleStart, monthlyBudgets, budgetCategoryIds, excludedCategoryIds, selectedCity, savingsTarget },
  };
}

/** Actually push data to Supabase (called by the debounce / retry). */
async function executeSyncToSupabase() {
  const userId = useBudgetStore.getState().userId;
  if (!userId) return;

  // Set in-flight flag BEFORE reading payload to close the TOCTOU window
  syncInFlight = true;

  // Always send the LATEST state, never a stale closure
  const data = getLatestSyncPayload();
  useBudgetStore.setState({ syncing: true, networkError: false });
  try {
    const { error } = await supabase
      .from('budget_data')
      .upsert({ user_id: userId, ...data }, { onConflict: 'user_id' });
    if (error) throw error;
    syncRetryCount = 0;
    if (syncRetryTimeout) clearTimeout(syncRetryTimeout);
    useBudgetStore.setState({ syncing: false, networkError: false });
  } catch {
    useBudgetStore.setState({ syncing: false, networkError: true });
    // Exponential backoff retry — always re-reads latest state
    syncRetryCount++;
    const delay = Math.min(60000, 2000 * Math.pow(2, syncRetryCount));
    if (syncRetryTimeout) clearTimeout(syncRetryTimeout);
    syncRetryTimeout = setTimeout(() => executeSyncToSupabase(), delay);
  } finally {
    syncInFlight = false;
    // If another mutation happened while we were in-flight, sync again
    if (syncPendingAfterFlight) {
      syncPendingAfterFlight = false;
      scheduleSyncToSupabase();
    }
  }
}

/**
 * Schedule a debounced sync to Supabase.
 * - localStorage backup happens immediately (synchronous, no data loss on close).
 * - Supabase write is debounced by 350 ms so rapid mutations consolidate.
 * - If a sync is already in-flight, we flag a re-sync for after it completes.
 */
function scheduleSyncToSupabase() {
  // Immediate localStorage backup with latest state
  backupToLocalStorage(getLatestSyncPayload());

  if (syncInFlight) {
    // A sync is currently awaiting Supabase — mark that we need to re-sync
    syncPendingAfterFlight = true;
    return;
  }

  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => executeSyncToSupabase(), 350);
}

/**
 * Flush any pending debounced sync immediately.
 * Called on beforeunload to prevent data loss when closing the tab.
 */
export function flushPendingSync() {
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = null;
    // Fire the sync immediately (best-effort, browser may cut it short)
    executeSyncToSupabase();
  }
}

// Auto-register beforeunload handler (client-side only)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // Flush localStorage immediately (synchronous, guaranteed)
    backupToLocalStorage(getLatestSyncPayload());
    // Attempt Supabase sync (may not complete, but localStorage is safe)
    flushPendingSync();
  });

  // Network status awareness — retry sync when coming back online
  window.addEventListener('online', () => {
    if (syncRetryCount > 0 || syncPendingAfterFlight) {
      syncRetryCount = 0;
      if (syncRetryTimeout) { clearTimeout(syncRetryTimeout); syncRetryTimeout = null; }
      scheduleSyncToSupabase();
    }
  });
}

/** Legacy wrapper — kept for the one-off sync in loadFromSupabase. */
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
    useBudgetStore.setState({ syncing: false, networkError: false });
  } catch {
    useBudgetStore.setState({ syncing: false, networkError: true });
  }
}

async function loadFromSupabase() {
  const userId = useBudgetStore.getState().userId;
  if (!userId) return;

  // Version guard: if another load starts while we're awaiting, discard our stale result
  const thisLoad = ++loadVersion;

  const { data, error } = await supabase
    .from('budget_data')
    .select('expenses, income, categories, settings')
    .eq('user_id', userId)
    .single();

  // Stale guard — a newer load started while we were awaiting
  if (thisLoad !== loadVersion) return;

  // Distinguish "no rows" (PGRST116) from real network/server errors
  const isNoRows = error?.code === 'PGRST116';
  const isRealError = error && !isNoRows;

  if (isRealError) {
    // Network/server failure — restore from localStorage but do NOT push to Supabase
    // (pushing stale local data could overwrite fresher remote data from another device)
    const local = getLocalBackup(userId);
    let rawCategories: Category[];
    let parsedExpenses: Expense[];
    let parsedIncome: Income[];
    try { rawCategories  = local.categories ? JSON.parse(local.categories) : defaultCategories; } catch { rawCategories = defaultCategories; }
    try { parsedExpenses = local.expenses   ? JSON.parse(local.expenses)   : [];                } catch { parsedExpenses = []; }
    try { parsedIncome   = local.income     ? JSON.parse(local.income)     : [];                } catch { parsedIncome   = []; }
    if (!Array.isArray(parsedExpenses)) parsedExpenses = [];
    if (!Array.isArray(parsedIncome))   parsedIncome   = [];
    if (!Array.isArray(rawCategories))  rawCategories  = defaultCategories;
    const { categories: migratedCats } = migrateCategories(rawCategories);
    useBudgetStore.setState({ expenses: parsedExpenses, income: parsedIncome, categories: migratedCats });
    useBudgetStore.setState({ networkError: true });
    if (useBudgetStore.getState().financialCycleStart > 1) {
      useBudgetStore.getState().migrateToFinancialCycle();
    }
    return;
  }

  if (isNoRows || !data) {
    // No remote data yet — restore from localStorage backup and push to Supabase
    const local = getLocalBackup(userId);
    let rawCategories: Category[];
    let parsedExpenses: Expense[];
    let parsedIncome: Income[];
    try { rawCategories  = local.categories ? JSON.parse(local.categories) : defaultCategories; } catch { rawCategories = defaultCategories; }
    try { parsedExpenses = local.expenses   ? JSON.parse(local.expenses)   : [];                } catch { parsedExpenses = []; }
    try { parsedIncome   = local.income     ? JSON.parse(local.income)     : [];                } catch { parsedIncome   = []; }
    if (!Array.isArray(parsedExpenses)) parsedExpenses = [];
    if (!Array.isArray(parsedIncome))   parsedIncome   = [];
    if (!Array.isArray(rawCategories))  rawCategories  = defaultCategories;
    const { categories: migratedCats, changed } = migrateCategories(rawCategories);

    // Include current local settings in the initial upload
    const { currency, financialCycleStart, monthlyBudgets, budgetCategoryIds, excludedCategoryIds, selectedCity, savingsTarget } = useBudgetStore.getState();
    const migrated: RemoteData = {
      expenses:   parsedExpenses,
      income:     parsedIncome,
      categories: migratedCats,
      settings:   { currency, financialCycleStart, monthlyBudgets, budgetCategoryIds, excludedCategoryIds, selectedCity, savingsTarget },
    };

    if (thisLoad !== loadVersion) return;
    const { settings: _ms, ...migratedData } = migrated;
    useBudgetStore.setState(migratedData);

    // Push existing localStorage data up to Supabase (and if migration ran, persist it)
    if (local.expenses || local.income || local.categories || changed) {
      await syncToSupabase(migrated);
    }

    if (useBudgetStore.getState().financialCycleStart > 1) {
      useBudgetStore.getState().migrateToFinancialCycle();
    }
    return;
  }

  // Validate remote data — arrays may be null, undefined, or corrupted
  const rawExpenses  = Array.isArray(data.expenses)   ? data.expenses   : [];
  const rawIncome    = Array.isArray(data.income)      ? data.income     : [];
  const rawCats      = Array.isArray(data.categories)  ? data.categories : defaultCategories;

  const { categories: migratedRemoteCats, changed: remoteCatsChanged } = migrateCategories(rawCats);

  // Parse remote settings (may be null if column doesn't exist yet or first sync)
  const remoteSettings: UserSettings | null = data.settings && typeof data.settings === 'object'
    ? data.settings as UserSettings
    : null;

  const remote: RemoteData = {
    expenses:   rawExpenses,
    income:     rawIncome,
    categories: migratedRemoteCats,
    settings:   remoteSettings,
  };

  // Apply remote settings to the store
  if (remoteSettings) {
    const settingsUpdate: Partial<BudgetStore> = {};
    if (remoteSettings.currency && typeof remoteSettings.currency === 'string') {
      settingsUpdate.currency = remoteSettings.currency;
    }
    if (typeof remoteSettings.financialCycleStart === 'number' && remoteSettings.financialCycleStart >= 1 && remoteSettings.financialCycleStart <= 28) {
      settingsUpdate.financialCycleStart = remoteSettings.financialCycleStart;
    }
    if (remoteSettings.monthlyBudgets && typeof remoteSettings.monthlyBudgets === 'object') {
      settingsUpdate.monthlyBudgets = remoteSettings.monthlyBudgets;
    }
    if (Array.isArray(remoteSettings.budgetCategoryIds)) {
      settingsUpdate.budgetCategoryIds = remoteSettings.budgetCategoryIds;
    }
    if (Array.isArray(remoteSettings.excludedCategoryIds)) {
      settingsUpdate.excludedCategoryIds = remoteSettings.excludedCategoryIds;
      settingsUpdate.selectedCategoryIds = remoteSettings.excludedCategoryIds;
    }
    if (remoteSettings.selectedCity && typeof remoteSettings.selectedCity === 'string') {
      settingsUpdate.selectedCity = remoteSettings.selectedCity;
    }
    if (typeof remoteSettings.savingsTarget === 'number' && remoteSettings.savingsTarget >= 0 && remoteSettings.savingsTarget <= 100) {
      settingsUpdate.savingsTarget = remoteSettings.savingsTarget;
    }
    useBudgetStore.setState(settingsUpdate);
  }

  // Merge localStorage backup with Supabase data to prevent data loss
  const local = getLocalBackup(userId);

  let localExpenses: Expense[] = [];
  let localIncome: Income[]    = [];
  let localCategories: Category[] = [];
  try { localExpenses   = local.expenses   ? JSON.parse(local.expenses)   : []; } catch { /* corrupted */ }
  try { localIncome     = local.income     ? JSON.parse(local.income)     : []; } catch { /* corrupted */ }
  try { localCategories = local.categories ? JSON.parse(local.categories) : []; } catch { /* corrupted */ }
  if (!Array.isArray(localExpenses))   localExpenses   = [];
  if (!Array.isArray(localIncome))     localIncome     = [];
  if (!Array.isArray(localCategories)) localCategories = [];

  // Merge: add any local items not present in Supabase (by id)
  const remoteExpenseIds = new Set(remote.expenses.map((e) => e.id));
  const missingExpenses  = localExpenses.filter((e) => !remoteExpenseIds.has(e.id));

  const remoteIncomeIds = new Set(remote.income.map((i) => i.id));
  const missingIncome   = localIncome.filter((i) => !remoteIncomeIds.has(i.id));

  // Also merge categories created locally but not yet in Supabase
  const remoteCatIds = new Set(remote.categories.map((c) => c.id));
  const missingCategories = localCategories.filter((c) => !remoteCatIds.has(c.id));

  const needsMerge = missingExpenses.length > 0 || missingIncome.length > 0 || missingCategories.length > 0 || remoteCatsChanged;
  if (needsMerge) {
    remote.expenses   = [...remote.expenses,   ...missingExpenses];
    remote.income     = [...remote.income,     ...missingIncome];
    remote.categories = [...remote.categories, ...missingCategories];
    // Push merged data back to Supabase
    await syncToSupabase(remote);
  }

  if (thisLoad !== loadVersion) return;
  // Apply data (settings already applied above, strip from setState to avoid stale key)
  const { settings: _s, ...remoteData } = remote;
  useBudgetStore.setState(remoteData);
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
  currency: initCurrency,
  excludedCategoryIds: [],
  selectedCategoryIds: [], // deprecated alias — mirrors excludedCategoryIds
  financialCycleStart: initCycleStart,
  monthlyBudgets: typeof window !== 'undefined' ? (() => { try { const raw = localStorage.getItem('spendwise_monthly_budgets'); if (raw) return JSON.parse(raw); const legacy = parseFloat(localStorage.getItem('spendwise_monthly_budget') ?? '0'); return legacy > 0 ? { _default: legacy } : {}; } catch { return {}; } })() : {},
  budgetCategoryIds: typeof window !== 'undefined' ? (() => { try { return JSON.parse(localStorage.getItem('spendwise_budget_categories') ?? '[]'); } catch { return []; } })() : [],
  savingsTarget: 20,
  setSavingsTarget: (pct: number) => { set({ savingsTarget: Math.max(0, Math.min(100, pct)) }); scheduleSyncToSupabase(); },

  setExcludedCategoryIds: (ids: string[]) => { set({ excludedCategoryIds: ids, selectedCategoryIds: ids }); scheduleSyncToSupabase(); },
  setSelectedCategoryIds: (ids: string[]) => { set({ excludedCategoryIds: ids, selectedCategoryIds: ids }); scheduleSyncToSupabase(); },

  setUserId: (userId: string | null) => {
    // On logout: clear pending sync timers to prevent stale writes
    if (!userId) {
      if (syncRetryTimeout) { clearTimeout(syncRetryTimeout); syncRetryTimeout = null; }
      if (syncDebounceTimer) { clearTimeout(syncDebounceTimer); syncDebounceTimer = null; }
      syncRetryCount = 0;
      syncInFlight = false;
      syncPendingAfterFlight = false;
    }
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
    if (typeof window !== 'undefined') {
      localStorage.setItem('spendwise_currency', currency);
    }
    scheduleSyncToSupabase();
  },

  setMonthlyBudget: (month: string, year: number, amount: number) => {
    const safe = Math.max(0, amount);
    const key = `${month}-${year}`;
    set((state) => {
      const updated = { ...state.monthlyBudgets, [key]: safe };
      if (safe === 0) delete updated[key]; // remove zero-budget entries
      if (typeof window !== 'undefined') {
        localStorage.setItem('spendwise_monthly_budgets', JSON.stringify(updated));
      }
      return { monthlyBudgets: updated };
    });
    scheduleSyncToSupabase();
  },

  getMonthlyBudget: (month: string, year: number) => {
    const budgets = get().monthlyBudgets;
    const key = `${month}-${year}`;
    return budgets[key] ?? budgets._default ?? 0;
  },

  setBudgetCategoryIds: (ids: string[]) => {
    set({ budgetCategoryIds: ids });
    if (typeof window !== 'undefined') {
      localStorage.setItem('spendwise_budget_categories', JSON.stringify(ids));
    }
    scheduleSyncToSupabase();
  },

  setSelectedMonth: (month: string) => {
    set({ selectedMonth: month });
  },

  setSelectedYear: (year: number) => {
    set({ selectedYear: year });
  },

  setSelectedCity: (city: string) => {
    set({ selectedCity: city });
    scheduleSyncToSupabase();
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
    scheduleSyncToSupabase();
  },

  migrateToFinancialCycle: () => {
    const { financialCycleStart, expenses, income } = get();
    const newExpenses = expenses.map(e =>
      e.date ? { ...e, ...getFinancialPeriod(e.date, financialCycleStart) } : e
    );
    const newIncome = income.map(i =>
      i.date ? { ...i, ...getFinancialPeriod(i.date, financialCycleStart) } : i
    );
    set({ expenses: newExpenses, income: newIncome });
    scheduleSyncToSupabase();
  },

  addExpense: (expense: Expense) => {
    const period = getFinancialPeriod(expense.date, get().financialCycleStart);
    const withPeriod = { ...expense, ...period };
    set((state) => ({ expenses: [...state.expenses, withPeriod] }));
    scheduleSyncToSupabase();
  },

  deleteExpense: (id: string) => {
    set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
    scheduleSyncToSupabase();
  },

  updateExpense: (id: string, updates: Partial<Expense>) => {
    set((state) => ({
      expenses: state.expenses.map((e) => {
        if (e.id !== id) return e;
        const merged = { ...e, ...updates };
        // Recalculate financial period when date changes
        if (updates.date) {
          const period = getFinancialPeriod(merged.date, state.financialCycleStart);
          return { ...merged, ...period };
        }
        return merged;
      }),
    }));
    scheduleSyncToSupabase();
  },

  addIncome: (income: Income) => {
    const period = getFinancialPeriod(income.date, get().financialCycleStart);
    const withPeriod = { ...income, ...period };
    set((state) => ({ income: [...state.income, withPeriod] }));
    scheduleSyncToSupabase();
  },

  deleteIncome: (id: string) => {
    set((state) => ({ income: state.income.filter((i) => i.id !== id) }));
    scheduleSyncToSupabase();
  },

  updateIncome: (id: string, updates: Partial<Income>) => {
    set((state) => ({
      income: state.income.map((i) => {
        if (i.id !== id) return i;
        const merged = { ...i, ...updates };
        // Recalculate financial period when date changes
        if (updates.date) {
          const period = getFinancialPeriod(merged.date, state.financialCycleStart);
          return { ...merged, ...period };
        }
        return merged;
      }),
    }));
    scheduleSyncToSupabase();
  },

  addCategory: (category: Category) => {
    set((state) => ({ categories: [...state.categories, category] }));
    scheduleSyncToSupabase();
  },

  updateCategory: (id: string, updates: Partial<Category>) => {
    set((state) => ({
      categories: state.categories.map((c) => c.id === id ? { ...c, ...updates } : c),
    }));
    scheduleSyncToSupabase();
  },

  deleteCategory: (id: string, reassignToId?: string) => {
    set((state) => {
      const remaining = state.categories.filter(c => c.id !== id);
      // Prevent deletion of the last category
      if (remaining.length === 0) return state;
      // Determine fallback: explicit target → "Other Expenses" → first remaining
      const fallbackId = reassignToId
        ?? remaining.find(c => c.name === 'Other Expenses')?.id
        ?? remaining[0].id;
      // Reassign all expenses AND income in this category
      const newExpenses = state.expenses.map(e =>
        e.category === id ? { ...e, category: fallbackId } : e
      );
      const newIncome = state.income.map(i =>
        i.category === id ? { ...i, category: fallbackId } : i
      );
      return { categories: remaining, expenses: newExpenses, income: newIncome };
    });
    scheduleSyncToSupabase();
  },

  reorderCategory: (fromIndex: number, toIndex: number) => {
    set((state) => {
      if (fromIndex < 0 || fromIndex >= state.categories.length ||
          toIndex < 0 || toIndex >= state.categories.length) return state;
      const newCategories = [...state.categories];
      const [removed] = newCategories.splice(fromIndex, 1);
      newCategories.splice(toIndex, 0, removed);
      return { categories: newCategories };
    });
    scheduleSyncToSupabase();
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
