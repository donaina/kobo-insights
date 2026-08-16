import { CategoryKey, CATEGORIES, SpendClass } from '../categorization/taxonomy';
import { Direction } from '../common/types';

/** Minimal transaction shape the insight functions operate on. */
export interface InsightTxn {
  postedAt: Date;
  direction: Direction;
  amount: number; // integer kobo, positive
  category: CategoryKey;
  merchant?: string | null;
}

export interface MonthlyCashflow {
  month: string; // YYYY-MM
  inflow: number;
  outflow: number;
  net: number;
}

export interface CategorySummary {
  category: CategoryKey;
  label: string;
  spendClass: SpendClass;
  outflow: number;
  inflow: number;
  count: number;
}

export interface MerchantSummary {
  merchant: string;
  category: CategoryKey;
  total: number;
  count: number;
}

export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'irregular';

export interface RecurringItem {
  merchant: string;
  category: CategoryKey;
  label: string;
  typicalAmount: number;
  count: number;
  cadence: Cadence;
  monthlyEquivalent: number;
}

export interface IncomeSource {
  merchant: string;
  total: number;
  count: number;
  monthlyAmount: number;
}

export interface IncomeSummary {
  monthlyIncome: number;
  totalIncome: number;
  months: number;
  stability: number; // 0..1, higher = steadier month-to-month
  sources: IncomeSource[];
}

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Distinct calendar months spanned, inclusive (always >= 1). */
export function monthsSpanned(start: Date, end: Date): number {
  const n =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1;
  return Math.max(1, n);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function cashflowByMonth(txns: InsightTxn[]): MonthlyCashflow[] {
  const map = new Map<string, MonthlyCashflow>();
  for (const t of txns) {
    const key = monthKey(t.postedAt);
    const row = map.get(key) ?? { month: key, inflow: 0, outflow: 0, net: 0 };
    if (t.direction === 'CREDIT') row.inflow += t.amount;
    else row.outflow += t.amount;
    row.net = row.inflow - row.outflow;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export function categoryBreakdown(txns: InsightTxn[]): CategorySummary[] {
  const map = new Map<CategoryKey, CategorySummary>();
  for (const t of txns) {
    const meta = CATEGORIES[t.category];
    const row =
      map.get(t.category) ??
      { category: t.category, label: meta.label, spendClass: meta.spendClass, outflow: 0, inflow: 0, count: 0 };
    if (t.direction === 'CREDIT') row.inflow += t.amount;
    else row.outflow += t.amount;
    row.count += 1;
    map.set(t.category, row);
  }
  return [...map.values()].sort((a, b) => b.outflow - a.outflow);
}

/** Top merchants by outflow (debits only), ignoring blank merchants. */
export function topMerchants(txns: InsightTxn[], limit = 10): MerchantSummary[] {
  const map = new Map<string, MerchantSummary>();
  for (const t of txns) {
    if (t.direction !== 'DEBIT') continue;
    const merchant = (t.merchant ?? '').trim();
    if (!merchant) continue;
    const key = merchant.toLowerCase();
    const row = map.get(key) ?? { merchant, category: t.category, total: 0, count: 0 };
    row.total += t.amount;
    row.count += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

function cadenceFromGapDays(gap: number): Cadence {
  if (gap >= 5 && gap <= 9) return 'weekly';
  if (gap >= 12 && gap <= 16) return 'biweekly';
  if (gap >= 25 && gap <= 38) return 'monthly';
  return 'irregular';
}

function monthlyMultiplier(cadence: Cadence): number {
  switch (cadence) {
    case 'weekly':
      return 4.33;
    case 'biweekly':
      return 2.17;
    case 'monthly':
      return 1;
    default:
      return 1;
  }
}

/**
 * Detect recurring outgoings: a merchant paid >= 3 times at a roughly regular
 * cadence with a stable amount (subscriptions, rent, bills, standing transfers).
 */
export function detectRecurring(txns: InsightTxn[]): RecurringItem[] {
  const groups = new Map<string, InsightTxn[]>();
  for (const t of txns) {
    if (t.direction !== 'DEBIT') continue;
    const merchant = (t.merchant ?? '').trim();
    if (!merchant) continue;
    const key = merchant.toLowerCase();
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(t);
  }

  const items: RecurringItem[] = [];
  for (const group of groups.values()) {
    if (group.length < 3) continue;
    const sorted = [...group].sort((a, b) => a.postedAt.getTime() - b.postedAt.getTime());
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((sorted[i].postedAt.getTime() - sorted[i - 1].postedAt.getTime()) / 86_400_000);
    }
    const medGap = median(gaps.map((g) => Math.round(g)));
    const cadence = cadenceFromGapDays(medGap);
    const typicalAmount = median(sorted.map((t) => t.amount));

    // Require amount stability: most charges within ±35% of the typical amount.
    const stable = sorted.filter((t) => Math.abs(t.amount - typicalAmount) <= typicalAmount * 0.35).length;
    if (stable / sorted.length < 0.6) continue;
    if (cadence === 'irregular') continue;

    items.push({
      merchant: sorted[0].merchant!.trim(),
      category: sorted[0].category,
      label: CATEGORIES[sorted[0].category].label,
      typicalAmount,
      count: sorted.length,
      cadence,
      monthlyEquivalent: Math.round(typicalAmount * monthlyMultiplier(cadence)),
    });
  }
  return items.sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent);
}

/**
 * Estimate income. Any CREDIT categorized as `income` counts; on top of that,
 * large recurring credits (e.g. a monthly salary that landed as a transfer) are
 * treated as income sources. Stability is 1 minus the coefficient of variation
 * of monthly income, clamped to 0..1.
 */
export function detectIncome(txns: InsightTxn[]): IncomeSummary {
  const credits = txns.filter((t) => t.direction === 'CREDIT');
  if (credits.length === 0) {
    return { monthlyIncome: 0, totalIncome: 0, months: 1, stability: 0, sources: [] };
  }
  const start = credits.reduce((a, t) => (t.postedAt < a ? t.postedAt : a), credits[0].postedAt);
  const end = credits.reduce((a, t) => (t.postedAt > a ? t.postedAt : a), credits[0].postedAt);
  const months = monthsSpanned(start, end);

  // Income = explicit income credits + recurring credit sources.
  const incomeTxns = credits.filter((t) => t.category === 'income');
  const recurringCredits = detectRecurringCredits(credits);
  const incomeSet = new Set(incomeTxns);
  for (const t of recurringCredits) incomeSet.add(t);
  const allIncome = [...incomeSet];

  const totalIncome = allIncome.reduce((s, t) => s + t.amount, 0);

  // Group income by source for the breakdown.
  const bySource = new Map<string, IncomeSource>();
  for (const t of allIncome) {
    const merchant = (t.merchant ?? 'Income').trim() || 'Income';
    const key = merchant.toLowerCase();
    const row = bySource.get(key) ?? { merchant, total: 0, count: 0, monthlyAmount: 0 };
    row.total += t.amount;
    row.count += 1;
    bySource.set(key, row);
  }
  const sources = [...bySource.values()]
    .map((s) => ({ ...s, monthlyAmount: Math.round(s.total / months) }))
    .sort((a, b) => b.total - a.total);

  // Monthly income series -> stability.
  const perMonth = new Map<string, number>();
  for (const t of allIncome) {
    perMonth.set(monthKey(t.postedAt), (perMonth.get(monthKey(t.postedAt)) ?? 0) + t.amount);
  }
  const stability = stabilityOf([...perMonth.values()]);

  return {
    monthlyIncome: Math.round(totalIncome / months),
    totalIncome,
    months,
    stability,
    sources,
  };
}

/** Recurring inbound sources (mirror of detectRecurring for credits). */
function detectRecurringCredits(credits: InsightTxn[]): InsightTxn[] {
  const groups = new Map<string, InsightTxn[]>();
  for (const t of credits) {
    const merchant = (t.merchant ?? '').trim();
    if (!merchant) continue;
    const key = merchant.toLowerCase();
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(t);
  }
  const out: InsightTxn[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const typical = median(group.map((t) => t.amount));
    // A recurring credit source worth counting is sizeable and fairly stable.
    if (typical < 5_000_00) continue; // < ₦5,000 median: ignore as noise
    const stable = group.filter((t) => Math.abs(t.amount - typical) <= typical * 0.4).length;
    if (stable / group.length >= 0.6) out.push(...group);
  }
  return out;
}

function stabilityOf(monthly: number[]): number {
  if (monthly.length <= 1) return monthly.length === 1 ? 1 : 0;
  const mean = monthly.reduce((a, b) => a + b, 0) / monthly.length;
  if (mean === 0) return 0;
  const variance = monthly.reduce((a, b) => a + (b - mean) ** 2, 0) / monthly.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.max(0, Math.min(1, 1 - cv));
}
