/**
 * The fixed category taxonomy. Categorization only ever emits one of these
 * keys — both the rule engine and the optional AI pass are constrained to it,
 * so downstream aggregation and scoring can rely on a closed set.
 *
 * `spendClass` groups categories for the affordability signal:
 *   income        money in
 *   essential     hard-to-avoid outgoings (bills, transport, groceries, health…)
 *   discretionary lifestyle outgoings (dining, betting, subscriptions…)
 *   transfer      person-to-person / inter-account movement (direction-dependent)
 *   savings       money set aside (still the customer's — not an expense)
 *   charges       bank fees, VAT, stamp duty
 *   debt          loan disbursements / repayments (tracked for debt-service)
 */
export type CategoryKey =
  | 'income'
  | 'transfer'
  | 'pos_retail'
  | 'airtime_data'
  | 'utilities'
  | 'transport_fuel'
  | 'food_dining'
  | 'groceries'
  | 'betting'
  | 'loans'
  | 'bank_charges'
  | 'atm'
  | 'subscriptions'
  | 'health'
  | 'education'
  | 'savings'
  | 'other';

export type SpendClass =
  | 'income'
  | 'essential'
  | 'discretionary'
  | 'transfer'
  | 'savings'
  | 'charges'
  | 'debt';

export interface CategoryMeta {
  key: CategoryKey;
  label: string;
  spendClass: SpendClass;
}

export const CATEGORIES: Record<CategoryKey, CategoryMeta> = {
  income: { key: 'income', label: 'Income', spendClass: 'income' },
  transfer: { key: 'transfer', label: 'Transfers', spendClass: 'transfer' },
  pos_retail: { key: 'pos_retail', label: 'POS & Retail', spendClass: 'discretionary' },
  airtime_data: { key: 'airtime_data', label: 'Airtime & Data', spendClass: 'essential' },
  utilities: { key: 'utilities', label: 'Utilities & Bills', spendClass: 'essential' },
  transport_fuel: { key: 'transport_fuel', label: 'Transport & Fuel', spendClass: 'essential' },
  food_dining: { key: 'food_dining', label: 'Food & Dining', spendClass: 'discretionary' },
  groceries: { key: 'groceries', label: 'Groceries', spendClass: 'essential' },
  betting: { key: 'betting', label: 'Betting & Gaming', spendClass: 'discretionary' },
  loans: { key: 'loans', label: 'Loans & Repayments', spendClass: 'debt' },
  bank_charges: { key: 'bank_charges', label: 'Bank Charges & Fees', spendClass: 'charges' },
  atm: { key: 'atm', label: 'ATM Withdrawals', spendClass: 'discretionary' },
  subscriptions: { key: 'subscriptions', label: 'Subscriptions', spendClass: 'discretionary' },
  health: { key: 'health', label: 'Health', spendClass: 'essential' },
  education: { key: 'education', label: 'Education', spendClass: 'essential' },
  savings: { key: 'savings', label: 'Savings & Investments', spendClass: 'savings' },
  other: { key: 'other', label: 'Uncategorized', spendClass: 'discretionary' },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

export function isCategoryKey(value: string): value is CategoryKey {
  return Object.prototype.hasOwnProperty.call(CATEGORIES, value);
}

export function spendClassOf(key: CategoryKey): SpendClass {
  return CATEGORIES[key].spendClass;
}
