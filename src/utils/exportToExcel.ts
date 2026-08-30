import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Expense, Income, Category } from '@/types';
import { currencySymbol } from '@/utils/currency';

export type ExportFilter =
  | { scope: 'month'; month: string; year: number }
  | { scope: 'day'; date: string }
  | { scope: 'year'; year: number }
  | { scope: 'all' };

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function fmtDate(iso: string) {
  // Append T12:00:00 for date-only strings to prevent timezone shift
  const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCurrency(n: number, sym: string) {
  return `${sym}${n.toFixed(2)}`;
}

type AnyRow = Record<string, string | number>;

function buildExpenseSheet(filtered: Expense[], categories: Category[], label: string, sym: string) {
  const resolveName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  const rows: AnyRow[] = [
    { '': `Expenses — ${label}` },
    { '': '' },
    { 'No.': 'No.', Date: 'Date', Category: 'Category', Description: 'Description', [`Amount (${sym})`]: `Amount (${sym})` },
  ];

  if (filtered.length === 0) {
    rows.push({ 'No.': '', Date: '', Category: '', Description: 'No expenses recorded', [`Amount (${sym})`]: '' });
  } else {
    filtered.forEach((e, i) => {
      rows.push({
        'No.': i + 1,
        Date: fmtDate(e.date),
        Category: `${categories.find(c => c.id === e.category)?.icon ?? ''} ${resolveName(e.category)}`,
        Description: e.description,
        [`Amount (${sym})`]: e.amount,
      });
    });
    const total = filtered.reduce((s, e) => s + e.amount, 0);
    rows.push({ 'No.': '', Date: '', Category: '', Description: 'TOTAL', [`Amount (${sym})`]: total });
  }

  const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
  ws['!cols'] = [{ wch: 6 }, { wch: 16 }, { wch: 26 }, { wch: 36 }, { wch: 14 }];
  return ws;
}

function buildIncomeSheet(filtered: Income[], label: string, sym: string) {
  const rows: AnyRow[] = [
    { '': `Income — ${label}` },
    { '': '' },
    { 'No.': 'No.', Date: 'Date', Source: 'Source', [`Amount (${sym})`]: `Amount (${sym})` },
  ];

  if (filtered.length === 0) {
    rows.push({ 'No.': '', Date: '', Source: 'No income recorded', [`Amount (${sym})`]: '' });
  } else {
    filtered.forEach((i, idx) => {
      rows.push({
        'No.': idx + 1,
        Date: fmtDate(i.date),
        Source: i.source,
        [`Amount (${sym})`]: i.amount,
      });
    });
    const total = filtered.reduce((s, i) => s + i.amount, 0);
    rows.push({ 'No.': '', Date: '', Source: 'TOTAL', [`Amount (${sym})`]: total });
  }

  const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
  ws['!cols'] = [{ wch: 6 }, { wch: 16 }, { wch: 36 }, { wch: 14 }];
  return ws;
}

// Summary sheet for a single month
function buildMonthlySummary(
  filteredExpenses: Expense[],
  filteredIncome: Income[],
  categories: Category[],
  label: string,
  sym: string
) {
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const totalIncome   = filteredIncome.reduce((s, i) => s + i.amount, 0);
  const netBalance    = totalIncome - totalExpenses;

  const rows: AnyRow[] = [
    { Metric: `Summary — ${label}`, Value: '' },
    { Metric: '', Value: '' },
    { Metric: 'OVERVIEW', Value: '' },
    { Metric: 'Total Income',                  Value: fmtCurrency(totalIncome, sym) },
    { Metric: 'Total Spent',                   Value: fmtCurrency(totalExpenses, sym) },
    { Metric: 'Net Balance (Income − Spent)',   Value: fmtCurrency(netBalance, sym) },
    { Metric: '', Value: '' },
    { Metric: 'CATEGORY BREAKDOWN', Value: '' },
    { Metric: 'Category', Value: `Spent (${sym})`, Transactions: 'Transactions' },
  ];

  categories.filter(c => c.type !== 'income').forEach((cat) => {
    const spent = filteredExpenses.filter(e => e.category === cat.id).reduce((s, e) => s + e.amount, 0);
    const txCount = filteredExpenses.filter(e => e.category === cat.id).length;
    rows.push({
      Metric: `${cat.icon} ${cat.name}`,
      Value: spent,
      Transactions: txCount,
    });
  });

  // Totals row
  rows.push({
    Metric: 'TOTAL',
    Value: totalExpenses,
    Transactions: filteredExpenses.length,
  });

  const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
  ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 14 }];
  return ws;
}

// Summary sheet for a year — shows monthly breakdown
function buildYearlySummary(
  allExpenses: Expense[],
  allIncome: Income[],
  year: number,
  sym: string
) {
  const yearExp = allExpenses.filter(e => e.year === year);
  const yearInc = allIncome.filter(i => i.year === year);

  const rows: AnyRow[] = [
    { Month: `Yearly Summary — ${year}`, Income: '' },
    { Month: '', Income: '' },
    { Month: 'Month', Income: `Income (${sym})`, [`Expenses (${sym})`]: `Expenses (${sym})`, [`Net (${sym})`]: `Net (${sym})`, Transactions: 'Transactions' },
  ];

  let grandIncome = 0, grandExpenses = 0;
  for (let m = 1; m <= 12; m++) {
    const mo = String(m).padStart(2, '0');
    const mInc = yearInc.filter(i => i.month === mo).reduce((s, i) => s + i.amount, 0);
    const mExp = yearExp.filter(e => e.month === mo).reduce((s, e) => s + e.amount, 0);
    const mTx  = yearExp.filter(e => e.month === mo).length + yearInc.filter(i => i.month === mo).length;
    grandIncome += mInc; grandExpenses += mExp;
    rows.push({
      Month: MONTH_NAMES[m - 1],
      Income: mInc,
      [`Expenses (${sym})`]: mExp,
      [`Net (${sym})`]: mInc - mExp,
      Transactions: mTx,
    });
  }
  rows.push({ Month: 'TOTAL', Income: grandIncome, [`Expenses (${sym})`]: grandExpenses, [`Net (${sym})`]: grandIncome - grandExpenses, Transactions: '' });

  const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
  ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  return ws;
}

// Summary sheet for all data — shows yearly breakdown
function buildAllDataSummary(allExpenses: Expense[], allIncome: Income[], sym: string) {
  const years = [...new Set([...allExpenses.map(e => e.year), ...allIncome.map(i => i.year)])].sort((a, b) => a - b);

  const rows: AnyRow[] = [
    { Year: 'All Data Summary', Income: '' },
    { Year: '', Income: '' },
    { Year: 'Year', Income: `Income (${sym})`, [`Expenses (${sym})`]: `Expenses (${sym})`, [`Net (${sym})`]: `Net (${sym})`, Transactions: 'Transactions' },
  ];

  let grandIncome = 0, grandExpenses = 0;
  for (const yr of years) {
    const yInc = allIncome.filter(i => i.year === yr).reduce((s, i) => s + i.amount, 0);
    const yExp = allExpenses.filter(e => e.year === yr).reduce((s, e) => s + e.amount, 0);
    const yTx  = allExpenses.filter(e => e.year === yr).length + allIncome.filter(i => i.year === yr).length;
    grandIncome += yInc; grandExpenses += yExp;
    rows.push({ Year: yr, Income: yInc, [`Expenses (${sym})`]: yExp, [`Net (${sym})`]: yInc - yExp, Transactions: yTx });
  }
  rows.push({ Year: 'TOTAL', Income: grandIncome, [`Expenses (${sym})`]: grandExpenses, [`Net (${sym})`]: grandIncome - grandExpenses, Transactions: '' });

  const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
  ws['!cols'] = [{ wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  return ws;
}

export function exportToExcel(
  expenses: Expense[],
  income: Income[],
  categories: Category[],
  filter: ExportFilter,
  currencyCode: string = 'INR'
) {
  const wb = XLSX.utils.book_new();
  const sym = currencySymbol(currencyCode);
  let filename = 'Spendwise_Export';

  if (filter.scope === 'month') {
    const { month, year } = filter;
    const label = `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
    filename = `Spendwise_${MONTH_NAMES[parseInt(month) - 1]}_${year}`;

    const fe = expenses.filter(e => e.month === month && e.year === year)
                       .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const fi = income.filter(i => i.month === month && i.year === year)
                     .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    XLSX.utils.book_append_sheet(wb, buildExpenseSheet(fe, categories, label, sym), 'Expenses');
    XLSX.utils.book_append_sheet(wb, buildIncomeSheet(fi, label, sym), 'Income');
    XLSX.utils.book_append_sheet(wb, buildMonthlySummary(fe, fi, categories, label, sym), 'Summary');

  } else if (filter.scope === 'day') {
    const { date } = filter;
    const label = fmtDate(date);
    filename = `Spendwise_Day_${date}`;

    const fe = expenses.filter(e => e.date === date)
                       .sort((a, b) => a.description.localeCompare(b.description));
    const fi = income.filter(i => i.date === date);

    XLSX.utils.book_append_sheet(wb, buildExpenseSheet(fe, categories, label, sym), 'Expenses');
    XLSX.utils.book_append_sheet(wb, buildIncomeSheet(fi, label, sym), 'Income');

    // Simple day summary
    const totalExp = fe.reduce((s, e) => s + e.amount, 0);
    const totalInc = fi.reduce((s, i) => s + i.amount, 0);
    const summaryRows: AnyRow[] = [
      { Metric: `Day Summary — ${label}`, Value: '' },
      { Metric: '', Value: '' },
      { Metric: 'Total Expenses', Value: fmtCurrency(totalExp, sym) },
      { Metric: 'Total Income',   Value: fmtCurrency(totalInc, sym) },
      { Metric: 'Net Balance',    Value: fmtCurrency(totalInc - totalExp, sym) },
      { Metric: '', Value: '' },
      { Metric: 'Expense Transactions', Value: fe.length },
      { Metric: 'Income Transactions',  Value: fi.length },
    ];
    const ws = XLSX.utils.json_to_sheet(summaryRows, { skipHeader: true });
    ws['!cols'] = [{ wch: 26 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');

  } else if (filter.scope === 'year') {
    const { year } = filter;
    filename = `Spendwise_${year}`;

    const fe = expenses.filter(e => e.year === year)
                       .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const fi = income.filter(i => i.year === year)
                     .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    XLSX.utils.book_append_sheet(wb, buildExpenseSheet(fe, categories, String(year), sym), 'Expenses');
    XLSX.utils.book_append_sheet(wb, buildIncomeSheet(fi, String(year), sym), 'Income');
    XLSX.utils.book_append_sheet(wb, buildYearlySummary(expenses, income, year, sym), 'Monthly Breakdown');

  } else {
    // all
    filename = 'Spendwise_All_Data';
    const fe = [...expenses].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const fi = [...income].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    XLSX.utils.book_append_sheet(wb, buildExpenseSheet(fe, categories, 'All Data', sym), 'Expenses');
    XLSX.utils.book_append_sheet(wb, buildIncomeSheet(fi, 'All Data', sym), 'Income');
    XLSX.utils.book_append_sheet(wb, buildAllDataSummary(expenses, income, sym), 'Yearly Breakdown');
  }

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}.xlsx`);
}

