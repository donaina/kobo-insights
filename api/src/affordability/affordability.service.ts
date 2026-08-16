import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InsightsService } from '../insights/insights.service';
import { scoreAffordability, AffordabilitySnapshot, BalanceStats } from './affordability.util';

@Injectable()
export class AffordabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: InsightsService,
  ) {}

  /** Running-balance stats, computed only when the statement carried a balance column. */
  private async balanceStats(statementId: string): Promise<BalanceStats> {
    const rows = await this.prisma.transaction.findMany({
      where: { statementId, balanceAfter: { not: null } },
      select: { balanceAfter: true },
    });
    if (rows.length === 0) return { avgBalance: null, minBalance: null };
    const balances = rows.map((r) => r.balanceAfter as number);
    const avg = Math.round(balances.reduce((s, b) => s + b, 0) / balances.length);
    const min = balances.reduce((m, b) => (b < m ? b : m), balances[0]);
    return { avgBalance: avg, minBalance: min };
  }

  async snapshot(statementId: string): Promise<AffordabilitySnapshot> {
    // insights.report throws NotFoundError for an unknown statement.
    const report = await this.insights.report(statementId);
    const balance = await this.balanceStats(statementId);
    return scoreAffordability(report, balance);
  }
}
