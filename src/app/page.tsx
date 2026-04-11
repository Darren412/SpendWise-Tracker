'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import MonthYearFilter from '@/components/MonthYearFilter';
import ExpenseForm from '@/components/ExpenseForm';
import IncomeForm from '@/components/IncomeForm';
import ExpenseList from '@/components/ExpenseList';
import IncomeList from '@/components/IncomeList';
import CategoryStats from '@/components/CategoryStats';
import Charts from '@/components/Charts';
import BudgetEditor from '@/components/BudgetEditor';
import YearlySummary from '@/components/YearlySummary';
import AllExpensesModal from '@/components/AllExpensesModal';
import ExportModal from '@/components/ExportModal';
import { useBudgetStore } from '@/store/budgetStore';

export default function Home() {
  const { loadFromLocalStorage } = useBudgetStore();
  const [showAllExpensesModal, setShowAllExpensesModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  return (
    <main className="min-h-screen graffiti-bg">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Month/Year Filter */}
        <div className="mb-8">
          <MonthYearFilter />
        </div>

        {/* Stats Section */}
        <div className="mb-8">
          <CategoryStats />
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Left Column - Forms */}
          <div className="space-y-8">
            <ExpenseForm />
            <IncomeForm />
          </div>

          {/* Right Column - Charts */}
          <div className="lg:col-span-2 h-full">
            <Charts />
          </div>
        </div>

        {/* Budget Editor Section */}
        <div className="mb-8">
          <BudgetEditor />
        </div>

        {/* Yearly Summary */}
        <div className="mb-8">
          <YearlySummary />
        </div>

        {/* Lists Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ExpenseList />
          <IncomeList />
        </div>

        {/* View All Expenses + Export Buttons */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => setShowAllExpensesModal(true)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: '#dc2626',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(220,38,38,0.25)',
            }}
          >
            View All Expenses
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: '#059669',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(5,150,105,0.25)',
            }}
          >
            Export to Excel
          </button>
        </div>
      </div>

      {/* All Expenses Modal */}
      <AllExpensesModal
        isOpen={showAllExpensesModal}
        onClose={() => setShowAllExpensesModal(false)}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </main>
  );
}
