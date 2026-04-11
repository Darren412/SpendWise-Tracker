'use client';

import { useState, useRef, useEffect } from 'react';
import { BarChart3, ChevronDown, MapPin } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';

export default function Header() {
  const { selectedMonth, selectedYear, setSelectedYear, selectedCity, setSelectedCity } = useBudgetStore();
  const [yearOpen, setYearOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const cities = ['Bangalore', 'Mangalore', 'Both'];

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setYearOpen(false);
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

  return (
    <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">

        {/* Left — Logo + Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: '#6366f1' }}>
            <BarChart3 size={18} color="#fff" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight" style={{ color: '#0f172a', lineHeight: 1.2 }}>
              Budget Tracker
            </h1>
            <p className="text-xs font-medium" style={{ color: '#94a3b8' }}>
              Personal Finance Dashboard
            </p>
          </div>
        </div>

        {/* Right — City selector + Month + Year picker */}
        <div className="flex items-center gap-3">

          {/* City Toggle */}
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
        </div>
      </div>
    </header>
  );
}

