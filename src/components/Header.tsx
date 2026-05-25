'use client';

import { useState, useRef, useEffect } from 'react';
import { TrendingUp, ChevronDown, MapPin, LogOut, DollarSign, WifiOff } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { useAuth } from '@/components/AuthProvider';
import { currencies } from '@/utils/currency';

export default function Header() {
  const { selectedMonth, selectedYear, setSelectedYear, selectedCity, setSelectedCity, currency, setCurrency, networkError } = useBudgetStore();
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
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
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setYearOpen(false);
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) setCurrencyOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthName = monthNames[parseInt(selectedMonth) - 1];
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <header style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(232,236,240,0.9)', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}>
      {(!isOnline || networkError) && (
        <div className="flex items-center justify-center gap-2 py-2 text-xs font-medium"
          style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', color: '#92400e' }}>
          <WifiOff size={13} />
          {!isOnline ? 'Offline â€” changes saved locally, will sync on reconnect.' : 'Sync error â€” retryingâ€¦'}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-4" style={{ height: 60 }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="flex items-center justify-center rounded-xl"
            style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
            <TrendingUp size={17} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight" style={{ color: '#111827' }}>Spendwise</span>
            {displayName && (
              <span className="text-sm font-normal" style={{ color: '#9ca3af' }}> Â· {displayName}</span>
            )}
          </div>
        </div>

        {/* Period */}
        <div className="hidden md:flex flex-col items-center select-none">
          <span className="text-xs" style={{ color: '#9ca3af' }}>Viewing period</span>
          <span className="text-sm font-bold" style={{ color: '#111827' }}>{monthName} {selectedYear}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {user?.email === 'darren412@gmail.com' && (
            <div className="hidden sm:flex items-center gap-0.5 p-1 rounded-lg"
              style={{ background: '#f4f6f9', border: '1px solid #e8ecf0' }}>
              <MapPin size={12} style={{ color: '#9ca3af', marginLeft: 4, marginRight: 2 }} />
              {cities.map(city => (
                <button key={city} onClick={() => setSelectedCity(city)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
                  style={{ background: selectedCity === city ? '#4f46e5' : 'transparent', color: selectedCity === city ? '#fff' : '#6b7280' }}>
                  {city}
                </button>
              ))}
            </div>
          )}

          <div className="relative" ref={currencyRef}>
            <button onClick={() => setCurrencyOpen(!currencyOpen)}
              className="flex items-center gap-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ padding: '7px 12px', background: '#f4f6f9', border: '1px solid #e8ecf0', color: '#374151' }}>
              <DollarSign size={12} style={{ color: '#9ca3af' }} />
              {currencies.find(c => c.code === currency)?.label ?? 'INR'}
              <ChevronDown size={11} style={{ color: '#9ca3af' }} className={`transition-transform ${currencyOpen ? 'rotate-180' : ''}`} />
            </button>
            {currencyOpen && (
              <div className="absolute top-full right-0 mt-1.5 rounded-xl z-50 overflow-hidden"
                style={{ background: '#fff', border: '1px solid #e8ecf0', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 120 }}>
                {currencies.map(c => (
                  <button key={c.code} onClick={() => { setCurrency(c.code); setCurrencyOpen(false); }}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold transition-colors"
                    style={{ color: c.code === currency ? '#4f46e5' : '#374151', background: c.code === currency ? '#eef2ff' : 'transparent' }}>
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setYearOpen(!yearOpen)}
              className="flex items-center gap-1.5 rounded-lg text-sm font-semibold transition-all"
              style={{ padding: '7px 12px', background: '#f4f6f9', border: '1px solid #e8ecf0', color: '#374151' }}>
              {selectedYear}
              <ChevronDown size={13} style={{ color: '#9ca3af' }} className={`transition-transform ${yearOpen ? 'rotate-180' : ''}`} />
            </button>
            {yearOpen && (
              <div className="absolute top-full right-0 mt-1.5 rounded-xl z-50 overflow-hidden"
                style={{ background: '#fff', border: '1px solid #e8ecf0', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 110 }}>
                {yearOptions.map(yr => (
                  <button key={yr} onClick={() => { setSelectedYear(yr); setYearOpen(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors"
                    style={{ color: yr === selectedYear ? '#4f46e5' : '#374151', background: yr === selectedYear ? '#eef2ff' : 'transparent' }}>
                    {yr}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
              {initials}
            </div>
            <button onClick={signOut} title="Sign out"
              className="flex items-center gap-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ padding: '7px 12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444' }}>
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
