'use client';

import { useEffect, useState, lazy, Suspense } from 'react';
import LeftPane from '@/components/LeftPane';
import TopToolbar from '@/components/TopToolbar';
import AddTransactionModal from '@/components/AddTransactionModal';
import LoginPage from '@/components/LoginPage';
import { useBudgetStore } from '@/store/budgetStore';
import { useAuth } from '@/components/AuthProvider';
import { Loader2, WifiOff } from 'lucide-react';

const OverviewWorkspace     = lazy(() => import('@/workspaces/OverviewWorkspace'));
const AnalyticsWorkspace    = lazy(() => import('@/workspaces/AnalyticsWorkspace'));
const TransactionsWorkspace = lazy(() => import('@/workspaces/TransactionsWorkspace'));
const InsightsWorkspace     = lazy(() => import('@/workspaces/InsightsWorkspace'));
const ReportsWorkspace      = lazy(() => import('@/workspaces/ReportsWorkspace'));
const SettingsWorkspace     = lazy(() => import('@/workspaces/SettingsWorkspace'));

type Workspace = 'overview' | 'analytics' | 'transactions' | 'insights' | 'reports' | 'settings';

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
      <div className="stagger-fade" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
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

  useEffect(() => {
    if (user) { setUserId(user.id); loadFromLocalStorage(); }
  }, [user, loadFromLocalStorage, setUserId]);

  const handleWorkspaceChange = (id: string) => {
    setActiveWorkspace(id as Workspace);
  };

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
                {activeWorkspace === 'transactions' && <TransactionsWorkspace onAddExpense={() => setAddModal({ open: true, tab: 'expense' })} onAddIncome={() => setAddModal({ open: true, tab: 'income' })} />}
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
    </>
  );
}
