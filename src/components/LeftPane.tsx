'use client';

import { useState } from 'react';
import {
  TrendingUp, LayoutDashboard, BarChart2,
  ArrowUpDown, FileBarChart, Settings,
  ChevronLeft, ChevronRight, LogOut, Sparkles,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

const NAV_ITEMS = [
  {
    section: 'Main',
    items: [
      { id: 'overview',     label: 'Overview',      Icon: LayoutDashboard, desc: 'Dashboard summary' },
      { id: 'analytics',    label: 'Analytics',     Icon: BarChart2,       desc: 'Charts & trends' },
      { id: 'transactions', label: 'Transactions',  Icon: ArrowUpDown,     desc: 'All transactions' },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      { id: 'insights', label: 'AI Insights',  Icon: Sparkles,     desc: 'Smart analysis' },
      { id: 'reports',  label: 'Reports',      Icon: FileBarChart, desc: 'Export & summaries' },
    ],
  },
  {
    section: 'Account',
    items: [
      { id: 'settings', label: 'Settings', Icon: Settings, desc: 'Preferences' },
    ],
  },
] as const;

type WorkspaceId = 'overview' | 'analytics' | 'transactions' | 'insights' | 'reports' | 'settings';

interface LeftPaneProps {
  activeWorkspace?: string;
  onWorkspaceChange?: (id: string) => void;
}

export default function LeftPane({ activeWorkspace = 'overview', onWorkspaceChange }: LeftPaneProps) {
  const { user, signOut } = useAuth();
  const [expanded, setExpanded] = useState(true);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside
      className="sw-rail"
      style={{
        width: expanded ? 240 : 68,
        minWidth: expanded ? 240 : 68,
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* ── Logo ── */}
      <div className="sw-rail-top" style={{ gap: 10, padding: '18px 14px' }}>
        <div className="sw-rail-logo" style={{ flex: 1, overflow: 'hidden' }}>
          <div className="sw-rail-logo-icon">
            <TrendingUp size={15} color="#fff" strokeWidth={2.5} />
          </div>
          <span
            className="sw-rail-logo-text"
            style={{
              opacity: expanded ? 1 : 0,
              width: expanded ? 'auto' : 0,
              overflow: 'hidden',
              transition: 'opacity 0.2s, width 0.25s',
              whiteSpace: 'nowrap',
            }}
          >
            Spendwise
          </span>
        </div>
        <button
          className="sw-rail-toggle"
          onClick={() => setExpanded(v => !v)}
          title={expanded ? 'Collapse' : 'Expand'}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          style={{ flexShrink: 0 }}
        >
          {expanded ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
        </button>
      </div>

      {/* ── Nav sections ── */}
      <nav className="sw-rail-nav" role="navigation" aria-label="Main navigation">
        {NAV_ITEMS.map(({ section, items }) => (
          <div key={section}>
            {/* Section label */}
            {expanded && (
              <div
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--text-400)',
                  padding: '10px 10px 4px',
                  whiteSpace: 'nowrap',
                }}
              >
                {section}
              </div>
            )}
            {!expanded && section !== 'Main' && (
              <div style={{ height: 8 }} />
            )}

            {items.map(({ id, label, Icon }) => {
              const isActive = activeWorkspace === id;
              return (
                <button
                  key={id}
                  className={`sw-nav-item${isActive ? ' active' : ''}`}
                  onClick={() => onWorkspaceChange?.(id as WorkspaceId)}
                  title={!expanded ? label : undefined}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    size={17}
                    className="sw-nav-item-icon"
                    style={{ flexShrink: 0 }}
                  />
                  <span
                    className="sw-nav-item-label"
                    style={{
                      opacity: expanded ? 1 : 0,
                      width: expanded ? 'auto' : 0,
                      overflow: 'hidden',
                      transition: 'opacity 0.15s, width 0.25s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Footer: user + sign out ── */}
      <div className="sw-rail-bottom">

        {/* User row */}
        <div
          className="sw-nav-item"
          style={{ cursor: 'default', gap: 10 }}
          title={expanded ? undefined : `${displayName} · ${user?.email}`}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.6rem',
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
            }}
          >
            {initials}
          </div>
          <div
            style={{
              flex: 1,
              overflow: 'hidden',
              opacity: expanded ? 1 : 0,
              width: expanded ? 'auto' : 0,
              transition: 'opacity 0.15s, width 0.25s',
            }}
          >
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-800)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: '0.675rem',
                color: 'var(--text-400)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.email}
            </div>
          </div>
        </div>

        {/* Sign out */}
        <button
          className="sw-nav-item"
          onClick={() => signOut()}
          title={expanded ? undefined : 'Sign out'}
          aria-label="Sign out"
          style={{ color: 'var(--red-500)' }}
        >
          <LogOut
            size={16}
            className="sw-nav-item-icon"
            style={{ flexShrink: 0, color: 'var(--red-400)' }}
          />
          <span
            className="sw-nav-item-label"
            style={{
              opacity: expanded ? 1 : 0,
              width: expanded ? 'auto' : 0,
              overflow: 'hidden',
              transition: 'opacity 0.15s, width 0.25s',
              whiteSpace: 'nowrap',
              color: 'var(--red-500)',
              fontWeight: 500,
              fontSize: '0.875rem',
            }}
          >
            Sign out
          </span>
        </button>
      </div>
    </aside>
  );
}
