'use client';

import { TrendingUp, TrendingDown, Target, Wallet, Activity, PiggyBank } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { getCategoryBudget } from '@/types';
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
  const { categories, getMonthlyTotal, getMonthlyIncome, selectedMonth, selectedYear, selectedCity, expenses } =
    useBudgetStore();
  void selectedCity; // subscribe to city changes so component re-renders

  const monthlyExpenses = getMonthlyTotal(selectedMonth, selectedYear);
  const monthlyIncome = getMonthlyIncome(selectedMonth, selectedYear);
  const budgetTotal = categories.reduce((sum, cat) => sum + getCategoryBudget(cat, selectedMonth, selectedYear), 0);

  // Combined across both cities for shared metrics
  const allCitiesExpenses = expenses
    .filter(e => e.month === selectedMonth && e.year === selectedYear)
    .reduce((sum, e) => sum + e.amount, 0);

  const netBalance = monthlyIncome - allCitiesExpenses;
  const remaining = budgetTotal - allCitiesExpenses;

  const savings = monthlyIncome - allCitiesExpenses;
  const savingsRate = monthlyIncome > 0 ? (savings / monthlyIncome) * 100 : 0;
  const savingsPositive = savings >= 0;

  return (
    <div className="space-y-4">
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
        subtext={`${useBudgetStore.getState().selectedCity} this month`}
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

      {/* Monthly Savings Section */}
      <div className="dark-card p-5" style={{ borderTop: `3px solid ${savingsPositive ? '#059669' : '#dc2626'}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg p-1.5" style={{ background: savingsPositive ? '#ecfdf5' : '#fef2f2' }}>
              <PiggyBank size={16} color={savingsPositive ? '#059669' : '#dc2626'} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Monthly Savings</p>
              <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Income minus total spending</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold num-mono" style={{ color: savingsPositive ? '#059669' : '#dc2626' }}>
              {savingsPositive ? '+' : ''}₹{savings.toFixed(2)}
            </p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: savingsPositive ? '#059669' : '#dc2626' }}>
              {savingsRate.toFixed(1)}% savings rate
            </p>
          </div>
        </div>
        <div className="mt-2">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: '#94a3b8' }}>
            <span>₹0</span>
            <span>Income: ₹{monthlyIncome.toFixed(2)}</span>
          </div>
          <div className="w-full rounded-full h-2.5" style={{ background: '#f1f5f9' }}>
            <div
              className="h-2.5 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(0, savingsRate))}%`,
                background: savingsPositive
                  ? 'linear-gradient(90deg, #34d399, #059669)'
                  : 'linear-gradient(90deg, #fb7185, #dc2626)',
              }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1.5" style={{ color: '#94a3b8' }}>
            <span>Spent: ₹{allCitiesExpenses.toFixed(2)}</span>
            <span>Saved: ₹{Math.max(0, savings).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

