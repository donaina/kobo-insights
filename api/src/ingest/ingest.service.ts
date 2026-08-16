import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategorizationService } from '../categorization/categorization.service';
import { loadConfig } from '../config/configuration';
import { ValidationError } from '../common/errors';
import { parseStatementCsv } from './csv-parser';

export interface IngestResult {
  statementId: string;
  label: string;
  transactions: number;
  skipped: number;
  categorization: { total: number; byRules: number; byAi: number; uncategorized: number };
}

/**
 * Turns a raw statement CSV into a persisted, categorized statement. The
 * pipeline is: parse -> store statement + lines in one DB transaction ->
 * categorize (rules, optionally AI) -> return a summary.
 */
@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);
  private readonly config = loadConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly categorization: CategorizationService,
  ) {}

  async ingestCsv(
    csv: string,
    opts: { label: string; source?: 'SAMPLE' | 'UPLOAD'; bankHint?: string; accountName?: string },
  ): Promise<IngestResult> {
    if (!csv || csv.trim().length === 0) {
      throw new ValidationError('empty CSV');
    }
    const parsed = parseStatementCsv(csv);
    if (parsed.txns.length === 0) {
      throw new ValidationError('no valid transactions found in CSV');
    }
    if (parsed.txns.length > this.config.maxUploadRows) {
      throw new ValidationError(
        `statement has ${parsed.txns.length} rows, exceeding the limit of ${this.config.maxUploadRows}`,
      );
    }

    const statement = await this.prisma.statement.create({
      data: {
        label: opts.label,
        source: opts.source ?? 'UPLOAD',
        bankHint: opts.bankHint ?? null,
        accountName: opts.accountName ?? null,
        periodStart: parsed.periodStart ?? null,
        periodEnd: parsed.periodEnd ?? null,
        openingBalance: parsed.openingBalance ?? null,
        closingBalance: parsed.closingBalance ?? null,
        transactions: {
          create: parsed.txns.map((t) => ({
            postedAt: t.postedAt,
            direction: t.direction,
            amount: t.amountKobo,
            narration: t.narration,
            balanceAfter: t.balanceAfterKobo ?? null,
          })),
        },
      },
    });

    const categorization = await this.categorization.categorizeStatement(statement.id);
    this.logger.log(
      `Ingested "${opts.label}": ${parsed.txns.length} txns (${parsed.skipped} skipped), ` +
        `${categorization.byRules} by rules, ${categorization.byAi} by AI`,
    );

    return {
      statementId: statement.id,
      label: statement.label,
      transactions: parsed.txns.length,
      skipped: parsed.skipped,
      categorization,
    };
  }
}
