'use client';

import { useBudgetStore } from '@/store/budgetStore';
import { useAuth } from '@/components/AuthProvider';
import { currencies } from '@/utils/currency';
import { formatFinancialPeriodRange } from '@/utils/financialCycle';
import CategoryFilterBar from '@/components/CategoryFilterBar';
import FinancialCycleSettings from '@/components/FinancialCycleSettings';
import { Settings, User, DollarSign, Calendar, MapPin, Tag, LogOut } from 'lucide-react';

export default function SettingsWorkspace() {
  const {
    currency, setCurrency,
    financialCycleStart,
    selectedMonth, selectedYear,
    selectedCity, setSelectedCity,
    setExcludedCategoryIds,
  } = useBudgetStore();
  const { user, signOut } = useAuth();

  const isDarren   = user?.email === 'darren412@gmail.com';
  const periodRange = formatFinancialPeriodRange(selectedMonth, selectedYear, financialCycleStart);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div style={{ maxWidth: 900 }}>

      {/* ── Header ── */}
      <div className="ws-header">
        <div>
          <h1 className="ws-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings size={20} style={{ color: 'var(--brand-600)' }} />
            Settings
          </h1>
          <p className="ws-subtitle">Workspace preferences · Financial cycle · Categories · Display</p>
        </div>
      </div>

      <div className="settings-grid">

        {/* ── Account ── */}
        <div className="settings-card">
          <div className="settings-card-title">
            <User size={16} style={{ color: 'var(--brand-600)' }} />
            Account
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-400)', marginBottom: 14 }}>Your profile and authentication</p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px', background: 'var(--bg-muted)', borderRadius: 'var(--r-lg)', marginBottom: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--brand-500), var(--purple-600))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
              boxShadow: 'var(--shadow-brand)',
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-900)' }}>{displayName}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-400)' }}>{user?.email}</div>
            </div>
          </div>

          <button
            onClick={() => signOut()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 14px',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--red-100)',
              background: 'var(--red-50)',
              color: 'var(--red-600)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--red-100)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--red-50)')}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>

        {/* ── Currency ── */}
        <div className="settings-card">
          <div className="settings-card-title">
            <DollarSign size={16} style={{ color: 'var(--green-600)' }} />
            Currency
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-400)', marginBottom: 12 }}>Select your display currency for all amounts</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {currencies.map(c => (
              <button
                key={c.code}
                onClick={() => setCurrency(c.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: 'var(--r-md)',
                  cursor: 'pointer',
                  border: c.code === currency ? '1.5px solid var(--brand-300)' : '1px solid transparent',
                  background: c.code === currency ? 'var(--brand-50)' : 'var(--bg-subtle)',
                  color: c.code === currency ? 'var(--brand-700)' : 'var(--text-700)',
                  fontWeight: c.code === currency ? 700 : 400,
                  fontFamily: 'inherit',
                  fontSize: '0.8125rem',
                  transition: 'all 0.15s',
                }}
              >
                <span>{c.label}</span>
                {c.code === currency && (
                  <span style={{ fontSize: '0.65rem', background: 'var(--brand-600)', color: '#fff', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Financial Cycle ── */}
        <div className="settings-card" style={{ gridColumn: 'span 2' }}>
          <div className="settings-card-title">
            <Calendar size={16} style={{ color: 'var(--amber-600)' }} />
            Financial Cycle
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-400)', marginBottom: 4 }}>
            Cycle starts on the {financialCycleStart}{financialCycleStart === 1 ? 'st' : financialCycleStart === 2 ? 'nd' : financialCycleStart === 3 ? 'rd' : 'th'} of each month
          </p>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-300)', marginBottom: 14 }}>Current period: {periodRange}</p>
          <FinancialCycleSettings />
        </div>

        {/* ── Location Filter (Darren only) ── */}
        {isDarren && (
          <div className="settings-card">
            <div className="settings-card-title">
              <MapPin size={16} style={{ color: 'var(--purple-600)' }} />
              Location Filter
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-400)', marginBottom: 12 }}>Filter transactions by city</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Bangalore', 'Mangalore', 'Both'].map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedCity(c)}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: 'var(--r-md)',
                    border: c === selectedCity ? '1.5px solid var(--brand-300)' : '1px solid var(--border-default)',
                    cursor: 'pointer',
                    background: c === selectedCity ? 'var(--brand-600)' : 'var(--bg-subtle)',
                    color: c === selectedCity ? '#fff' : 'var(--text-700)',
                    fontWeight: c === selectedCity ? 700 : 500,
                    fontSize: '0.8125rem',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Category Filter ── */}
        <div className="settings-card">
          <div className="settings-card-title">
            <Tag size={16} style={{ color: 'var(--cyan-500)' }} />
            Category Filter
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-400)', marginBottom: 12 }}>Filter which categories appear in analytics</p>
          <CategoryFilterBar />
          <button
            onClick={() => setExcludedCategoryIds([])}
            style={{
              marginTop: 10,
              width: '100%',
              padding: '9px 0',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-subtle)',
              color: 'var(--text-700)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 500,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
          >
            Reset all filters
          </button>
        </div>

      </div>
    </div>
  );
}
