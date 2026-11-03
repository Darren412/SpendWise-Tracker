import { Category } from '@/types';

export type SpendClass = 'essential' | 'flexible' | 'discretionary';

/** Built-in category ids (defaultCategories in the store) → class. */
const ID_DEFAULTS: Record<string, SpendClass> = {
  '1': 'flexible',       // Dining & Food (mixes groceries + dining)
  '2': 'flexible',       // Travel & Transport
  '3': 'essential',      // Utilities & Bills
  '4': 'discretionary',  // Entertainment & Leisure
  '5': 'essential',      // Healthcare & Wellness
  '6': 'discretionary',  // Retail & Shopping
  '7': 'discretionary',  // Café & Dining
  '8': 'flexible',       // Other Expenses
};

// First match wins — checked essential → flexible → discretionary.
const ESSENTIAL_KW = [
  'rent', 'mortgage', 'emi', 'loan', 'insurance', 'utilit', 'electric', 'water',
  'gas bill', 'bill', 'health', 'medical', 'hospital', 'pharma', 'medicine',
  'school', 'tuition', 'education', 'tax', 'childcare',
];
const FLEXIBLE_KW = [
  'grocer', 'supermarket', 'transport', 'travel', 'fuel', 'petrol', 'diesel',
  'commute', 'phone', 'mobile', 'internet', 'broadband', 'household',
  'maintenance', 'personal care',
];
const DISCRETIONARY_KW = [
  'dining', 'restaurant', 'cafe', 'café', 'coffee', 'food delivery', 'swiggy',
  'zomato', 'takeaway', 'entertainment', 'movie', 'leisure', 'shopping',
  'retail', 'clothing', 'fashion', 'gadget', 'electronics', 'subscription',
  'streaming', 'gaming', 'alcohol', 'bar', 'party', 'gift', 'hobby',
  'vacation', 'holiday',
];

/** Auto classification: built-in ids first, then keyword match, else flexible. */
export function defaultSpendClass(cat: Pick<Category, 'id' | 'name'>): SpendClass {
  if (ID_DEFAULTS[cat.id]) return ID_DEFAULTS[cat.id];
  const name = cat.name.toLowerCase();
  if (ESSENTIAL_KW.some(k => name.includes(k))) return 'essential';
  if (FLEXIBLE_KW.some(k => name.includes(k))) return 'flexible';
  if (DISCRETIONARY_KW.some(k => name.includes(k))) return 'discretionary';
  return 'flexible';
}

/** Effective class — user override wins, undefined means auto. */
export function getSpendClass(cat: Category): SpendClass {
  return cat.spendClass ?? defaultSpendClass(cat);
}

export function isAutoClass(cat: Category): boolean {
  return cat.spendClass === undefined;
}
