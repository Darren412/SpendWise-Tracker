export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  month: string;
  year: number;
  city?: string;
}

export interface Income {
  id: string;
  source: string;
  amount: number;
  date: string;
  month: string;
  year: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  budget: number;
  monthlyBudgets?: Record<string, number>; // key: "YYYY-MM", e.g. "2026-04"
}

export function getCategoryBudget(cat: Category, month: string, year: number): number {
  const key = `${year}-${month}`;
  return cat.monthlyBudgets?.[key] ?? cat.budget;
}

export interface MonthlyBudget {
  month: string;
  year: number;
  total: number;
  expenses: Expense[];
}
