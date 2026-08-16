import { InsightsReport } from '../insights/insights.service';
import { AffordabilitySnapshot } from '../affordability/affordability.util';
import { NormalizedTxn } from '../common/types';
import { koboToNairaString } from '../common/money';
import { CATEGORIES } from '../categorization/taxonomy';

/**
 * Builds a compact, structured context string for the "Ask your statement"
 * feature. It never dumps thousands of raw rows: it sends the aggregates the
 * insights engine already computed, the affordability reasons, and a capped
 * slice of the largest transactions so the model can answer specifics without
 * an unbounded prompt.
 */

const N = (kobo: number) => `₦${koboToNairaString(kobo)}`;

export interface AskContextParts {
  report: InsightsReport;
  affordability: AffordabilitySnapshot;
  sampleTxns: (NormalizedTxn & { category: string | null; merchant: string | null })[];
  txnCap: number;
}

export function buildAskContext(parts: AskContextParts): string {
  const { report, affordability, sampleTxns, txnCap } = parts;
  const lines: string[] = [];

  lines.push(`Statement: ${report.label}`);
  lines.push(
    `Period: ${report.period.start?.slice(0, 10) ?? '?'} to ${report.period.end?.slice(0, 10) ?? '?'} ` +
      `(${report.period.months} month(s))`,
  );
  lines.push(
    `Totals: in ${N(report.totals.inflow)}, out ${N(report.totals.outflow)}, ` +
      `net ${N(report.totals.net)}, ${report.totals.txnCount} transactions`,
  );

  lines.push('');
  lines.push('Monthly cashflow:');
  for (const m of report.cashflow) {
    lines.push(`  ${m.month}: in ${N(m.inflow)}, out ${N(m.outflow)}, net ${N(m.net)}`);
  }

  lines.push('');
  lines.push('Spending by category (by outflow):');
  for (const c of report.categories.filter((c) => c.outflow > 0)) {
    lines.push(`  ${c.label}: ${N(c.outflow)} across ${c.count} txns`);
  }

  lines.push('');
  lines.push('Income:');
  lines.push(
    `  ~${N(report.income.monthlyIncome)}/month, total ${N(report.income.totalIncome)}, ` +
      `stability ${Math.round(report.income.stability * 100)}%`,
  );
  for (const s of report.income.sources) {
    lines.push(`  source: ${s.merchant} — ${N(s.monthlyAmount)}/mo (${s.count} credits)`);
  }

  if (report.recurring.length) {
    lines.push('');
    lines.push('Recurring / subscriptions:');
    for (const r of report.recurring) {
      lines.push(`  ${r.merchant} (${r.label}): ~${N(r.typicalAmount)} ${r.cadence}, ${N(r.monthlyEquivalent)}/mo`);
    }
  }

  if (report.topMerchants.length) {
    lines.push('');
    lines.push('Top merchants (by outflow):');
    for (const m of report.topMerchants) {
      lines.push(`  ${m.merchant}: ${N(m.total)} across ${m.count} txns`);
    }
  }

  lines.push('');
  lines.push(
    `Affordability signal: band ${affordability.band} (score ${affordability.score}/100). ${affordability.summary}`,
  );
  lines.push('Reasons:');
  for (const r of affordability.reasons) {
    lines.push(`  [${r.impact}] ${r.title}: ${r.detail}`);
  }

  lines.push('');
  lines.push(`Largest ${Math.min(txnCap, sampleTxns.length)} transactions (of ${report.totals.txnCount}):`);
  for (const t of sampleTxns.slice(0, txnCap)) {
    const cat = t.category ? CATEGORIES[t.category as keyof typeof CATEGORIES]?.label ?? t.category : 'uncategorized';
    lines.push(
      `  ${t.postedAt.toISOString().slice(0, 10)} ${t.direction} ${N(t.amountKobo)} — ` +
        `${cat}${t.merchant ? ` / ${t.merchant}` : ''} — ${t.narration.replace(/\s+/g, ' ').trim().slice(0, 80)}`,
    );
  }

  return lines.join('\n');
}
