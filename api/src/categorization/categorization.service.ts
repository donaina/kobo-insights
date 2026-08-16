import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { CategoryKey, isCategoryKey } from './taxonomy';
import { RULES } from './rules';
import { Direction } from '../common/types';

export interface Classification {
  category: CategoryKey;
  merchant?: string;
  confidence: number;
  categorizedBy: 'RULES' | 'AI';
}

export interface CategorizeSummary {
  total: number;
  byRules: number;
  byAi: number;
  uncategorized: number;
}

/**
 * Two-tier categorizer. Tier 1 is a deterministic rule engine over Nigerian
 * narrations (see rules.ts) — it runs everywhere, offline, with zero setup.
 * Tier 2 is an OPTIONAL Claude pass that only sees the lines the rules couldn't
 * place (`category === 'other'`); if AI is disabled or errors, those lines just
 * stay uncategorized and everything else still works. Same "works without the
 * optional service, better with it" contract as the balance cache in the NIP
 * simulator.
 */
@Injectable()
export class CategorizationService {
  private readonly logger = new Logger(CategorizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  /** Deterministic, side-effect-free classification. This is the tier-1 engine. */
  classifyByRules(narration: string, direction: Direction): Classification {
    const upper = narration.toUpperCase().replace(/\s+/g, ' ').trim();
    for (const rule of RULES) {
      if (rule.direction && rule.direction !== direction) continue;
      const match = upper.match(rule.test);
      if (match) {
        const merchant = typeof rule.merchant === 'function' ? rule.merchant(upper, match) : rule.merchant;
        return {
          category: rule.category,
          merchant: merchant || undefined,
          confidence: rule.confidence,
          categorizedBy: 'RULES',
        };
      }
    }
    return { category: 'other', confidence: 0.2, categorizedBy: 'RULES' };
  }

  /** Categorize every transaction on a statement and persist the labels. */
  async categorizeStatement(statementId: string): Promise<CategorizeSummary> {
    const txns = await this.prisma.transaction.findMany({ where: { statementId } });
    const results = new Map<string, Classification>();
    const aiCandidates: { id: string; narration: string; direction: Direction }[] = [];

    for (const t of txns) {
      const direction = t.direction as Direction;
      const c = this.classifyByRules(t.narration, direction);
      results.set(t.id, c);
      if (c.category === 'other') {
        aiCandidates.push({ id: t.id, narration: t.narration, direction });
      }
    }

    let byAi = 0;
    if (this.ai.isEnabled() && aiCandidates.length > 0) {
      try {
        const aiResults = await this.ai.categorizeBatch(
          aiCandidates.map((c) => ({ narration: c.narration, direction: c.direction })),
        );
        aiResults.forEach((r, i) => {
          if (r && isCategoryKey(r.category) && r.category !== 'other') {
            results.set(aiCandidates[i].id, {
              category: r.category,
              merchant: r.merchant || undefined,
              confidence: typeof r.confidence === 'number' ? r.confidence : 0.7,
              categorizedBy: 'AI',
            });
            byAi++;
          }
        });
        this.logger.log(`AI categorized ${byAi}/${aiCandidates.length} previously-uncategorized lines`);
      } catch (err) {
        this.logger.warn(`AI categorization failed, keeping rules-only: ${(err as Error).message}`);
      }
    }

    await this.prisma.$transaction(
      [...results.entries()].map(([id, c]) =>
        this.prisma.transaction.update({
          where: { id },
          data: {
            category: c.category,
            merchant: c.merchant ?? null,
            categoryConfidence: c.confidence,
            categorizedBy: c.categorizedBy,
          },
        }),
      ),
    );

    const uncategorized = [...results.values()].filter((c) => c.category === 'other').length;
    return { total: results.size, byRules: results.size - byAi, byAi, uncategorized };
  }
}
