'use client';

import { TrendingUp, TrendingDown, Target, Wallet, Activity } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  subtext: string;
  accentColor: string;
  bgColor: string;
  icon: ReactNode;
}

function StatCard({ label, value, subtext, accentColor, bgColor, icon }: StatCardProps) {
  return (
    <div className="dark-card p-5" style={{ borderTop: `3px solid ${accentColor}` }}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
          {label}
        </p>
        <div className="rounded-lg p-1.5" style={{ background: bgColor }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold num-mono mb-1" style={{ color: '#0f172a' }}>
        ₹{value}
      </p>
      <p className="text-xs font-medium" style={{ color: '#94a3b8' }}>
        {subtext}
      </p>
    </div>
  );
}

export default function CategoryStats() {
  const { categories, getMonthlyTotal, getMonthlyIncome, selectedMonth, selectedYear } =
    useBudgetStore();

  const monthlyExpenses = getMonthlyTotal(selectedMonth, selectedYear);
  const monthlyIncome = getMonthlyIncome(selectedMonth, selectedYear);
  const budgetTotal = categories.reduce((sum, cat) => sum + cat.budget, 0);
  const netBalance = monthlyIncome - monthlyExpenses;
  const remaining = budgetTotal - monthlyExpenses;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <StatCard
        label="Total Income"
        value={monthlyIncome.toFixed(2)}
        subtext="This month"
        accentColor="#059669"
        bgColor="#ecfdf5"
        icon={<TrendingUp size={15} color="#059669" />}
      />
      <StatCard
        label="Total Spent"
        value={monthlyExpenses.toFixed(2)}
        subtext="This month"
        accentColor="#dc2626"
        bgColor="#fef2f2"
        icon={<TrendingDown size={15} color="#dc2626" />}
      />
      <StatCard
        label="Total Budget"
        value={budgetTotal.toFixed(2)}
        subtext="All categories"
        accentColor="#0891b2"
        bgColor="#ecfeff"
        icon={<Target size={15} color="#0891b2" />}
      />
      <StatCard
        label="Remaining"
        value={remaining.toFixed(2)}
        subtext={remaining >= 0 ? 'To spend' : 'Over budget'}
        accentColor={remaining >= 0 ? '#6366f1' : '#dc2626'}
        bgColor={remaining >= 0 ? '#eef2ff' : '#fef2f2'}
        icon={<Wallet size={15} color={remaining >= 0 ? '#6366f1' : '#dc2626'} />}
      />
      <StatCard
        label="Net Balance"
        value={netBalance.toFixed(2)}
        subtext={netBalance >= 0 ? 'Surplus' : 'Deficit'}
        accentColor={netBalance >= 0 ? '#d97706' : '#dc2626'}
        bgColor={netBalance >= 0 ? '#fffbeb' : '#fef2f2'}
        icon={<Activity size={15} color={netBalance >= 0 ? '#d97706' : '#dc2626'} />}
      />
    </div>
  );
}

