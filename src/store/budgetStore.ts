'use client';

import { create } from 'zustand';
import { Expense, Income, Category, RecurringRule, RecurrenceFrequency, SavingsGoal, BudgetAlertThresholds, SpendingTarget, OpeningBalanceBaseline } from '@/types';
import { supabase } from '@/lib/supabase';
import { getFinancialPeriod, getCurrentFinancialPeriod, todayLocalISO } from '@/utils/financialCycle';
import { formatCurrency } from '@/utils/currency';
import { generateDue, resumeRule, mergeRecurringRules } from '@/lib/recurring';
import { moveById } from '@/lib/categoryOrder';
import { validateThresholds, pruneKeys } from '@/lib/budgetAlerts';
import { validateBaseline } from '@/lib/balance';
import { capBalanceFunding } from '@/lib/funding';
import {
  getStoredTheme, setStoredTheme, applyTheme, resolveTheme, ThemePreference,
} from '@/lib/theme';

function prefersDarkNow(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function isValidTheme(v: unknown): v is ThemePreference {
  return v === 'light' || v === 'dark' || v === 'system';
}

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
  // Transient toasts for available-balance shortfalls during recurring
  // generation — surfaced once by the page then cleared; never persisted.
  fundingNotices: string[];
  clearFundingNotices: () => void;
  goals: SavingsGoal[];
  addGoal: (goal: SavingsGoal) => void;
  updateGoal: (id: string, patch: Partial<SavingsGoal>) => void;
  contributeToGoal: (id: string, amount: number) => void;
  archiveGoal: (id: string, archived: boolean) => void;
  deleteGoal: (id: string) => void;
  // Per-category monthly budgets + alert configuration (remote settings only)
  categoryBudgets: Record<string, number>;
  alertThresholds: BudgetAlertThresholds;
  alertsEnabled: boolean;
  acknowledgedAlerts: string[];
  notifiedAlerts: string[];
  setCategoryBudget: (catId: string, amount: number) => void;
  setAlertThresholds: (t: BudgetAlertThresholds) => void;
  setAlertsEnabled: (enabled: boolean) => void;
  acknowledgeAlert: (key: string) => void;
  markAlertsNotified: (keys: string[]) => void;
  // Savings opportunities — remote settings only
  dismissedOpportunities: string[];            // '{periodKey}:{opportunityId}'
  mutedOpportunityCategories: string[];
  spendingTargets: Record<string, SpendingTarget>;
  dismissOpportunity: (key: string) => void;
  restoreOpportunity: (key: string) => void;
  muteOpportunityCategory: (catId: string) => void;
  unmuteOpportunityCategory: (catId: string) => void;
  setSpendingTarget: (catId: string, target: { target: number; baselineMonthly: number }) => void;
  removeSpendingTarget: (catId: string, alsoRemoveBudget: boolean) => void;
  // Annual opening balance — derived ledger lives in useBalanceLedger
  openingBalance: OpeningBalanceBaseline | null;
  setOpeningBalance: (input: { startYear: number; amount: number; effectiveDate: string }) => void;
  clearOpeningBalance: () => void;
  themePreference: ThemePreference;
  setThemePreference: (p: ThemePreference) => void;
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
  categoryBudgets?: Record<string, number>;
  alertThresholds?: BudgetAlertThresholds;
  alertsEnabled?: boolean;
  acknowledgedAlerts?: string[];
  notifiedAlerts?: string[];
  dismissedOpportunities?: string[];
  mutedOpportunityCategories?: string[];
  spendingTargets?: Record<string, SpendingTarget>;
  openingBalance?: OpeningBalanceBaseline | null;
  themePreference?: ThemePreference;
}

const DEFAULT_ALERT_THRESHOLDS: BudgetAlertThresholds = { warning: 80, exceeded: 100 };

interface RemoteData {
  expenses: Expense[];
  income: Income[];
  categories: Category[];
  recurring?: RecurringRule[];
  goals?: SavingsGoal[];
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
    localStorage.setItem(`${prefix}goals`, JSON.stringify(data.goals ?? []));
    if (data.settings) {
      localStorage.setItem('spendwise_currency', data.settings.currency);
      localStorage.setItem('spendwise_cycle_start', String(data.settings.financialCycleStart));
      localStorage.setItem('spendwise_monthly_budgets', JSON.stringify(data.settings.monthlyBudgets));
      localStorage.setItem('spendwise_budget_categories', JSON.stringify(data.settings.budgetCategoryIds));
    }
  } catch { /* quota exceeded — non-critical */ }
}

function getLocalBackup(userId: string | null): { expenses: string | null; income: string | null; categories: string | null; recurring: string | null; goals: string | null } {
  if (typeof window === 'undefined') return { expenses: null, income: null, categories: null, recurring: null, goals: null };
  // Deprecated reserve-transfers backups — the concept no longer exists.
  const uidPrefix = userId ? `budget_${userId}_` : 'budget_';
  try {
    localStorage.removeItem('budget_reserve_transfers');
    localStorage.removeItem(`${uidPrefix}reserve_transfers`);
  } catch { /* ignore */ }
  const prefix = userId ? `budget_${userId}_` : 'budget_';
  return {
    expenses:   localStorage.getItem(`${prefix}expenses`) ?? localStorage.getItem('budget_expenses'),
    income:     localStorage.getItem(`${prefix}income`) ?? localStorage.getItem('budget_income'),
    categories: localStorage.getItem(`${prefix}categories`) ?? localStorage.getItem('budget_categories'),
    recurring:  localStorage.getItem(`${prefix}recurring`) ?? localStorage.getItem('budget_recurring'),
    goals:      localStorage.getItem(`${prefix}goals`) ?? localStorage.getItem('budget_goals'),
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

/** Periods whose alert keys stay live: the selected financial period + the previous one. */
function alertKeepPeriods(state: { selectedMonth: string; selectedYear: number }): string[] {
  let m = parseInt(state.selectedMonth, 10) - 1;
  let y = state.selectedYear;
  if (m < 1) { m = 12; y -= 1; }
  return [`${state.selectedYear}-${state.selectedMonth}`, `${y}-${String(m).padStart(2, '0')}`];
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
  const {
    expenses, income, categories, recurring, goals,
    currency, financialCycleStart, monthlyBudgets, budgetCategoryIds, excludedCategoryIds,
    selectedCity, savingsTarget, categoryBudgets, alertThresholds, alertsEnabled,
    acknowledgedAlerts, notifiedAlerts, dismissedOpportunities, mutedOpportunityCategories,
    spendingTargets, openingBalance, themePreference,
  } = useBudgetStore.getState();
  return {
    expenses, income, categories, recurring, goals,
    settings: {
      currency, financialCycleStart, monthlyBudgets, budgetCategoryIds, excludedCategoryIds,
      selectedCity, savingsTarget, categoryBudgets, alertThresholds, alertsEnabled,
      acknowledgedAlerts, notifiedAlerts, dismissedOpportunities, mutedOpportunityCategories,
      spendingTargets, openingBalance, themePreference,
    },
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
    .select('expenses, income, categories, settings, recurring, goals')
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
    let parsedGoals: SavingsGoal[];
    try { parsedRecurring = local.recurring ? JSON.parse(local.recurring) : []; } catch { parsedRecurring = []; }
    if (!Array.isArray(parsedRecurring)) parsedRecurring = [];
    try { parsedGoals = local.goals ? JSON.parse(local.goals) : []; } catch { parsedGoals = []; }
    if (!Array.isArray(parsedGoals)) parsedGoals = [];
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
    const {
      currency, financialCycleStart, monthlyBudgets, budgetCategoryIds, excludedCategoryIds,
      selectedCity, savingsTarget, categoryBudgets, alertThresholds, alertsEnabled,
      acknowledgedAlerts, notifiedAlerts, dismissedOpportunities, mutedOpportunityCategories,
      spendingTargets, openingBalance, themePreference,
    } = useBudgetStore.getState();
    const migrated: RemoteData = {
      expenses:   cycled.expenses,
      income:     cycled.income,
      categories: migratedCats,
      recurring:  parsedRecurring,
      goals:      parsedGoals,
      settings:   {
        currency, financialCycleStart, monthlyBudgets, budgetCategoryIds, excludedCategoryIds,
        selectedCity, savingsTarget, categoryBudgets, alertThresholds, alertsEnabled,
        acknowledgedAlerts, notifiedAlerts, dismissedOpportunities, mutedOpportunityCategories,
        spendingTargets, openingBalance, themePreference,
      },
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
    if (local.expenses || local.income || local.categories || local.recurring || local.goals || changed) {
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
  const rawGoals     = Array.isArray(data.goals)       ? (data.goals as SavingsGoal[])       : [];

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
    goals:      rawGoals,
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
    if (remoteSettings.categoryBudgets && typeof remoteSettings.categoryBudgets === 'object') {
      // Keep only non-negative finite amounts
      const clean: Record<string, number> = {};
      for (const [k, v] of Object.entries(remoteSettings.categoryBudgets)) {
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) clean[k] = v;
      }
      settingsUpdate.categoryBudgets = clean;
    }
    if (remoteSettings.alertThresholds && typeof remoteSettings.alertThresholds === 'object'
        && !validateThresholds(remoteSettings.alertThresholds)) {
      settingsUpdate.alertThresholds = remoteSettings.alertThresholds;
    }
    if (typeof remoteSettings.alertsEnabled === 'boolean') {
      settingsUpdate.alertsEnabled = remoteSettings.alertsEnabled;
    }
    if (Array.isArray(remoteSettings.acknowledgedAlerts)) {
      settingsUpdate.acknowledgedAlerts = remoteSettings.acknowledgedAlerts.filter(k => typeof k === 'string');
    }
    if (Array.isArray(remoteSettings.notifiedAlerts)) {
      settingsUpdate.notifiedAlerts = remoteSettings.notifiedAlerts.filter(k => typeof k === 'string');
    }
    if (Array.isArray(remoteSettings.dismissedOpportunities)) {
      settingsUpdate.dismissedOpportunities = remoteSettings.dismissedOpportunities.filter(k => typeof k === 'string');
    }
    if (Array.isArray(remoteSettings.mutedOpportunityCategories)) {
      settingsUpdate.mutedOpportunityCategories = remoteSettings.mutedOpportunityCategories.filter(k => typeof k === 'string');
    }
    if (remoteSettings.spendingTargets && typeof remoteSettings.spendingTargets === 'object') {
      const cleanTargets: Record<string, SpendingTarget> = {};
      for (const [k, v] of Object.entries(remoteSettings.spendingTargets)) {
        if (v && typeof v === 'object'
            && typeof (v as SpendingTarget).target === 'number' && Number.isFinite((v as SpendingTarget).target) && (v as SpendingTarget).target > 0
            && typeof (v as SpendingTarget).baselineMonthly === 'number' && Number.isFinite((v as SpendingTarget).baselineMonthly)
            && typeof (v as SpendingTarget).createdAt === 'string'
            && typeof (v as SpendingTarget).createdForPeriod === 'string') {
          cleanTargets[k] = v as SpendingTarget;
        }
      }
      settingsUpdate.spendingTargets = cleanTargets;
    }
    if ('openingBalance' in remoteSettings) {
      const ob = remoteSettings.openingBalance;
      if (ob === null) {
        settingsUpdate.openingBalance = null;
      } else if (ob && typeof ob === 'object'
          && typeof ob.createdAt === 'string' && typeof ob.updatedAt === 'string'
          && Object.keys(validateBaseline(
            { startYear: ob.startYear, amount: ob.amount, effectiveDate: ob.effectiveDate },
            remoteSettings.financialCycleStart ?? useBudgetStore.getState().financialCycleStart,
          )).length === 0) {
        settingsUpdate.openingBalance = ob;
      }
      // invalid shape → keep current value (don't trust the remote blob)
    }
    if (isValidTheme(remoteSettings.themePreference)
        && remoteSettings.themePreference !== useBudgetStore.getState().themePreference) {
      // Remote preference wins — apply it and persist locally so the next
      // boot (before hydration) resolves the same theme
      settingsUpdate.themePreference = remoteSettings.themePreference;
      setStoredTheme(remoteSettings.themePreference);
      applyTheme(resolveTheme(remoteSettings.themePreference, prefersDarkNow()));
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
    let localGoals: SavingsGoal[] = [];
    try { localExpenses   = local.expenses   ? JSON.parse(local.expenses)   : []; } catch { /* corrupted */ }
    try { localIncome     = local.income     ? JSON.parse(local.income)     : []; } catch { /* corrupted */ }
    try { localCategories = local.categories ? JSON.parse(local.categories) : []; } catch { /* corrupted */ }
    try { localRecurring  = local.recurring  ? JSON.parse(local.recurring)  : []; } catch { /* corrupted */ }
    try { localGoals      = local.goals      ? JSON.parse(local.goals)      : []; } catch { /* corrupted */ }
    if (!Array.isArray(localExpenses))   localExpenses   = [];
    if (!Array.isArray(localIncome))     localIncome     = [];
    if (!Array.isArray(localCategories)) localCategories = [];
    if (!Array.isArray(localRecurring))  localRecurring  = [];
    if (!Array.isArray(localGoals))      localGoals      = [];

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
    // Rules use the dedicated merge — generatedThrough takes the max so a
    // stale local bound can't resurrect occurrences deleted elsewhere
    remote.recurring  = mergeRecurringRules(remote.recurring ?? [], localRecurring);
    remote.goals      = mergeById(remote.goals ?? [], localGoals);
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
  goals: [],
  fundingNotices: [],
  clearFundingNotices: () => set({ fundingNotices: [] }),
  // Alert settings — remote-backed only (no separate localStorage keys)
  categoryBudgets: {},
  alertThresholds: DEFAULT_ALERT_THRESHOLDS,
  alertsEnabled: true,
  acknowledgedAlerts: [],
  notifiedAlerts: [],
  dismissedOpportunities: [],
  mutedOpportunityCategories: [],
  spendingTargets: {},
  openingBalance: null,
  themePreference: getStoredTheme(),
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
      localStorage.removeItem('budget_goals');
      localStorage.removeItem('budget_reserve_transfers');
    }
  },

  // Full logout reset: clears in-memory data + session flags so the previous
  // user's data isn't shown or synced. localStorage backup is intentionally
  // kept — a re-login of the same user still has its offline copy.
  resetForLogout: () => {
    clearPendingSyncWork();
    set({ userId: null, expenses: [], income: [], categories: defaultCategories, recurring: [], goals: [], fundingNotices: [], syncing: false, networkError: false });
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
    // Generated balance-funded occurrences must never take the available
    // balance below zero — cap the balance portion against the evolving
    // overall balance and surface what was adjusted via a toast.
    const capped = capBalanceFunding(due.expenses, {
      baseline: state.openingBalance,
      expenses: state.expenses,
      income: state.income,
      financialCycleStart: state.financialCycleStart,
    });
    set({
      expenses: capped.expenses.length
        ? [...state.expenses, ...capped.expenses.map((e) => ({ ...e, ...getFinancialPeriod(e.date, startDay) }))]
        : state.expenses,
      income: due.income.length
        ? [...state.income, ...due.income.map((i) => ({ ...i, ...getFinancialPeriod(i.date, startDay) }))]
        : state.income,
      recurring: due.rules,
      fundingNotices: capped.notices.length
        ? [...state.fundingNotices, ...capped.notices.map(n =>
            `Your available balance was ${formatCurrency(n.shortBy, state.currency)} short for ${n.description} on ${n.date} — the remainder was charged to your monthly budget.`)]
        : state.fundingNotices,
    });
    scheduleSyncToSupabase();
  },

  // ── Savings goals ────────────────────────────────────────────────────────
  addGoal: (goal: SavingsGoal) => {
    set((state) => ({ goals: [...state.goals, goal] }));
    scheduleSyncToSupabase();
  },

  updateGoal: (id: string, patch: Partial<SavingsGoal>) => {
    set((state) => ({
      goals: state.goals.map((g) => (g.id === id ? { ...g, ...patch, updatedAt: new Date().toISOString() } : g)),
    }));
    scheduleSyncToSupabase();
  },

  // Contributions can be negative (withdrawals); savedAmount never dips below 0
  contributeToGoal: (id: string, amount: number) => {
    if (!Number.isFinite(amount) || amount === 0) return;
    set((state) => ({
      goals: state.goals.map((g) => (g.id === id
        ? { ...g, savedAmount: Math.max(0, Math.round((g.savedAmount + amount) * 100) / 100), updatedAt: new Date().toISOString() }
        : g)),
    }));
    scheduleSyncToSupabase();
  },

  archiveGoal: (id: string, archived: boolean) => {
    get().updateGoal(id, { archived });
  },

  deleteGoal: (id: string) => {
    set((state) => ({ goals: state.goals.filter((g) => g.id !== id) }));
    scheduleSyncToSupabase();
  },

  // ── Budget alert settings ─────────────────────────────────────────────────
  setCategoryBudget: (catId: string, amount: number) => {
    const safe = Math.max(0, amount);
    set((state) => {
      const updated = { ...state.categoryBudgets };
      if (safe === 0) delete updated[catId]; // zero = remove the budget
      else updated[catId] = safe;
      return { categoryBudgets: updated };
    });
    scheduleSyncToSupabase();
  },

  setAlertThresholds: (t: BudgetAlertThresholds) => {
    if (validateThresholds(t)) return; // invalid → reject silently, UI shows the message
    set({ alertThresholds: t });
    scheduleSyncToSupabase();
  },

  setAlertsEnabled: (enabled: boolean) => {
    set({ alertsEnabled: enabled });
    scheduleSyncToSupabase();
  },

  acknowledgeAlert: (key: string) => {
    set((state) => ({
      acknowledgedAlerts: pruneKeys([...state.acknowledgedAlerts, key], alertKeepPeriods(state)),
    }));
    scheduleSyncToSupabase();
  },

  markAlertsNotified: (keys: string[]) => {
    set((state) => ({
      notifiedAlerts: pruneKeys([...state.notifiedAlerts, ...keys], alertKeepPeriods(state)),
    }));
    scheduleSyncToSupabase();
  },

  // ── Savings opportunities ────────────────────────────────────────────────
  dismissOpportunity: (key: string) => {
    set((state) => ({
      dismissedOpportunities: state.dismissedOpportunities.includes(key)
        ? state.dismissedOpportunities
        : pruneKeys([...state.dismissedOpportunities, key], alertKeepPeriods(state)),
    }));
    scheduleSyncToSupabase();
  },

  restoreOpportunity: (key: string) => {
    set((state) => ({ dismissedOpportunities: state.dismissedOpportunities.filter(k => k !== key) }));
    scheduleSyncToSupabase();
  },

  muteOpportunityCategory: (catId: string) => {
    set((state) => ({
      mutedOpportunityCategories: state.mutedOpportunityCategories.includes(catId)
        ? state.mutedOpportunityCategories
        : [...state.mutedOpportunityCategories, catId],
    }));
    scheduleSyncToSupabase();
  },

  unmuteOpportunityCategory: (catId: string) => {
    set((state) => ({
      mutedOpportunityCategories: state.mutedOpportunityCategories.filter(c => c !== catId),
    }));
    scheduleSyncToSupabase();
  },

  setSpendingTarget: (catId: string, input: { target: number; baselineMonthly: number }) => {
    const safe = Math.max(0, input.target);
    if (safe === 0) return;
    const period = `${get().selectedYear}-${get().selectedMonth}`;
    set((state) => ({
      spendingTargets: {
        ...state.spendingTargets,
        [catId]: {
          target: safe,
          baselineMonthly: Math.max(0, input.baselineMonthly),
          createdAt: new Date().toISOString(),
          createdForPeriod: period,
        },
      },
      // Mirror into category budgets so existing alerts warn on approach/exceed
      categoryBudgets: { ...state.categoryBudgets, [catId]: safe },
    }));
    scheduleSyncToSupabase();
  },

  removeSpendingTarget: (catId: string, alsoRemoveBudget: boolean) => {
    set((state) => {
      const spendingTargets = { ...state.spendingTargets };
      delete spendingTargets[catId];
      const categoryBudgets = { ...state.categoryBudgets };
      if (alsoRemoveBudget) delete categoryBudgets[catId];
      return { spendingTargets, categoryBudgets };
    });
    scheduleSyncToSupabase();
  },

  // ── Annual opening balance ────────────────────────────────────────────────
  setOpeningBalance: (input: { startYear: number; amount: number; effectiveDate: string }) => {
    // second line of defence — the modal already runs the same validation
    if (Object.keys(validateBaseline(input, get().financialCycleStart)).length > 0) return;
    const now = new Date().toISOString();
    set(state => ({
      openingBalance: {
        startYear: input.startYear,
        amount: input.amount,
        effectiveDate: input.effectiveDate,
        createdAt: state.openingBalance?.createdAt ?? now,
        updatedAt: now,
      },
    }));
    scheduleSyncToSupabase();
  },

  clearOpeningBalance: () => {
    set({ openingBalance: null });
    scheduleSyncToSupabase();
  },

  // Theme: stored locally (instant on next boot) and synced via settings
  setThemePreference: (p: ThemePreference) => {
    if (!isValidTheme(p)) return;
    set({ themePreference: p });
    setStoredTheme(p);
    applyTheme(resolveTheme(p, prefersDarkNow()));
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
