'use client';

import { create } from 'zustand';
import { Expense, Income, Category, RecurringRule, RecurrenceFrequency } from '@/types';
import { supabase } from '@/lib/supabase';
import { getFinancialPeriod, getCurrentFinancialPeriod, todayLocalISO } from '@/utils/financialCycle';
import { generateDue, resumeRule } from '@/lib/recurring';
import { moveById } from '@/lib/categoryOrder';

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
  resetForLogout: () => void;
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
  moveCategory: (fromId: string, toId: string) => void;
  recurring: RecurringRule[];
  addRecurringRule: (rule: RecurringRule) => void;
  updateRecurringRule: (id: string, patch: Partial<RecurringRule>) => void;
  pauseRecurringRule: (id: string) => void;
  resumeRecurringRule: (id: string) => void;
  deleteRecurringRule: (id: string, deleteGenerated: boolean) => void;
  convertToRecurring: (txnId: string, type: 'expense' | 'income', frequency: RecurrenceFrequency, endDate?: string) => void;
  runRecurringGeneration: () => void;
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
  recurring?: RecurringRule[];
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
    localStorage.setItem(`${prefix}recurring`, JSON.stringify(data.recurring ?? []));
    if (data.settings) {
      localStorage.setItem('spendwise_currency', data.settings.currency);
      localStorage.setItem('spendwise_cycle_start', String(data.settings.financialCycleStart));
      localStorage.setItem('spendwise_monthly_budgets', JSON.stringify(data.settings.monthlyBudgets));
      localStorage.setItem('spendwise_budget_categories', JSON.stringify(data.settings.budgetCategoryIds));
    }
  } catch { /* quota exceeded — non-critical */ }
}

function getLocalBackup(userId: string | null): { expenses: string | null; income: string | null; categories: string | null; recurring: string | null } {
  if (typeof window === 'undefined') return { expenses: null, income: null, categories: null, recurring: null };
  const prefix = userId ? `budget_${userId}_` : 'budget_';
  return {
    expenses:   localStorage.getItem(`${prefix}expenses`) ?? localStorage.getItem('budget_expenses'),
    income:     localStorage.getItem(`${prefix}income`) ?? localStorage.getItem('budget_income'),
    categories: localStorage.getItem(`${prefix}categories`) ?? localStorage.getItem('budget_categories'),
    recurring:  localStorage.getItem(`${prefix}recurring`) ?? localStorage.getItem('budget_recurring'),
  };
}

// ── Dirty flag: per-user localStorage marker for "has unsynced changes" ─────
// Set on every mutation, cleared only when a push succeeds with nothing newer
// queued. On the next load, a set flag means the local backup must be merged
// INTO remote data — otherwise remote is authoritative and deletions made on
// other devices are allowed to propagate.
function dirtyKey(userId: string): string {
  return `budget_${userId}_dirty`;
}
function markDirty(userId: string) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(dirtyKey(userId), '1'); } catch { /* quota — non-critical */ }
}
function clearDirty(userId: string) {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(dirtyKey(userId)); } catch { /* non-critical */ }
}
function isDirty(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(dirtyKey(userId)) === '1'; } catch { return false; }
}

/**
 * Pure financial-cycle remap used on the load paths. Same mapping as
 * migrateToFinancialCycle but returns the relabelled arrays and whether
 * anything changed — no state write, no scheduled sync.
 */
function applyCycle(
  expenses: Expense[],
  income: Income[],
  startDay: number,
): { expenses: Expense[]; income: Income[]; changed: boolean } {
  let changed = false;
  const newExpenses = expenses.map((e) => {
    if (!e.date) return e;
    const period = getFinancialPeriod(e.date, startDay);
    if (period.month !== e.month || period.year !== e.year) {
      changed = true;
      return { ...e, ...period };
    }
    return e;
  });
  const newIncome = income.map((i) => {
    if (!i.date) return i;
    const period = getFinancialPeriod(i.date, startDay);
    if (period.month !== i.month || period.year !== i.year) {
      changed = true;
      return { ...i, ...period };
    }
    return i;
  });
  return { expenses: newExpenses, income: newIncome, changed };
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

// Hydration & dirty-tracking:
//  - remoteHydrated gates every remote write so pre-hydration mutations
//    (e.g. a city toggle while data is still loading) can't wipe remote data.
//  - localHydrated means the in-memory store holds this user's loaded data —
//    before it's true, backing up would overwrite the good localStorage copy
//    with empty/default arrays.
//  - mutationSeq bumps on each mutation so a resolved push can tell whether
//    it flushed the latest state or something newer is still pending.
//  - loadRetry* backs off and retries failed loads — remote stays the truth.
let remoteHydrated = false;
let localHydrated = false;
let mutationSeq = 0;
let loadRetryTimer: ReturnType<typeof setTimeout> | null = null;
let loadRetryCount = 0;

/** Read the latest state from the store and return the sync payload. */
function getLatestSyncPayload(): RemoteData {
  const { expenses, income, categories, recurring, currency, financialCycleStart, monthlyBudgets, budgetCategoryIds, excludedCategoryIds, selectedCity, savingsTarget } = useBudgetStore.getState();
  return {
    expenses, income, categories, recurring,
    settings: { currency, financialCycleStart, monthlyBudgets, budgetCategoryIds, excludedCategoryIds, selectedCity, savingsTarget },
  };
}

/** Actually push data to Supabase (called by the debounce / retry). */
async function executeSyncToSupabase() {
  const userId = useBudgetStore.getState().userId;
  if (!userId || !remoteHydrated) return;

  const uid = userId;
  const seq = mutationSeq;

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
    // Clear the dirty flag only if nothing newer was queued while we pushed
    if (seq === mutationSeq && !syncPendingAfterFlight && useBudgetStore.getState().userId === uid) {
      clearDirty(uid);
    }
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
  const uid = useBudgetStore.getState().userId;

  // Pre-hydration for a signed-in user: the store still holds empty/default
  // data — backing it up would clobber the good local backup, and marking
  // dirty would make the next load's merge treat those defaults as truth.
  if (uid && !localHydrated) return;

  // Immediate localStorage backup with latest state
  backupToLocalStorage(getLatestSyncPayload());

  if (uid) {
    markDirty(uid);
    mutationSeq++;
  }

  // Not hydrated — skip the remote write entirely. The dirty local backup is
  // merged into remote data by the next successful loadFromSupabase.
  if (!remoteHydrated) return;

  if (syncInFlight) {
    // A sync is currently awaiting Supabase — mark that we need to re-sync
    syncPendingAfterFlight = true;
    return;
  }

  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    syncDebounceTimer = null;
    executeSyncToSupabase();
  }, 350);
}

/**
 * Flush any pending debounced sync immediately.
 * Called on beforeunload and before signOut so pending changes aren't lost.
 */
export async function flushPendingSync(): Promise<void> {
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = null;
    await executeSyncToSupabase();
    return;
  }
  if (syncInFlight) {
    // Wait for the in-flight sync to finish (poll every 100ms, max 5s)
    const deadline = Date.now() + 5000;
    while (syncInFlight && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (syncPendingAfterFlight) {
      syncPendingAfterFlight = false;
      await executeSyncToSupabase();
    }
    // The finished sync may have scheduled a debounced follow-up
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer);
      syncDebounceTimer = null;
      await executeSyncToSupabase();
    }
  }
}

// Auto-register beforeunload handler (client-side only)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // Flush localStorage immediately (synchronous, guaranteed) — but not
    // pre-hydration, which would overwrite the good backup with defaults
    if (localHydrated) backupToLocalStorage(getLatestSyncPayload());
    // Attempt Supabase sync (may not complete, but localStorage is safe)
    void flushPendingSync();
  });

  // Network status awareness — retry sync when coming back online
  window.addEventListener('online', () => {
    if (syncRetryCount > 0 || syncPendingAfterFlight) {
      syncRetryCount = 0;
      if (syncRetryTimeout) { clearTimeout(syncRetryTimeout); syncRetryTimeout = null; }
      scheduleSyncToSupabase();
    }
    // A failed load retries on reconnect too — remote is the source of truth
    if (useBudgetStore.getState().userId && !remoteHydrated) {
      loadFromSupabase();
    }
  });

  // Daily rollover: returning to a visible tab materialises any recurring
  // occurrences that came due while the app was hidden.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && useBudgetStore.getState().userId) {
        useBudgetStore.getState().runRecurringGeneration();
      }
    });
  }
}

/** Legacy wrapper — kept for the one-off sync in loadFromSupabase. */
async function syncToSupabase(data: RemoteData) {
  backupToLocalStorage(data);
  const userId = useBudgetStore.getState().userId;
  if (!userId || !remoteHydrated) return;
  const uid = userId;
  const seq = mutationSeq;
  useBudgetStore.setState({ syncing: true, networkError: false });
  try {
    const { error } = await supabase
      .from('budget_data')
      .upsert({ user_id: userId, ...data }, { onConflict: 'user_id' });
    if (error) throw error;
    syncRetryCount = 0;
    // Clear the dirty flag only if nothing newer was queued while we pushed
    if (seq === mutationSeq && !syncPendingAfterFlight && useBudgetStore.getState().userId === uid) {
      clearDirty(uid);
    }
    useBudgetStore.setState({ syncing: false, networkError: false });
  } catch {
    useBudgetStore.setState({ syncing: false, networkError: true });
  }
}

async function loadFromSupabase() {
  const userId = useBudgetStore.getState().userId;
  if (!userId) return;

  // Block remote writes until this load completes. Mutations that happen in
  // the meantime are backed up + marked dirty and get merged below instead of
  // pushing the still-empty store over remote data.
  remoteHydrated = false;
  const uid = userId;

  // Version guard: if another load starts while we're awaiting, discard our stale result
  const thisLoad = ++loadVersion;

  const { data, error } = await supabase
    .from('budget_data')
    .select('expenses, income, categories, settings, recurring')
    .eq('user_id', userId)
    .single();

  // Stale guard — a newer load started (or the user changed) while we were awaiting
  if (thisLoad !== loadVersion || useBudgetStore.getState().userId !== uid) return;

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
    // Apply the cycle mapping directly — migrateToFinancialCycle() would
    // schedule a sync and push this stale backup over fresher remote data.
    const cycled = applyCycle(parsedExpenses, parsedIncome, useBudgetStore.getState().financialCycleStart);
    useBudgetStore.setState({ expenses: cycled.expenses, income: cycled.income, categories: migratedCats });
    localHydrated = true;
    useBudgetStore.setState({ networkError: true });
    // Retry the load with backoff — remote remains the source of truth
    loadRetryCount++;
    if (loadRetryTimer) clearTimeout(loadRetryTimer);
    loadRetryTimer = setTimeout(loadFromSupabase, Math.min(60000, 2000 * Math.pow(2, loadRetryCount)));
    return;
  }

  if (isNoRows || !data) {
    // No remote data yet — restore from localStorage backup and push to Supabase
    const local = getLocalBackup(userId);
    let rawCategories: Category[];
    let parsedExpenses: Expense[];
    let parsedIncome: Income[];
    let parsedRecurring: RecurringRule[];
    try { parsedRecurring = local.recurring ? JSON.parse(local.recurring) : []; } catch { parsedRecurring = []; }
    if (!Array.isArray(parsedRecurring)) parsedRecurring = [];
    try { rawCategories  = local.categories ? JSON.parse(local.categories) : defaultCategories; } catch { rawCategories = defaultCategories; }
    try { parsedExpenses = local.expenses   ? JSON.parse(local.expenses)   : [];                } catch { parsedExpenses = []; }
    try { parsedIncome   = local.income     ? JSON.parse(local.income)     : [];                } catch { parsedIncome   = []; }
    if (!Array.isArray(parsedExpenses)) parsedExpenses = [];
    if (!Array.isArray(parsedIncome))   parsedIncome   = [];
    if (!Array.isArray(rawCategories))  rawCategories  = defaultCategories;
    const { categories: migratedCats, changed } = migrateCategories(rawCategories);
    // Apply the cycle mapping before setState/push (pure — no sync scheduled)
    const cycled = applyCycle(parsedExpenses, parsedIncome, useBudgetStore.getState().financialCycleStart);

    // Include current local settings in the initial upload
    const { currency, financialCycleStart, monthlyBudgets, budgetCategoryIds, excludedCategoryIds, selectedCity, savingsTarget } = useBudgetStore.getState();
    const migrated: RemoteData = {
      expenses:   cycled.expenses,
      income:     cycled.income,
      categories: migratedCats,
      recurring:  parsedRecurring,
      settings:   { currency, financialCycleStart, monthlyBudgets, budgetCategoryIds, excludedCategoryIds, selectedCity, savingsTarget },
    };

    if (thisLoad !== loadVersion || useBudgetStore.getState().userId !== uid) return;
    const { settings: _ms, ...migratedData } = migrated;
    useBudgetStore.setState(migratedData);
    localHydrated = true;

    // Mark hydrated BEFORE the push — syncToSupabase is gated on it
    remoteHydrated = true;
    loadRetryCount = 0;
    if (loadRetryTimer) { clearTimeout(loadRetryTimer); loadRetryTimer = null; }
    useBudgetStore.setState({ networkError: false });

    // Push existing localStorage data up to Supabase (and if migration ran, persist it)
    if (local.expenses || local.income || local.categories || local.recurring || changed) {
      await syncToSupabase(migrated);
    }
    // Materialise any recurring occurrences already due (hydration just finished)
    useBudgetStore.getState().runRecurringGeneration();
    return;
  }

  // Validate remote data — arrays may be null, undefined, or corrupted
  const rawExpenses  = Array.isArray(data.expenses)   ? data.expenses   : [];
  const rawIncome    = Array.isArray(data.income)      ? data.income     : [];
  const rawCats      = Array.isArray(data.categories)  ? data.categories : defaultCategories;
  const rawRecurring = Array.isArray(data.recurring)   ? (data.recurring as RecurringRule[]) : [];

  const { categories: migratedRemoteCats, changed: remoteCatsChanged } = migrateCategories(rawCats);

  // Parse remote settings (may be null if column doesn't exist yet or first sync)
  const remoteSettings: UserSettings | null = data.settings && typeof data.settings === 'object'
    ? data.settings as UserSettings
    : null;

  const remote: RemoteData = {
    expenses:   rawExpenses,
    income:     rawIncome,
    categories: migratedRemoteCats,
    recurring:  rawRecurring,
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

  // Merge the localStorage backup ONLY when this device has unsynced changes
  // (dirty flag). Union by id — local wins for shared ids, remote-only items
  // kept in remote order, local-only appended. When not dirty, remote is
  // authoritative so deletions made on other devices propagate (no resurrection).
  const dirty = isDirty(uid);
  if (dirty) {
    const local = getLocalBackup(userId);

    let localExpenses: Expense[] = [];
    let localIncome: Income[]    = [];
    let localCategories: Category[] = [];
    let localRecurring: RecurringRule[] = [];
    try { localExpenses   = local.expenses   ? JSON.parse(local.expenses)   : []; } catch { /* corrupted */ }
    try { localIncome     = local.income     ? JSON.parse(local.income)     : []; } catch { /* corrupted */ }
    try { localCategories = local.categories ? JSON.parse(local.categories) : []; } catch { /* corrupted */ }
    try { localRecurring  = local.recurring  ? JSON.parse(local.recurring)  : []; } catch { /* corrupted */ }
    if (!Array.isArray(localExpenses))   localExpenses   = [];
    if (!Array.isArray(localIncome))     localIncome     = [];
    if (!Array.isArray(localCategories)) localCategories = [];
    if (!Array.isArray(localRecurring))  localRecurring  = [];

    const mergeById = <T extends { id: string }>(remoteArr: T[], localArr: T[]): T[] => {
      const localById = new Map(localArr.map((x) => [x.id, x]));
      const remoteIds = new Set(remoteArr.map((x) => x.id));
      return [
        ...remoteArr.map((x) => localById.get(x.id) ?? x),
        ...localArr.filter((x) => !remoteIds.has(x.id)),
      ];
    };
    remote.expenses   = mergeById(remote.expenses,   localExpenses);
    remote.income     = mergeById(remote.income,     localIncome);
    remote.categories = mergeById(remote.categories, localCategories);
    remote.recurring  = mergeById(remote.recurring ?? [], localRecurring);
  }

  // Apply the financial-cycle mapping directly — migrateToFinancialCycle()
  // would schedule a sync; the conditional push below covers any relabelling.
  const cycled = applyCycle(remote.expenses, remote.income, useBudgetStore.getState().financialCycleStart);
  remote.expenses = cycled.expenses;
  remote.income = cycled.income;

  remoteHydrated = true;
  loadRetryCount = 0;
  if (loadRetryTimer) { clearTimeout(loadRetryTimer); loadRetryTimer = null; }
  useBudgetStore.setState({ networkError: false });

  // Apply data (settings already applied above, strip from setState to avoid stale key)
  const { settings: _s, ...remoteData } = remote;
  useBudgetStore.setState(remoteData);
  localHydrated = true;
  backupToLocalStorage(remote);

  // Push merged/migrated data back to Supabase when anything changed.
  // A successful push clears the dirty flag via syncToSupabase; a failed one
  // leaves it set so the next load re-merges.
  if (dirty || remoteCatsChanged || cycled.changed) {
    if (thisLoad !== loadVersion || useBudgetStore.getState().userId !== uid) return;
    await syncToSupabase(remote);
  }

  // Materialise any recurring occurrences already due (hydration just finished)
  useBudgetStore.getState().runRecurringGeneration();
}

/** Clear all pending sync/load timers and flags — used on logout and when
 *  switching users so no stale work fires for the previous session. */
function clearPendingSyncWork() {
  if (syncRetryTimeout) { clearTimeout(syncRetryTimeout); syncRetryTimeout = null; }
  if (syncDebounceTimer) { clearTimeout(syncDebounceTimer); syncDebounceTimer = null; }
  if (loadRetryTimer) { clearTimeout(loadRetryTimer); loadRetryTimer = null; }
  syncRetryCount = 0;
  loadRetryCount = 0;
  syncInFlight = false;
  syncPendingAfterFlight = false;
  remoteHydrated = false;
  localHydrated = false;
  loadVersion++; // cancel any in-flight load
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
  recurring: [],
  financialCycleStart: initCycleStart,
  monthlyBudgets: typeof window !== 'undefined' ? (() => { try { const raw = localStorage.getItem('spendwise_monthly_budgets'); if (raw) return JSON.parse(raw); const legacy = parseFloat(localStorage.getItem('spendwise_monthly_budget') ?? '0'); return legacy > 0 ? { _default: legacy } : {}; } catch { return {}; } })() : {},
  budgetCategoryIds: typeof window !== 'undefined' ? (() => { try { return JSON.parse(localStorage.getItem('spendwise_budget_categories') ?? '[]'); } catch { return []; } })() : [],
  savingsTarget: 20,
  setSavingsTarget: (pct: number) => { set({ savingsTarget: Math.max(0, Math.min(100, pct)) }); scheduleSyncToSupabase(); },

  setExcludedCategoryIds: (ids: string[]) => { set({ excludedCategoryIds: ids, selectedCategoryIds: ids }); scheduleSyncToSupabase(); },
  setSelectedCategoryIds: (ids: string[]) => { set({ excludedCategoryIds: ids, selectedCategoryIds: ids }); scheduleSyncToSupabase(); },

  setUserId: (userId: string | null) => {
    // On logout: clear pending sync timers to prevent stale writes
    if (!userId) clearPendingSyncWork();
    set({ userId });
    // Clean up old unscoped localStorage keys to prevent cross-user contamination
    if (userId && typeof window !== 'undefined') {
      localStorage.removeItem('budget_expenses');
      localStorage.removeItem('budget_income');
      localStorage.removeItem('budget_categories');
      localStorage.removeItem('budget_recurring');
    }
  },

  // Full logout reset: clears in-memory data + session flags so the previous
  // user's data isn't shown or synced. localStorage backup is intentionally
  // kept — a re-login of the same user still has its offline copy.
  resetForLogout: () => {
    clearPendingSyncWork();
    set({ userId: null, expenses: [], income: [], categories: defaultCategories, recurring: [], syncing: false, networkError: false });
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
    const { expenses: newExpenses, income: newIncome } = applyCycle(expenses, income, financialCycleStart);
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

  // Id-based reorder used by the Settings categories list (pure permutation)
  moveCategory: (fromId: string, toId: string) => {
    set((state) => ({ categories: moveById(state.categories, fromId, toId) }));
    scheduleSyncToSupabase();
  },

  // ── Recurring rules ───────────────────────────────────────────────────────
  // runRecurringGeneration materialises due occurrences (gated on
  // remoteHydrated so pre-load mutation can't push half-initialised state).
  // It schedules its own sync only when something actually changed; callers
  // still scheduleSyncToSupabase() to persist the rule edit itself — the
  // debounce consolidates both into one upsert.
  addRecurringRule: (rule: RecurringRule) => {
    set((state) => ({ recurring: [...state.recurring, rule] }));
    get().runRecurringGeneration();
    scheduleSyncToSupabase();
  },

  updateRecurringRule: (id: string, patch: Partial<RecurringRule>) => {
    set((state) => ({
      recurring: state.recurring.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
    get().runRecurringGeneration();
    scheduleSyncToSupabase();
  },

  pauseRecurringRule: (id: string) => {
    set((state) => ({
      recurring: state.recurring.map((r) => (r.id === id ? { ...r, paused: true } : r)),
    }));
    scheduleSyncToSupabase();
  },

  resumeRecurringRule: (id: string) => {
    const today = todayLocalISO();
    set((state) => ({
      // resumeRule fast-forwards generatedThrough to today → no backfill of
      // occurrences skipped while the rule was paused
      recurring: state.recurring.map((r) => (r.id === id ? resumeRule(r, today) : r)),
    }));
    get().runRecurringGeneration();
    scheduleSyncToSupabase();
  },

  deleteRecurringRule: (id: string, deleteGenerated: boolean) => {
    set((state) => ({
      recurring: state.recurring.filter((r) => r.id !== id),
      ...(deleteGenerated
        ? {
            expenses: state.expenses.filter((e) => e.recurringId !== id),
            income: state.income.filter((i) => i.recurringId !== id),
          }
        : {}),
    }));
    scheduleSyncToSupabase();
  },

  // Turn an existing transaction into a rule anchored on its date. The txn
  // keeps its own id and gains recurringId; generatedThrough = txn.date marks
  // it as occurrence #1 so the generator never duplicates it.
  convertToRecurring: (txnId: string, type: 'expense' | 'income', frequency: RecurrenceFrequency, endDate?: string) => {
    const state = get();
    const txn = type === 'expense'
      ? state.expenses.find((e) => e.id === txnId)
      : state.income.find((i) => i.id === txnId);
    if (!txn) return;
    const rule: RecurringRule = {
      id: generateId('rec'),
      type,
      amount: txn.amount,
      category: txn.category ?? '',
      description: type === 'expense' ? (txn as Expense).description : (txn as Income).source,
      city: type === 'expense' ? (txn as Expense).city : undefined,
      frequency,
      startDate: txn.date,
      endDate,
      paused: false,
      generatedThrough: txn.date,
      createdAt: new Date().toISOString(),
      tax: txn.tax,
    };
    set((s) => ({
      recurring: [...s.recurring, rule],
      ...(type === 'expense'
        ? { expenses: s.expenses.map((e) => (e.id === txnId ? { ...e, recurringId: rule.id } : e)) }
        : { income: s.income.map((i) => (i.id === txnId ? { ...i, recurringId: rule.id } : i)) }),
    }));
    get().runRecurringGeneration();
    scheduleSyncToSupabase();
  },

  runRecurringGeneration: () => {
    // Never run before remote hydration — generated rows would be pushed
    // against an unmerged store and could duplicate or clobber remote data.
    if (!remoteHydrated) return;
    const state = get();
    const existingIds = new Set([
      ...state.expenses.map((e) => e.id),
      ...state.income.map((i) => i.id),
    ]);
    const due = generateDue(state.recurring, existingIds, todayLocalISO());
    const rulesChanged = due.rules.some((r, i) => r !== state.recurring[i]);
    if (due.expenses.length === 0 && due.income.length === 0 && !rulesChanged) return;
    const startDay = state.financialCycleStart;
    set({
      expenses: due.expenses.length
        ? [...state.expenses, ...due.expenses.map((e) => ({ ...e, ...getFinancialPeriod(e.date, startDay) }))]
        : state.expenses,
      income: due.income.length
        ? [...state.income, ...due.income.map((i) => ({ ...i, ...getFinancialPeriod(i.date, startDay) }))]
        : state.income,
      recurring: due.rules,
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
