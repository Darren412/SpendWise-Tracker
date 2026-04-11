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
}

export interface MonthlyBudget {
  month: string;
  year: number;
  total: number;
  expenses: Expense[];
}
