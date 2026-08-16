import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IngestService, IngestResult } from '../ingest/ingest.service';
import { NotFoundError } from '../common/errors';

export interface StatementSummary {
  id: string;
  label: string;
  source: string;
  bankHint: string | null;
  accountName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  txnCount: number;
  createdAt: string;
}

@Injectable()
export class StatementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingest: IngestService,
  ) {}

  async list(): Promise<StatementSummary[]> {
    const rows = await this.prisma.statement.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { transactions: true } } },
    });
    return rows.map((s) => ({
      id: s.id,
      label: s.label,
      source: s.source,
      bankHint: s.bankHint,
      accountName: s.accountName,
      periodStart: s.periodStart ? s.periodStart.toISOString() : null,
      periodEnd: s.periodEnd ? s.periodEnd.toISOString() : null,
      txnCount: s._count.transactions,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  /** Statement metadata plus its transactions (amounts stay integer kobo). */
  async get(id: string) {
    const s = await this.prisma.statement.findUnique({
      where: { id },
      include: { transactions: { orderBy: { postedAt: 'asc' } } },
    });
    if (!s) throw new NotFoundError(`statement ${id} not found`);
    return {
      id: s.id,
      label: s.label,
      source: s.source,
      bankHint: s.bankHint,
      accountName: s.accountName,
      periodStart: s.periodStart ? s.periodStart.toISOString() : null,
      periodEnd: s.periodEnd ? s.periodEnd.toISOString() : null,
      openingBalance: s.openingBalance,
      closingBalance: s.closingBalance,
      createdAt: s.createdAt.toISOString(),
      transactions: s.transactions.map((t) => ({
        id: t.id,
        postedAt: t.postedAt.toISOString(),
        direction: t.direction,
        amount: t.amount,
        narration: t.narration,
        balanceAfter: t.balanceAfter,
        category: t.category,
        merchant: t.merchant,
        categoryConfidence: t.categoryConfidence,
        categorizedBy: t.categorizedBy,
      })),
    };
  }

  async upload(input: {
    label: string;
    csv: string;
    bankHint?: string;
    accountName?: string;
  }): Promise<IngestResult> {
    return this.ingest.ingestCsv(input.csv, {
      label: input.label,
      source: 'UPLOAD',
      bankHint: input.bankHint,
      accountName: input.accountName,
    });
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const s = await this.prisma.statement.findUnique({ where: { id } });
    if (!s) throw new NotFoundError(`statement ${id} not found`);
    await this.prisma.statement.delete({ where: { id } });
    return { deleted: true };
  }
}
