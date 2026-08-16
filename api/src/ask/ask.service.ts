import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { InsightsService } from '../insights/insights.service';
import { AffordabilityService } from '../affordability/affordability.service';
import { ValidationError } from '../common/errors';
import { Direction } from '../common/types';
import { buildAskContext } from './ask-context';

export interface AskResult {
  answer: string;
  aiEnabled: boolean;
  question: string;
}

const TXN_CAP = 40;
const DISABLED_HINT =
  'The "Ask your statement" feature needs the optional AI layer. Set AI_ENABLED=true and ' +
  'ANTHROPIC_API_KEY in api/.env, then restart. Everything else (categorization, insights, ' +
  'affordability) works without it.';

@Injectable()
export class AskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly insights: InsightsService,
    private readonly affordability: AffordabilityService,
  ) {}

  async ask(statementId: string, question: string): Promise<AskResult> {
    const q = (question ?? '').trim();
    if (!q) throw new ValidationError('question is required');

    // Validates the statement exists (throws NotFoundError) even when AI is off,
    // so the caller gets a real 404 rather than a misleading "AI disabled" hint.
    const report = await this.insights.report(statementId);

    if (!this.ai.isEnabled()) {
      return { answer: DISABLED_HINT, aiEnabled: false, question: q };
    }

    const affordability = await this.affordability.snapshot(statementId);
    const largest = await this.prisma.transaction.findMany({
      where: { statementId },
      orderBy: { amount: 'desc' },
      take: TXN_CAP,
    });
    const sampleTxns = largest.map((t) => ({
      postedAt: t.postedAt,
      direction: t.direction as Direction,
      amountKobo: t.amount,
      narration: t.narration,
      balanceAfterKobo: t.balanceAfter ?? undefined,
      category: t.category,
      merchant: t.merchant,
    }));

    const context = buildAskContext({ report, affordability, sampleTxns, txnCap: TXN_CAP });
    const answer = await this.ai.answerQuestion({ question: q, context });
    return { answer, aiEnabled: true, question: q };
  }
}
