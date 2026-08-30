export interface CurrencyConfig {
  code: string;
  symbol: string;
  locale: string;
  label: string;
}

export const currencies: CurrencyConfig[] = [
  { code: 'INR', symbol: '₹', locale: 'en-IN', label: '₹ INR' },
  { code: 'USD', symbol: '$', locale: 'en-US', label: '$ USD' },
  { code: 'EUR', symbol: '€', locale: 'de-DE', label: '€ EUR' },
  { code: 'GBP', symbol: '£', locale: 'en-GB', label: '£ GBP' },
  { code: 'AED', symbol: 'د.إ', locale: 'ar-AE', label: 'د.إ AED' },
  { code: 'CAD', symbol: 'C$', locale: 'en-CA', label: 'C$ CAD' },
  { code: 'AUD', symbol: 'A$', locale: 'en-AU', label: 'A$ AUD' },
  { code: 'JPY', symbol: '¥', locale: 'ja-JP', label: '¥ JPY' },
];

export function getCurrencyConfig(code: string): CurrencyConfig {
  return currencies.find((c) => c.code === code) ?? currencies[0];
}

export function formatCurrency(amount: number, code: string): string {
  const config = getCurrencyConfig(code);
  if (!isFinite(amount)) return `${config.symbol}0`;
  return `${config.symbol}${amount.toLocaleString(config.locale, {
    minimumFractionDigits: config.code === 'JPY' ? 0 : 2,
    maximumFractionDigits: config.code === 'JPY' ? 0 : 2,
  })}`;
}

export function formatCurrencyShort(amount: number, code: string): string {
  const config = getCurrencyConfig(code);
  if (!isFinite(amount)) return `${config.symbol}0`;
  return `${config.symbol}${amount.toLocaleString(config.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function currencySymbol(code: string): string {
  return getCurrencyConfig(code).symbol;
}
