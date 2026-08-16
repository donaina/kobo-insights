import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '../common/errors';
import { CategoryKey, isCategoryKey } from '../categorization/taxonomy';
import { Direction } from '../common/types';
import {
  InsightTxn,
  MonthlyCashflow,
  CategorySummary,
  MerchantSummary,
  RecurringItem,
  IncomeSummary,
  cashflowByMonth,
  categoryBreakdown,
  topMerchants,
  detectRecurring,
  detectIncome,
  monthsSpanned,
} from './insights.util';

export interface InsightsReport {
  statementId: string;
  label: string;
  period: { start: string | null; end: string | null; months: number };
  totals: { inflow: number; outflow: number; net: number; txnCount: number };
  cashflow: MonthlyCashflow[];
  categories: CategorySummary[];
  topMerchants: MerchantSummary[];
  recurring: RecurringItem[];
  income: IncomeSummary;
}

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Load a statement's transactions as the pure-function input shape. */
  async loadTxns(statementId: string): Promise<InsightTxn[]> {
    const rows = await this.prisma.transaction.findMany({
      where: { statementId },
      orderBy: { postedAt: 'asc' },
    });
    return rows.map((r) => ({
      postedAt: r.postedAt,
      direction: r.direction as Direction,
      amount: r.amount,
      category: (r.category && isCategoryKey(r.category) ? r.category : 'other') as CategoryKey,
      merchant: r.merchant,
    }));
  }

  async report(statementId: string): Promise<InsightsReport> {
    const statement = await this.prisma.statement.findUnique({ where: { id: statementId } });
    if (!statement) throw new NotFoundError(`statement ${statementId} not found`);

    const txns = await this.loadTxns(statementId);
    const inflow = txns.filter((t) => t.direction === 'CREDIT').reduce((s, t) => s + t.amount, 0);
    const outflow = txns.filter((t) => t.direction === 'DEBIT').reduce((s, t) => s + t.amount, 0);

    const start = txns.length ? txns[0].postedAt : null;
    const end = txns.length ? txns[txns.length - 1].postedAt : null;
    const months = start && end ? monthsSpanned(start, end) : 1;

    return {
      statementId,
      label: statement.label,
      period: {
        start: start ? start.toISOString() : null,
        end: end ? end.toISOString() : null,
        months,
      },
      totals: { inflow, outflow, net: inflow - outflow, txnCount: txns.length },
      cashflow: cashflowByMonth(txns),
      categories: categoryBreakdown(txns),
      topMerchants: topMerchants(txns),
      recurring: detectRecurring(txns),
      income: detectIncome(txns),
    };
  }
}
