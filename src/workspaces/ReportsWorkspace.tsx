'use client';

import { useState } from 'react';
import { FileSpreadsheet, Download, Calendar, MapPin, Tag, FileText } from 'lucide-react';
import YearlySummary from '@/components/YearlySummary';
import ExportModal from '@/components/ExportModal';

export default function ReportsWorkspace() {
  const [showExport, setShowExport] = useState(false);

  const exportCards = [
    {
      icon: <FileSpreadsheet size={22} />,
      iconBg: 'var(--green-50)',
      iconColor: 'var(--green-600)',
      label: 'Full Export',
      sub: 'All transactions to Excel',
      action: () => setShowExport(true),
    },
    {
      icon: <Calendar size={22} />,
      iconBg: 'var(--blue-50)',
      iconColor: 'var(--blue-600)',
      label: 'Cycle Report',
      sub: 'Current financial period',
      action: () => setShowExport(true),
    },
    {
      icon: <MapPin size={22} />,
      iconBg: 'var(--purple-50)',
      iconColor: 'var(--purple-600)',
      label: 'Location Report',
      sub: 'By city breakdown',
      action: () => setShowExport(true),
    },
    {
      icon: <Tag size={22} />,
      iconBg: 'var(--amber-50)',
      iconColor: 'var(--amber-600)',
      label: 'Category Report',
      sub: 'Spend by category',
      action: () => setShowExport(true),
    },
  ];

  return (
    <div style={{ maxWidth: 1400 }}>

      {/* ── Header ── */}
      <div className="ws-header">
        <div>
          <h1 className="ws-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--r-md)',
              background: 'var(--brand-50)', border: '1px solid var(--brand-100)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={16} style={{ color: 'var(--brand-600)' }} />
            </div>
            Reports
          </h1>
          <p className="ws-subtitle">Annual summaries · Data exports · Historical analytics</p>
        </div>
        <button onClick={() => setShowExport(true)} className="ws-cta-btn" style={{ background: 'var(--green-600)', color: '#fff', borderColor: 'var(--green-700)', boxShadow: 'var(--shadow-green)' }}>
          <Download size={13} /> Export to Excel
        </button>
      </div>

      {/* ── Export cards ── */}
      <div
        className="stagger-fade"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {exportCards.map(card => (
          <button
            key={card.label}
            onClick={card.action}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '16px 20px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--r-xl)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'box-shadow 0.2s, transform 0.15s, border-color 0.2s',
              fontFamily: 'inherit',
              boxShadow: 'var(--shadow-xs)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-md)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-xs)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'none';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)';
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--r-lg)',
                background: card.iconBg,
                color: card.iconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-900)', marginBottom: 2 }}>{card.label}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-400)' }}>{card.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Annual summary ── */}
      <YearlySummary />

      <ExportModal isOpen={showExport} onClose={() => setShowExport(false)} />
    </div>
  );
}
