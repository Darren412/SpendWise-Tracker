'use client';

import { useState, useRef, useEffect } from 'react';
import { BarChart3, ChevronDown, MapPin, LogOut, DollarSign } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { useAuth } from '@/components/AuthProvider';
import { currencies } from '@/utils/currency';

export default function Header() {
  const { selectedMonth, selectedYear, setSelectedYear, selectedCity, setSelectedCity, currency, setCurrency, syncing, networkError } = useBudgetStore();
    // Network status
    const [isOnline, setIsOnline] = useState(true);
    useEffect(() => {
      function updateStatus() {
        setIsOnline(navigator.onLine);
      }
      window.addEventListener('online', updateStatus);
      window.addEventListener('offline', updateStatus);
      updateStatus();
      return () => {
        window.removeEventListener('online', updateStatus);
        window.removeEventListener('offline', updateStatus);
      };
    }, []);
  const { user, signOut } = useAuth();
  const [yearOpen, setYearOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);
  const cities = ['Bangalore', 'Mangalore', 'Both'];

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setYearOpen(false);
      }
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) {
        setCurrencyOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthName = monthNames[parseInt(selectedMonth) - 1];

  const displayName = user?.user_metadata?.full_name
    || user?.email?.split('@')[0]
    || '';

  return (
    <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
      {/* Network status warning */}
      {(!isOnline || networkError) && (
        <div className="w-full text-center py-2 bg-yellow-100 text-yellow-800 text-xs font-semibold border-b border-yellow-300">
          { !isOnline ? 'You are offline. Changes will be saved locally and synced when back online.' : 'Network error: Could not sync with server. Retrying...' }
        </div>
      )}
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">

        {/* Left — Logo + Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: '#6366f1' }}>
            <BarChart3 size={18} color="#fff" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight" style={{ color: '#0f172a', lineHeight: 1.2 }}>
              {displayName ? `${displayName}'s Spendwise` : 'Spendwise'}
            </h1>
            <p className="text-xs font-medium" style={{ color: '#94a3b8' }}>
              Personal Finance Dashboard
            </p>
          </div>
        </div>

        {/* Right — City selector + Month + Year picker */}
        <div className="flex items-center gap-3">

          {/* City Toggle — only for darren412 */}
          {user?.email === 'darren412@gmail.com' && (
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
            <MapPin size={13} style={{ color: '#64748b', marginLeft: 4 }} />
            {cities.map(city => (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                style={{
                  background: selectedCity === city ? '#6366f1' : 'transparent',
                  color: selectedCity === city ? '#fff' : '#64748b',
                }}
              >
                {city}
              </button>
            ))}
          </div>
          )}

          {/* Currency Selector */}
          <div className="relative" ref={currencyRef}>
            <button
              onClick={() => setCurrencyOpen(!currencyOpen)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-all"
              style={{
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: '#1e293b',
              }}
            >
              <DollarSign size={13} style={{ color: '#64748b' }} />
              {currencies.find(c => c.code === currency)?.label ?? 'INR'}
              <ChevronDown size={12} style={{ color: '#64748b' }} className={`transition-transform duration-200 ${currencyOpen ? 'rotate-180' : ''}`} />
            </button>

            {currencyOpen && (
              <div
                className="absolute top-full right-0 mt-1.5 rounded-xl z-50 overflow-hidden"
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.10)', minWidth: '120px' }}
              >
                {currencies.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => { setCurrency(c.code); setCurrencyOpen(false); }}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold transition-colors"
                    style={{
                      color: c.code === currency ? '#6366f1' : '#334155',
                      background: c.code === currency ? '#eef2ff' : 'transparent',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#94a3b8' }}>
              Viewing
            </p>
            <p className="text-sm font-bold" style={{ color: '#1e293b' }}>
              {monthName} {selectedYear}
            </p>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setYearOpen(!yearOpen)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm transition-all"
              style={{
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                color: '#1e293b',
              }}
            >
              {selectedYear}
              <ChevronDown size={14} style={{ color: '#64748b' }} className={`transition-transform duration-200 ${yearOpen ? 'rotate-180' : ''}`} />
            </button>

            {yearOpen && (
              <div
                className="absolute top-full right-0 mt-1.5 rounded-xl z-50 overflow-hidden"
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.10)', minWidth: '110px' }}
              >
                {yearOptions.map((yr) => (
                  <button
                    key={yr}
                    onClick={() => { setSelectedYear(yr); setYearOpen(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors"
                    style={{
                      color: yr === selectedYear ? '#6366f1' : '#334155',
                      background: yr === selectedYear ? '#eef2ff' : 'transparent',
                    }}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sign Out */}
          <button
            onClick={signOut}
            title={user?.email ?? 'Sign out'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
            }}
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}

