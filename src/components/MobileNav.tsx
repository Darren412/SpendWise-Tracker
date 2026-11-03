'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard, ArrowUpDown, LineChart, Target,
  BarChart2, Sparkles, FileBarChart, Settings,
  MoreHorizontal, LogOut, X,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

const TABS = [
  { id: 'overview',     label: 'Overview',     Icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', Icon: ArrowUpDown },
  { id: 'trends',       label: 'Trends',       Icon: LineChart },
  { id: 'planning',     label: 'Planning',     Icon: Target },
];

const MORE_ITEMS = [
  { id: 'analytics',    label: 'Analytics',    Icon: BarChart2 },
  { id: 'insights',     label: 'AI Insights',  Icon: Sparkles },
  { id: 'reports',      label: 'Reports',      Icon: FileBarChart },
  { id: 'settings',     label: 'Settings',     Icon: Settings },
];

interface MobileNavProps {
  activeWorkspace?: string;
  onWorkspaceChange?: (id: string) => void;
}

export default function MobileNav({ activeWorkspace = 'overview', onWorkspaceChange }: MobileNavProps) {
  const { signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  const moreActive = MORE_ITEMS.some(i => i.id === activeWorkspace);

  useEffect(() => {
    if (!moreOpen) return;
    lastFocused.current = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;
    const focusables = () =>
      Array.from(sheet?.querySelectorAll<HTMLElement>('button') ?? []);
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMoreOpen(false); return; }
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      lastFocused.current?.focus();
    };
  }, [moreOpen]);

  const go = (id: string) => {
    setMoreOpen(false);
    onWorkspaceChange?.(id);
  };

  return (
    <>
      {moreOpen && (
        <div className="sw-more-backdrop" onClick={() => setMoreOpen(false)}>
          <div
            ref={sheetRef}
            className="sw-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More workspaces"
            onClick={e => e.stopPropagation()}
          >
            <div className="sw-more-sheet-handle" aria-hidden />
            <div className="sw-more-sheet-title">
              <span>More</span>
              <button className="sw-more-close" onClick={() => setMoreOpen(false)} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            {MORE_ITEMS.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={`sw-more-item${activeWorkspace === id ? ' active' : ''}`}
                onClick={() => go(id)}
                aria-current={activeWorkspace === id ? 'page' : undefined}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
            <button className="sw-more-item sw-more-signout" onClick={() => signOut()}>
              <LogOut size={18} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}

      <nav className="sw-mobile-nav" role="navigation" aria-label="Mobile navigation">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`sw-mobile-tab${activeWorkspace === id ? ' active' : ''}`}
            onClick={() => go(id)}
            aria-label={label}
            aria-current={activeWorkspace === id ? 'page' : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
        <button
          className={`sw-mobile-tab${moreActive || moreOpen ? ' active' : ''}`}
          onClick={() => setMoreOpen(v => !v)}
          aria-label="More workspaces"
          aria-expanded={moreOpen}
        >
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
