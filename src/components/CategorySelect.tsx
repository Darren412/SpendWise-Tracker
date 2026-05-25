'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Category } from '@/types';
import { Search, ChevronDown, Check } from 'lucide-react';

interface CategorySelectProps {
  /** Pre-filtered list of categories to show (parent handles type filtering) */
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

export default function CategorySelect({ categories, value, onChange, placeholder = 'Select category…' }: CategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = categories.find(c => c.id === value);

  const visible = search
    ? categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : categories;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-focus search on open
  useEffect(() => {
    if (isOpen) setTimeout(() => searchRef.current?.focus(), 60);
  }, [isOpen]);

  // Keyboard: Escape closes
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setIsOpen(false); setSearch(''); }
  }, []);

  return (
    <div className="relative" ref={containerRef} onKeyDown={handleKeyDown}>

      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center gap-2.5 text-sm text-left transition-all"
        style={{
          padding: '10px 12px',
          background: '#f8fafc',
          border: `1.5px solid ${isOpen ? '#4f46e5' : '#e8ecf0'}`,
          borderRadius: 10,
          color: '#111827',
          fontFamily: 'inherit',
          cursor: 'pointer',
          boxShadow: isOpen ? '0 0 0 3px rgba(79,70,229,0.08)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        {selected ? (
          <>
            <div style={{
              width: 26, height: 26, borderRadius: 7, flexShrink: 0,
              background: `${selected.color}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
            }}>
              {selected.icon}
            </div>
            <span style={{ flex: 1, fontWeight: 600, color: '#111827' }}>{selected.name}</span>
          </>
        ) : (
          <span style={{ flex: 1, color: '#9ca3af', fontWeight: 400 }}>{placeholder}</span>
        )}
        <ChevronDown
          size={14}
          style={{
            color: '#9ca3af', flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}
        />
      </button>

      {/* ── Dropdown panel ── */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 mt-1.5 z-50"
          style={{
            background: '#fff',
            border: '1px solid #e8ecf0',
            borderRadius: 14,
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}
        >
          {/* Search */}
          <div style={{ padding: '10px 10px 6px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search categories…"
                style={{
                  width: '100%', padding: '7px 10px 7px 28px', borderRadius: 8,
                  background: '#f4f6f9', border: '1px solid #e8ecf0', fontSize: 12,
                  color: '#111827', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Category list */}
          <div style={{ maxHeight: 230, overflowY: 'auto', padding: '4px 0' }}>
            {visible.length === 0 ? (
              <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', padding: '14px 0' }}>
                No categories found
              </p>
            ) : (
              visible.map(cat => {
                const isSelected = cat.id === value;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => { onChange(cat.id); setIsOpen(false); setSearch(''); }}
                    className="w-full flex items-center gap-2.5 text-left transition-colors"
                    style={{
                      padding: '8px 12px',
                      background: isSelected ? `${cat.color}12` : 'transparent',
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: `${cat.color}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                    }}>
                      {cat.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500, color: '#111827' }}>
                        {cat.name}
                      </p>
                    </div>
                    {isSelected && (
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Check size={10} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
