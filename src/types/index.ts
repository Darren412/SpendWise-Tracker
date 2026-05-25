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
  category?: string;   // optional — income category id
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  type?: 'expense' | 'income' | 'both';   // undefined treated as 'expense' for backward compat
}
