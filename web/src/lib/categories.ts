/** Stable colors per category, used across the donut, tags and merchant rows. */
export const CATEGORY_COLORS: Record<string, string> = {
  income: '#10B981',
  transfer: '#60A5FA',
  pos_retail: '#C084FC',
  airtime_data: '#38BDF8',
  utilities: '#34D399',
  transport_fuel: '#FBBF24',
  food_dining: '#FB923C',
  groceries: '#A3E635',
  betting: '#F43F5E',
  loans: '#F87171',
  bank_charges: '#94A3B8',
  atm: '#818CF8',
  subscriptions: '#E879F9',
  health: '#2DD4BF',
  education: '#22D3EE',
  savings: '#D4AF6A',
  other: '#64748B',
};

export function categoryColor(key: string): string {
  return CATEGORY_COLORS[key] ?? '#64748B';
}

/** Friendly labels, mirroring the backend taxonomy (api/src/categorization/taxonomy.ts). */
export const CATEGORY_LABELS: Record<string, string> = {
  income: 'Income',
  transfer: 'Transfers',
  pos_retail: 'POS & Retail',
  airtime_data: 'Airtime & Data',
  utilities: 'Utilities & Bills',
  transport_fuel: 'Transport & Fuel',
  food_dining: 'Food & Dining',
  groceries: 'Groceries',
  betting: 'Betting & Gaming',
  loans: 'Loans & Repayments',
  bank_charges: 'Bank Charges & Fees',
  atm: 'ATM Withdrawals',
  subscriptions: 'Subscriptions',
  health: 'Health',
  education: 'Education',
  savings: 'Savings & Investments',
  other: 'Uncategorized',
};

export function categoryLabel(key: string | null): string {
  if (!key) return 'Uncategorized';
  return CATEGORY_LABELS[key] ?? key.replace(/_/g, ' ');
}

export const CADENCE_LABEL: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  irregular: 'Irregular',
};

export const SPEND_CLASS_LABEL: Record<string, string> = {
  income: 'Income',
  essential: 'Essential',
  discretionary: 'Discretionary',
  transfer: 'Transfers',
  savings: 'Savings',
  charges: 'Charges',
  debt: 'Debt',
};
