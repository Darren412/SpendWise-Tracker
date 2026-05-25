'use client';

import { BarChart2 } from 'lucide-react';
import DailySpendTracker from '@/components/DailySpendTracker';
import Charts from '@/components/Charts';

export default function AnalyticsWorkspace() {
  return (
    <div style={{ maxWidth: 1400 }}>

      {/* ── Header ── */}
      <div className="ws-header">
        <div>
          <h1 className="ws-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart2 size={20} style={{ color: 'var(--brand-600)' }} />
            Analytics
          </h1>
          <p className="ws-subtitle">Daily spend patterns · Category breakdown · Spending trends</p>
        </div>
      </div>

      {/* ── Daily Spend Tracker ── */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-muted)' }}>
          <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-900)' }}>Daily Spend Tracker</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-400)', marginTop: 2 }}>Day-by-day spending across your financial period</div>
        </div>
        <div style={{ padding: '4px 0' }}>
          <DailySpendTracker />
        </div>
      </div>

      {/* ── Category Charts ── */}
      <Charts />

    </div>
  );
}
