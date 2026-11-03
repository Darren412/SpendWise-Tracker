'use client';

import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import LeftPane from '@/components/LeftPane';
import MobileNav from '@/components/MobileNav';
import TopToolbar from '@/components/TopToolbar';
import AddTransactionModal from '@/components/AddTransactionModal';
import LoginPage from '@/components/LoginPage';
import Toast from '@/components/Toast';
import { useBudgetStore } from '@/store/budgetStore';
import { useAuth } from '@/components/AuthProvider';
import { useBudgetAlerts } from '@/hooks/useBudgetAlerts';
import { Loader2, WifiOff } from 'lucide-react';

const OverviewWorkspace     = lazy(() => import('@/workspaces/OverviewWorkspace'));
const AnalyticsWorkspace    = lazy(() => import('@/workspaces/AnalyticsWorkspace'));
const TrendsWorkspace       = lazy(() => import('@/workspaces/TrendsWorkspace'));
const PlanningWorkspace     = lazy(() => import('@/workspaces/PlanningWorkspace'));
const TransactionsWorkspace = lazy(() => import('@/workspaces/TransactionsWorkspace'));
const InsightsWorkspace     = lazy(() => import('@/workspaces/InsightsWorkspace'));
const ReportsWorkspace      = lazy(() => import('@/workspaces/ReportsWorkspace'));
const SettingsWorkspace     = lazy(() => import('@/workspaces/SettingsWorkspace'));

type Workspace = 'overview' | 'analytics' | 'trends' | 'planning' | 'transactions' | 'insights' | 'reports' | 'settings';

function WorkspaceSkeleton() {
  return (
    <div style={{ padding: '28px 28px', maxWidth: 1400 }}>
      {/* Header skeleton */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 12 }} />
          <div className="skeleton" style={{ width: 200, height: 28, borderRadius: 8 }} />
        </div>
        <div className="skeleton" style={{ width: 320, height: 14, borderRadius: 6 }} />
      </div>
      {/* KPI skeleton */}
      <div className="stagger-fade" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 110, borderRadius: 16 }} />
        ))}
      </div>
      {/* Panels skeleton */}
      <div className="stagger-fade" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 200, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { loadFromLocalStorage, setUserId, networkError } = useBudgetStore();
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>('overview');
  const [addModal, setAddModal] = useState<{ open: boolean; tab: 'expense' | 'income' }>({ open: false, tab: 'expense' });

  // Depend on the user id only — token refreshes hand us a new `user` object
  // for the same person and must not trigger a reload.
  const userId = user?.id;
  useEffect(() => {
    if (userId) { setUserId(userId); loadFromLocalStorage(); }
  }, [userId, loadFromLocalStorage, setUserId]);

  // Session expired or signed out in another tab — clear the previous user's data
  useEffect(() => {
    if (!authLoading && !userId && useBudgetStore.getState().userId) {
      useBudgetStore.getState().resetForLogout();
    }
  }, [authLoading, userId]);

  const [planningTab, setPlanningTab] = useState<'save' | 'reserve' | 'goals' | 'budgets' | undefined>(undefined);
  const [txnFunding, setTxnFunding] = useState<'budget' | 'reserve' | 'split' | undefined>(undefined);

  const handleWorkspaceChange = (id: string, subTab?: string) => {
    setPlanningTab(id === 'planning' ? (subTab as 'save' | 'reserve' | 'goals' | 'budgets' | undefined) : undefined);
    setTxnFunding(id === 'transactions'
      ? (['budget', 'reserve', 'split'].includes(subTab ?? '') ? (subTab as 'budget' | 'reserve' | 'split') : undefined)
      : undefined);
    setActiveWorkspace(id as Workspace);
  };

  // One-time budget-alert toast: fires for newly breached thresholds on any
  // workspace, then records the keys so reloads don't repeat it.
  const { newOnes } = useBudgetAlerts();
  const [alertToast, setAlertToast] = useState('');
  const toastedRef = useRef<Set<string>>(new Set());

  // Reserve shortfall notices from recurring generation — surfaced once via
  // toast, then cleared from the store.
  const reserveNotices = useBudgetStore(s => s.reserveNotices);
  const clearReserveNotices = useBudgetStore(s => s.clearReserveNotices);
  const [reserveToast, setReserveToast] = useState('');
  useEffect(() => {
    if (reserveNotices.length === 0) return;
    setReserveToast(reserveNotices.slice(0, 2).join(' ')
      + (reserveNotices.length > 2 ? ` …and ${reserveNotices.length - 2} more.` : ''));
    clearReserveNotices();
  }, [reserveNotices, clearReserveNotices]);
  useEffect(() => {
    const fresh = newOnes.filter(a => !toastedRef.current.has(a.key));
    if (fresh.length === 0) return;
    fresh.forEach(a => toastedRef.current.add(a.key));
    const first = fresh[0];
    const msg = fresh.length === 1
      ? `${first.name}: ${first.pct}% of ${first.isTarget ? 'target' : 'budget'} used`
      : `${fresh.length} budget alerts — ${first.name} at ${first.pct}% and ${fresh.length - 1} more`;
    setAlertToast(msg);
    useBudgetStore.getState().markAlertsNotified(fresh.map(a => a.key));
  }, [newOnes]);

  /* ── Auth loading ── */
  if (authLoading) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-canvas)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: 'linear-gradient(135deg, var(--brand-500), var(--purple-600))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-brand)',
          }}>
            <Loader2 size={22} color="#fff" className="animate-spin" />
          </div>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-400)' }}>
            Loading Spendwise…
          </p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <>
      <div className="sw-app-shell">

        {/* ── Fixed sidebar nav ── */}
        <LeftPane
          activeWorkspace={activeWorkspace}
          onWorkspaceChange={handleWorkspaceChange}
        />

        {/* ── Mobile bottom nav (<768px) ── */}
        <MobileNav
          activeWorkspace={activeWorkspace}
          onWorkspaceChange={handleWorkspaceChange}
        />

        {/* ── Main column: toolbar + viewport ── */}
        <div className="sw-workspace-container">

          {/* Sticky toolbar */}
          <TopToolbar
            onAddExpense={() => setAddModal({ open: true, tab: 'expense' })}
            onAddIncome={()  => setAddModal({ open: true, tab: 'income' })}
            onExport={() => handleWorkspaceChange('reports')}
          />

          {/* Network error banner */}
          {networkError && (
            <div className="sw-network-banner">
              <WifiOff size={13} />
              Sync issue — changes saved locally and will sync on reconnect.
            </div>
          )}

          {/* Workspace viewport */}
          <div className="sw-workspace-viewport">
            <div key={activeWorkspace} className="sw-workspace-fade">
              <Suspense fallback={<WorkspaceSkeleton />}>
                {activeWorkspace === 'overview'     && <OverviewWorkspace     onNavigate={handleWorkspaceChange} />}
                {activeWorkspace === 'analytics'    && <AnalyticsWorkspace    />}
                {activeWorkspace === 'trends'       && <TrendsWorkspace       />}
                {activeWorkspace === 'planning'     && <PlanningWorkspace     initialTab={planningTab} onNavigate={handleWorkspaceChange} />}
                {activeWorkspace === 'transactions' && <TransactionsWorkspace onAddExpense={() => setAddModal({ open: true, tab: 'expense' })} onAddIncome={() => setAddModal({ open: true, tab: 'income' })} initialFunding={txnFunding} />}
                {activeWorkspace === 'insights'     && <InsightsWorkspace     />}
                {activeWorkspace === 'reports'      && <ReportsWorkspace      />}
                {activeWorkspace === 'settings'     && <SettingsWorkspace     />}
              </Suspense>
            </div>
          </div>

        </div>
      </div>

      {/* ── Add transaction modal ── */}
      <AddTransactionModal
        open={addModal.open}
        defaultTab={addModal.tab}
        onClose={() => setAddModal(v => ({ ...v, open: false }))}
      />

      {/* Budget-alert toast (one-time per newly breached threshold) */}
      <Toast
        open={!!alertToast}
        message={alertToast}
        accent="var(--amber-500)"
        onClose={() => setAlertToast('')}
      />

      {/* Reserve shortfall toast (recurring occurrences capped to fit) */}
      <Toast
        open={!!reserveToast}
        message={reserveToast}
        accent="var(--amber-500)"
        onClose={() => setReserveToast('')}
      />
    </>
  );
}
