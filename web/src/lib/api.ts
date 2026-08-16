/**
 * Typed API client. Types mirror the Nest payloads; all money fields are integer
 * kobo. The base URL is empty by default (dev proxy / same-origin), overridable
 * with VITE_API_BASE for a separately-hosted API.
 */
const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

export type Direction = 'DEBIT' | 'CREDIT';
export type CategorizedBy = 'RULES' | 'AI';
export type AffordabilityBand = 'A' | 'B' | 'C' | 'D' | 'E';
export type ReasonImpact = 'positive' | 'negative' | 'neutral';

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

export interface TxnRow {
  id: string;
  postedAt: string;
  direction: Direction;
  amount: number;
  narration: string;
  balanceAfter: number | null;
  category: string | null;
  merchant: string | null;
  categoryConfidence: number | null;
  categorizedBy: CategorizedBy | null;
}

export interface StatementDetail extends StatementSummary {
  openingBalance: number | null;
  closingBalance: number | null;
  transactions: TxnRow[];
}

export interface MonthlyCashflow {
  month: string;
  inflow: number;
  outflow: number;
  net: number;
}
export interface CategorySummary {
  category: string;
  label: string;
  spendClass: string;
  outflow: number;
  inflow: number;
  count: number;
}
export interface MerchantSummary {
  merchant: string;
  category: string;
  total: number;
  count: number;
}
export interface RecurringItem {
  merchant: string;
  category: string;
  label: string;
  typicalAmount: number;
  count: number;
  cadence: 'weekly' | 'biweekly' | 'monthly' | 'irregular';
  monthlyEquivalent: number;
}
export interface IncomeSummary {
  monthlyIncome: number;
  totalIncome: number;
  months: number;
  stability: number;
  sources: { merchant: string; total: number; count: number; monthlyAmount: number }[];
}
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

export interface AffordabilityReason {
  code: string;
  title: string;
  impact: ReasonImpact;
  points: number;
  detail: string;
}
export interface AffordabilitySnapshot {
  band: AffordabilityBand;
  score: number;
  summary: string;
  features: Record<string, number | null>;
  reasons: AffordabilityReason[];
  disclaimer: string;
}

export interface IngestResult {
  statementId: string;
  label: string;
  transactions: number;
  skipped: number;
  categorization: { total: number; byRules: number; byAi: number; uncategorized: number };
}

export interface AskResult {
  answer: string;
  aiEnabled: boolean;
  question: string;
}

export interface Health {
  status: string;
  aiEnabled: boolean;
  counts: { statements: number; transactions: number };
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => req<Health>('/health'),
  listStatements: () => req<StatementSummary[]>('/statements'),
  getStatement: (id: string) => req<StatementDetail>(`/statements/${id}`),
  insights: (id: string) => req<InsightsReport>(`/statements/${id}/insights`),
  affordability: (id: string) => req<AffordabilitySnapshot>(`/statements/${id}/affordability`),
  ask: (id: string, question: string) =>
    req<AskResult>(`/statements/${id}/ask`, { method: 'POST', body: JSON.stringify({ question }) }),
  upload: (input: { label: string; csv: string; bankHint?: string; accountName?: string }) =>
    req<IngestResult>('/statements', { method: 'POST', body: JSON.stringify(input) }),
  remove: (id: string) => req<{ deleted: true }>(`/statements/${id}`, { method: 'DELETE' }),
};
