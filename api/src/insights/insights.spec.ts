import {
  cashflowByMonth,
  categoryBreakdown,
  topMerchants,
  detectRecurring,
  detectIncome,
  monthKey,
  monthsSpanned,
  InsightTxn,
} from './insights.util';
import { Direction } from '../common/types';
import { CategoryKey } from '../categorization/taxonomy';

function txn(overrides: Partial<InsightTxn> = {}): InsightTxn {
  return {
    postedAt: new Date('2025-06-15T10:00:00Z'),
    direction: 'DEBIT',
    amount: 100000,
    category: 'groceries',
    merchant: 'Shoprite',
    ...overrides,
  };
}

describe('insights utilities', () => {
  describe('monthKey & monthsSpanned', () => {
    it('monthKey formats YYYY-MM', () => {
      expect(monthKey(new Date('2025-06-15'))).toBe('2025-06');
    });
    it('monthsSpanned inclusive', () => {
      expect(monthsSpanned(new Date('2025-05-01'), new Date('2025-07-31'))).toBe(3);
    });
    it('monthsSpanned minimum 1', () => {
      expect(monthsSpanned(new Date('2025-06-15'), new Date('2025-06-20'))).toBe(1);
    });
  });

  describe('cashflowByMonth', () => {
    it('aggregates inflow/outflow/net per month', () => {
      const txns: InsightTxn[] = [
        txn({ postedAt: new Date('2025-05-10'), direction: 'CREDIT', amount: 52000000, category: 'income' }),
        txn({ postedAt: new Date('2025-05-15'), direction: 'DEBIT', amount: 2450000, category: 'utilities' }),
        txn({ postedAt: new Date('2025-06-10'), direction: 'CREDIT', amount: 52000000, category: 'income' }),
        txn({ postedAt: new Date('2025-06-15'), direction: 'DEBIT', amount: 2450000, category: 'utilities' }),
        txn({ postedAt: new Date('2025-06-20'), direction: 'DEBIT', amount: 6000000, category: 'savings' }),
      ];
      const cf = cashflowByMonth(txns);
      expect(cf).toHaveLength(2);
      expect(cf[0].month).toBe('2025-05');
      expect(cf[0].inflow).toBe(52000000);
      expect(cf[0].outflow).toBe(2450000);
      expect(cf[0].net).toBe(49550000);
      expect(cf[1].month).toBe('2025-06');
      expect(cf[1].inflow).toBe(52000000);
      expect(cf[1].outflow).toBe(8450000);
      expect(cf[1].net).toBe(43550000);
    });

    it('sorts months chronologically', () => {
      const txns = [
        txn({ postedAt: new Date('2025-07-01'), direction: 'DEBIT', amount: 1000 }),
        txn({ postedAt: new Date('2025-05-01'), direction: 'DEBIT', amount: 1000 }),
      ];
      const cf = cashflowByMonth(txns);
      expect(cf.map((c) => c.month)).toEqual(['2025-05', '2025-07']);
    });
  });

  describe('categoryBreakdown', () => {
    it('sums inflow/outflow/count per category with spendClass', () => {
      const txns: InsightTxn[] = [
        txn({ category: 'groceries', direction: 'DEBIT', amount: 1500000, merchant: 'Shoprite' }),
        txn({ category: 'groceries', direction: 'DEBIT', amount: 2000000, merchant: 'SPAR' }),
        txn({ category: 'income', direction: 'CREDIT', amount: 52000000, merchant: 'Salary' }),
      ];
      const cats = categoryBreakdown(txns);
      expect(cats).toHaveLength(2);
      const g = cats.find((c) => c.category === 'groceries');
      expect(g).toBeTruthy();
      expect(g?.outflow).toBe(3500000);
      expect(g?.count).toBe(2);
      expect(g?.spendClass).toBe('essential');
      const i = cats.find((c) => c.category === 'income');
      expect(i?.inflow).toBe(52000000);
    });

    it('sorts by outflow descending', () => {
      const txns = [
        txn({ category: 'transport_fuel', direction: 'DEBIT', amount: 1000 }),
        txn({ category: 'groceries', direction: 'DEBIT', amount: 5000 }),
      ];
      const cats = categoryBreakdown(txns);
      expect(cats[0].category).toBe('groceries');
    });
  });

  describe('topMerchants', () => {
    it('ranks by total outflow (DEBIT only)', () => {
      const txns: InsightTxn[] = [
        txn({ category: 'groceries', direction: 'DEBIT', amount: 100000, merchant: 'Shoprite' }),
        txn({ category: 'groceries', direction: 'DEBIT', amount: 50000, merchant: 'Shoprite' }),
        txn({ category: 'transport_fuel', direction: 'DEBIT', amount: 20000, merchant: 'Uber' }),
        txn({ category: 'income', direction: 'CREDIT', amount: 500000, merchant: 'Salary' }), // ignored (CREDIT)
        txn({ category: 'betting', direction: 'DEBIT', amount: 30000, merchant: 'Bet9ja' }),
      ];
      const top = topMerchants(txns, 3);
      expect(top).toHaveLength(3);
      expect(top[0].merchant).toBe('Shoprite');
      expect(top[0].total).toBe(150000);
      expect(top[1].merchant).toBe('Bet9ja');
      expect(top[2].merchant).toBe('Uber');
    });

    it('ignores blank merchants', () => {
      const txns = [
        txn({ direction: 'DEBIT', amount: 1000, merchant: '' }),
        txn({ direction: 'DEBIT', amount: 1000, merchant: '   ' }),
      ];
      expect(topMerchants(txns)).toHaveLength(0);
    });

    it('case-insensitive grouping', () => {
      const txns = [
        txn({ direction: 'DEBIT', amount: 1000, merchant: 'shoprite' }),
        txn({ direction: 'DEBIT', amount: 2000, merchant: 'SHOPRITE' }),
        txn({ direction: 'DEBIT', amount: 3000, merchant: 'Shoprite' }),
      ];
      const top = topMerchants(txns);
      expect(top).toHaveLength(1);
      expect(top[0].merchant).toBe('shoprite');
      expect(top[0].total).toBe(6000);
    });
  });

  describe('detectRecurring', () => {
    it('detects monthly recurring with stable amount (3+ occurrences)', () => {
      const base = new Date('2025-05-01');
      const txns: InsightTxn[] = [
        txn({ postedAt: new Date(base.getTime() + 0 * 86400000 * 30), direction: 'DEBIT', amount: 2450000, category: 'utilities', merchant: 'DStv' }),
        txn({ postedAt: new Date(base.getTime() + 1 * 86400000 * 30), direction: 'DEBIT', amount: 2450000, category: 'utilities', merchant: 'DStv' }),
        txn({ postedAt: new Date(base.getTime() + 2 * 86400000 * 30), direction: 'DEBIT', amount: 2450000, category: 'utilities', merchant: 'DStv' }),
      ];
      const rec = detectRecurring(txns);
      expect(rec).toHaveLength(1);
      expect(rec[0].merchant).toBe('DStv');
      expect(rec[0].cadence).toBe('monthly');
      expect(rec[0].typicalAmount).toBe(2450000);
      expect(rec[0].count).toBe(3);
      expect(rec[0].monthlyEquivalent).toBe(2450000);
    });

    it('detects weekly recurring (7-day gaps)', () => {
      const base = new Date('2025-05-01');
      const txns: InsightTxn[] = [
        txn({ postedAt: new Date(base.getTime() + 0 * 86400000 * 7), direction: 'DEBIT', amount: 500000, category: 'betting', merchant: 'Bet9ja' }),
        txn({ postedAt: new Date(base.getTime() + 1 * 86400000 * 7), direction: 'DEBIT', amount: 500000, category: 'betting', merchant: 'Bet9ja' }),
        txn({ postedAt: new Date(base.getTime() + 2 * 86400000 * 7), direction: 'DEBIT', amount: 500000, category: 'betting', merchant: 'Bet9ja' }),
        txn({ postedAt: new Date(base.getTime() + 3 * 86400000 * 7), direction: 'DEBIT', amount: 500000, category: 'betting', merchant: 'Bet9ja' }),
      ];
      const rec = detectRecurring(txns);
      expect(rec.length).toBeGreaterThanOrEqual(1);
      expect(rec[0].cadence).toBe('weekly');
      // monthlyEquivalent = weekly * 4.33
      expect(rec[0].monthlyEquivalent).toBeCloseTo(500000 * 4.33, -3);
    });

    it('rejects when amount varies too much (>35%)', () => {
      const base = new Date('2025-05-01');
      const txns: InsightTxn[] = [
        txn({ postedAt: new Date(base.getTime() + 0 * 86400000 * 30), direction: 'DEBIT', amount: 1000000, category: 'utilities', merchant: 'Unstable' }),
        txn({ postedAt: new Date(base.getTime() + 1 * 86400000 * 30), direction: 'DEBIT', amount: 5000000, category: 'utilities', merchant: 'Unstable' }), // 5x
        txn({ postedAt: new Date(base.getTime() + 2 * 86400000 * 30), direction: 'DEBIT', amount: 10000000, category: 'utilities', merchant: 'Unstable' }), // 10x
      ];
      const rec = detectRecurring(txns);
      expect(rec).toHaveLength(0);
    });

    it('rejects when count < 3', () => {
      const base = new Date('2025-05-01');
      const txns: InsightTxn[] = [
        txn({ postedAt: new Date(base.getTime() + 0 * 86400000 * 30), direction: 'DEBIT', amount: 2450000, merchant: 'DStv' }),
        txn({ postedAt: new Date(base.getTime() + 1 * 86400000 * 30), direction: 'DEBIT', amount: 2450000, merchant: 'DStv' }),
      ];
      expect(detectRecurring(txns)).toHaveLength(0);
    });

    it('rejects irregular cadence', () => {
      const txns: InsightTxn[] = [
        txn({ postedAt: new Date('2025-05-01'), direction: 'DEBIT', amount: 1000, merchant: 'Random' }),
        txn({ postedAt: new Date('2025-05-15'), direction: 'DEBIT', amount: 1000, merchant: 'Random' }),
        txn({ postedAt: new Date('2025-07-01'), direction: 'DEBIT', amount: 1000, merchant: 'Random' }),
        txn({ postedAt: new Date('2025-07-20'), direction: 'DEBIT', amount: 1000, merchant: 'Random' }),
      ];
      expect(detectRecurring(txns)).toHaveLength(0);
    });

    it('ignores CREDIT direction', () => {
      const base = new Date('2025-05-01');
      const txns: InsightTxn[] = [
        txn({ postedAt: new Date(base.getTime() + 0 * 86400000 * 30), direction: 'CREDIT', amount: 52000000, category: 'income', merchant: 'Salary' }),
        txn({ postedAt: new Date(base.getTime() + 1 * 86400000 * 30), direction: 'CREDIT', amount: 52000000, category: 'income', merchant: 'Salary' }),
        txn({ postedAt: new Date(base.getTime() + 2 * 86400000 * 30), direction: 'CREDIT', amount: 52000000, category: 'income', merchant: 'Salary' }),
      ];
      expect(detectRecurring(txns)).toHaveLength(0);
    });
  });

  describe('detectIncome', () => {
    it('returns zero when no credits', () => {
      const res = detectIncome([txn({ direction: 'DEBIT', amount: 1000 })]);
      expect(res.monthlyIncome).toBe(0);
      expect(res.totalIncome).toBe(0);
      expect(res.stability).toBe(0);
      expect(res.sources).toHaveLength(0);
    });

    it('sums explicit income category credits', () => {
      const txns: InsightTxn[] = [
        txn({ postedAt: new Date('2025-05-15'), direction: 'CREDIT', amount: 52000000, category: 'income', merchant: 'Salary' }),
        txn({ postedAt: new Date('2025-06-15'), direction: 'CREDIT', amount: 52000000, category: 'income', merchant: 'Salary' }),
        txn({ postedAt: new Date('2025-07-15'), direction: 'CREDIT', amount: 52000000, category: 'income', merchant: 'Salary' }),
      ];
      const res = detectIncome(txns);
      expect(res.totalIncome).toBe(156000000);
      expect(res.monthlyIncome).toBe(52000000);
      expect(res.months).toBe(3);
      expect(res.stability).toBeGreaterThan(0.9); // perfectly stable
      expect(res.sources).toHaveLength(1);
      expect(res.sources[0].merchant).toBe('Salary');
    });

    it('includes recurring credit sources (e.g. salary that landed as transfer)', () => {
      // Dates span 2 months (May 1, May 31, Jun 30) -> monthsSpanned = 2 -> monthly = total/2
      const base = new Date('2025-05-01');
      const txns: InsightTxn[] = [
        txn({ postedAt: new Date(base.getTime() + 0 * 86400000 * 30), direction: 'CREDIT', amount: 52000000, category: 'transfer', merchant: 'Employer Inc' }),
        txn({ postedAt: new Date(base.getTime() + 1 * 86400000 * 30), direction: 'CREDIT', amount: 52000000, category: 'transfer', merchant: 'Employer Inc' }),
        txn({ postedAt: new Date(base.getTime() + 2 * 86400000 * 30), direction: 'CREDIT', amount: 52000000, category: 'transfer', merchant: 'Employer Inc' }),
      ];
      const res = detectIncome(txns);
      expect(res.totalIncome).toBe(156000000);
      expect(res.monthlyIncome).toBe(78000000); // 156M / 2 months
      expect(res.sources.length).toBeGreaterThanOrEqual(1);
      expect(res.sources.find((s) => s.merchant === 'Employer Inc')).toBeTruthy();
    });

    it('ignores small/noisy recurring credits (<₦5000 median)', () => {
      const base = new Date('2025-05-01');
      const txns: InsightTxn[] = [
        txn({ postedAt: new Date(base.getTime() + 0 * 86400000 * 30), direction: 'CREDIT', amount: 300000, category: 'transfer', merchant: 'Random' }),
        txn({ postedAt: new Date(base.getTime() + 1 * 86400000 * 30), direction: 'CREDIT', amount: 300000, category: 'transfer', merchant: 'Random' }),
        txn({ postedAt: new Date(base.getTime() + 2 * 86400000 * 30), direction: 'CREDIT', amount: 300000, category: 'transfer', merchant: 'Random' }),
      ];
      const res = detectIncome(txns);
      expect(res.totalIncome).toBe(0);
    });

    it('calculates stability = 1 - CV (coefficient of variation)', () => {
      // Income varying 10% month-to-month
      const txns: InsightTxn[] = [
        txn({ postedAt: new Date('2025-05-01'), direction: 'CREDIT', amount: 50000000, category: 'income' }),
        txn({ postedAt: new Date('2025-06-01'), direction: 'CREDIT', amount: 55000000, category: 'income' }),
        txn({ postedAt: new Date('2025-07-01'), direction: 'CREDIT', amount: 50000000, category: 'income' }),
      ];
      const res = detectIncome(txns);
      // mean = 51.67M, std ≈ 2.36M, CV ≈ 0.046, stability ≈ 0.95
      expect(res.stability).toBeGreaterThan(0.9);
    });

    it('stability = 0 when single month', () => {
      const res = detectIncome([txn({ postedAt: new Date('2025-05-15'), direction: 'CREDIT', amount: 52000000, category: 'income' })]);
      expect(res.months).toBe(1);
      expect(res.stability).toBe(1); // single month = perfect stability
    });
  });
});