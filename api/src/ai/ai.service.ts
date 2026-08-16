import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { loadConfig } from '../config/configuration';
import { Direction } from '../common/types';
import { CATEGORIES, CATEGORY_KEYS } from '../categorization/taxonomy';

export interface AiCategory {
  category: string;
  merchant?: string;
  confidence?: number;
}

export interface AskContext {
  question: string;
  context: string; // pre-built, compact structured summary of the statement
}

/**
 * Optional Claude layer. The whole app runs without it: `isEnabled()` is false
 * unless AI_ENABLED=true, a key is set, AND the SDK is installed. The SDK is an
 * optionalDependency and is lazy-`require`d inside a try/catch, so a missing
 * package or bad key degrades to "AI off" instead of crashing the service —
 * the same contract as the balance cache's Redis fallback in the NIP simulator.
 */
@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private readonly config = loadConfig();
  private client: any = null;

  onModuleInit(): void {
    if (!this.config.aiEnabled) {
      this.logger.log('AI layer: disabled (rules-only categorization, Ask returns a setup hint)');
      return;
    }
    try {
      // Lazy-required so the service runs even when the SDK isn't installed.
      const Anthropic = require('@anthropic-ai/sdk');
      this.client = new Anthropic({ apiKey: this.config.anthropicApiKey });
      this.logger.log('AI layer: enabled (Anthropic Claude)');
    } catch (err) {
      this.client = null;
      this.logger.warn(`AI enabled but SDK unavailable, falling back to rules-only: ${(err as Error).message}`);
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  private taxonomyList(): string {
    return CATEGORY_KEYS.map((k) => `${k} (${CATEGORIES[k].label})`).join(', ');
  }

  /**
   * Classify a batch of narrations the rule engine couldn't place. Returns an
   * array aligned to the input; any element may be null if the model didn't
   * return a usable row. Constrained to the fixed taxonomy.
   */
  async categorizeBatch(
    items: { narration: string; direction: Direction }[],
  ): Promise<(AiCategory | null)[]> {
    if (!this.isEnabled() || items.length === 0) return items.map(() => null);

    const numbered = items
      .map((it, i) => `${i + 1}. [${it.direction}] ${it.narration.replace(/\s+/g, ' ').trim()}`)
      .join('\n');

    const prompt = `You are categorizing Nigerian bank-statement narrations. Assign each line ONE category key from this fixed list:\n${this.taxonomyList()}\n\nRules:\n- Use ONLY the keys above (the part before the parenthesis).\n- "transfer" is for generic person-to-person movement; prefer a specific category (utilities, betting, airtime_data, etc.) whenever the narration names one.\n- Extract a short merchant/counterparty name when one is present, else omit it.\n- confidence is 0..1.\n\nReturn ONLY a JSON array, one object per line, in order:\n[{"n":1,"category":"<key>","merchant":"<name or empty>","confidence":0.0}]\n\nLines:\n${numbered}`;

    const resp = await this.client.messages.create({
      model: this.config.categorizeModel,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = this.extractText(resp);
    const parsed = this.parseJsonArray(text);
    if (!parsed) return items.map(() => null);

    const out: (AiCategory | null)[] = items.map(() => null);
    for (const row of parsed) {
      const n = Number(row?.n);
      if (Number.isInteger(n) && n >= 1 && n <= items.length && typeof row.category === 'string') {
        out[n - 1] = {
          category: row.category,
          merchant: typeof row.merchant === 'string' && row.merchant.trim() ? row.merchant.trim() : undefined,
          confidence: typeof row.confidence === 'number' ? row.confidence : undefined,
        };
      }
    }
    return out;
  }

  /** Answer a natural-language question strictly from a pre-built context blob. */
  async answerQuestion({ question, context }: AskContext): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('AI not enabled');
    }
    const prompt = `You are a financial assistant answering questions about ONE person's bank statement. Answer ONLY from the data below — if it isn't answerable from this data, say so plainly. Be concise, use Naira (₦), and never invent transactions.\n\n=== STATEMENT DATA ===\n${context}\n=== END DATA ===\n\nQuestion: ${question}`;

    const resp = await this.client.messages.create({
      model: this.config.askModel,
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    });
    return this.extractText(resp).trim();
  }

  private extractText(resp: any): string {
    if (!resp?.content) return '';
    return resp.content
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text)
      .join('')
      .trim();
  }

  private parseJsonArray(text: string): any[] | null {
    if (!text) return null;
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}
