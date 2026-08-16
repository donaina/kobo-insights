import { SpendClass, spendClassOf } from '../categorization/taxonomy';
import { InsightsReport } from '../insights/insights.service';

/**
 * Transparent, rules-based affordability signal. This is deliberately NOT a
 * machine-learning model over synthetic borrowers — every point of the score
 * traces to a named reason a human can read and argue with. It is shaped as an
 * explainable feature set + reason codes so it can later hand off to a real
 * credit-decisioning engine, but on its own it is a demo signal, not a credit
 * score and not financial advice.
 */

export type AffordabilityBand = 'A' | 'B' | 'C' | 'D' | 'E';
export type ReasonImpact = 'positive' | 'negative' | 'neutral';

export interface AffordabilityReason {
  code: string;
  title: string;
  impact: ReasonImpact;
  points: number; // signed contribution to the score
  detail: string;
}

export interface AffordabilityFeatures {
  monthlyIncome: number; // kobo
  incomeStability: number; // 0..1
  monthlyExpense: number; // kobo
  expenseToIncome: number | null; // ratio, null when no income detected
  essentialRatio: number; // essential outflow / total outflow
  discretionaryRatio: number; // discretionary outflow / total outflow
  savingsRate: number; // savings outflow / total income
  gamblingExposure: number; // betting outflow / total income
  debtBurden: number; // loan repayments / total income
  chargesPerMonth: number;
  netMonthly: number; // net cashflow / months
  avgBalance: number | null; // kobo, null when no running balance present
  minBalance: number | null;
}

export interface BalanceStats {
  avgBalance: number | null;
  minBalance: number | null;
}

export interface AffordabilitySnapshot {
  band: AffordabilityBand;
  score: number; // 0..100
  summary: string;
  features: AffordabilityFeatures;
  reasons: AffordabilityReason[];
  disclaimer: string;
}

const DISCLAIMER =
  'Explainable, rules-based signal computed only from this statement. Not a credit score, ' +
  'not financial advice. Demo uses synthetic data.';

function outflowByClass(report: InsightsReport): Record<SpendClass, number> {
  const totals: Record<SpendClass, number> = {
    income: 0,
    essential: 0,
    discretionary: 0,
    transfer: 0,
    savings: 0,
    charges: 0,
    debt: 0,
  };
  for (const c of report.categories) {
    totals[spendClassOf(c.category)] += c.outflow;
  }
  return totals;
}

export function computeFeatures(report: InsightsReport, balance: BalanceStats): AffordabilityFeatures {
  const months = Math.max(1, report.period.months);
  const totalOutflow = report.totals.outflow;
  const totalIncome = report.income.totalIncome;
  const byClass = outflowByClass(report);

  const betting = report.categories.find((c) => c.category === 'betting')?.outflow ?? 0;
  const charges = report.categories.find((c) => c.category === 'bank_charges')?.count ?? 0;

  const ratio = (n: number, d: number) => (d > 0 ? n / d : 0);

  return {
    monthlyIncome: report.income.monthlyIncome,
    incomeStability: report.income.stability,
    monthlyExpense: Math.round(totalOutflow / months),
    expenseToIncome:
      report.income.monthlyIncome > 0
        ? Math.round(totalOutflow / months) / report.income.monthlyIncome
        : null,
    essentialRatio: ratio(byClass.essential, totalOutflow),
    discretionaryRatio: ratio(byClass.discretionary, totalOutflow),
    savingsRate: ratio(byClass.savings, totalIncome),
    gamblingExposure: ratio(betting, totalIncome),
    debtBurden: ratio(byClass.debt, totalIncome),
    chargesPerMonth: charges / months,
    netMonthly: Math.round(report.totals.net / months),
    avgBalance: balance.avgBalance,
    minBalance: balance.minBalance,
  };
}
function bandOf(score: number): AffordabilityBand {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'E';
}

const NAIRA = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`;
const PCT = (r: number) => `${Math.round(r * 100)}%`;

/**
 * Score from a base of 50, applying signed, named adjustments. Every branch
 * emits a reason so the final score is fully reconstructable from the reasons.
 */
export function scoreAffordability(
  report: InsightsReport,
  balance: BalanceStats,
): AffordabilitySnapshot {
  const f = computeFeatures(report, balance);
  const reasons: AffordabilityReason[] = [];
  const add = (code: string, title: string, impact: ReasonImpact, points: number, detail: string) =>
    reasons.push({ code, title, impact, points, detail });

  // --- Income presence & level -------------------------------------------
  if (f.monthlyIncome <= 0) {
    add('NO_INCOME', 'No verifiable income', 'negative', -25,
      'No recurring or salary-like credits were detected in this statement.');
  } else {
    add('INCOME_DETECTED', 'Regular income detected', 'positive', 8,
      `Estimated monthly income of ${NAIRA(f.monthlyIncome)}.`);
    if (f.incomeStability >= 0.7) {
      add('INCOME_STABLE', 'Steady income', 'positive', 10,
        `Month-to-month income is consistent (stability ${PCT(f.incomeStability)}).`);
    } else if (f.incomeStability < 0.4) {
      add('INCOME_VOLATILE', 'Volatile income', 'negative', -8,
        `Income varies a lot between months (stability ${PCT(f.incomeStability)}).`);
    }
  }

  // --- Expense-to-income --------------------------------------------------
  if (f.expenseToIncome !== null) {
    if (f.expenseToIncome <= 0.7) {
      add('LIVES_WITHIN_MEANS', 'Spends well within income', 'positive', 14,
        `Monthly spend is ${PCT(f.expenseToIncome)} of income.`);
    } else if (f.expenseToIncome <= 0.95) {
      add('MODERATE_SPEND', 'Moderate spending headroom', 'neutral', 2,
        `Monthly spend is ${PCT(f.expenseToIncome)} of income.`);
    } else if (f.expenseToIncome <= 1.1) {
      add('SPENDS_ALL', 'Spends almost all income', 'negative', -10,
        `Monthly spend is ${PCT(f.expenseToIncome)} of income — little buffer.`);
    } else {
      add('OVERSPENDS', 'Spending exceeds income', 'negative', -18,
        `Monthly spend is ${PCT(f.expenseToIncome)} of income — burning through balances or borrowing.`);
    }
  }

  // --- Net cashflow -------------------------------------------------------
  if (f.netMonthly > 0) {
    add('POSITIVE_CASHFLOW', 'Positive monthly cashflow', 'positive', 6,
      `Net ${NAIRA(f.netMonthly)} left over per month on average.`);
  } else if (f.netMonthly < 0) {
    add('NEGATIVE_CASHFLOW', 'Negative monthly cashflow', 'negative', -8,
      `Spends ${NAIRA(-f.netMonthly)} more than it takes in per month on average.`);
  }

  // --- Savings behaviour --------------------------------------------------
  if (f.savingsRate >= 0.1) {
    add('SAVES_REGULARLY', 'Saves or invests regularly', 'positive', 10,
      `Sets aside ${PCT(f.savingsRate)} of income (savings/investment platforms).`);
  } else if (f.savingsRate > 0) {
    add('SOME_SAVINGS', 'Some savings activity', 'positive', 4,
      `Sets aside ${PCT(f.savingsRate)} of income.`);
  }

  // --- Gambling exposure --------------------------------------------------
  if (f.gamblingExposure >= 0.25) {
    add('HIGH_GAMBLING', 'High betting exposure', 'negative', -16,
      `Betting is ${PCT(f.gamblingExposure)} of income — a strong affordability risk.`);
  } else if (f.gamblingExposure >= 0.1) {
    add('SOME_GAMBLING', 'Notable betting activity', 'negative', -8,
      `Betting is ${PCT(f.gamblingExposure)} of income.`);
  }

  // --- Debt service -------------------------------------------------------
  if (f.debtBurden >= 0.35) {
    add('HIGH_DEBT_SERVICE', 'High loan-repayment burden', 'negative', -12,
      `Loan repayments are ${PCT(f.debtBurden)} of income.`);
  } else if (f.debtBurden >= 0.15) {
    add('MODERATE_DEBT_SERVICE', 'Moderate loan repayments', 'neutral', -3,
      `Loan repayments are ${PCT(f.debtBurden)} of income.`);
  }

  // --- Bank charges (financial-stress signal) -----------------------------
  if (f.chargesPerMonth >= 8) {
    add('FREQUENT_CHARGES', 'Frequent bank charges', 'negative', -6,
      `About ${f.chargesPerMonth.toFixed(1)} fee/charge entries per month.`);
  }

  // --- Balance buffer -----------------------------------------------------
  if (f.minBalance !== null && f.avgBalance !== null) {
    if (f.minBalance <= 0) {
      add('HITS_ZERO', 'Balance hits zero', 'negative', -10,
        'Account balance reached zero or negative during the period.');
    } else if (f.monthlyExpense > 0 && f.avgBalance >= f.monthlyExpense) {
      add('HEALTHY_BUFFER', 'Healthy balance buffer', 'positive', 8,
        `Average balance (${NAIRA(f.avgBalance)}) covers a full month of spending.`);
    } else if (f.monthlyExpense > 0 && f.avgBalance < f.monthlyExpense * 0.25) {
      add('THIN_BUFFER', 'Thin balance buffer', 'negative', -6,
        `Average balance (${NAIRA(f.avgBalance)}) is under a week of spending.`);
    }
  }

  const raw = reasons.reduce((s, r) => s + r.points, 50);
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const band = bandOf(score);

  reasons.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));

  return {
    band,
    score,
    summary: summarize(band, f),
    features: f,
    reasons,
    disclaimer: DISCLAIMER,
  };
}

function summarize(band: AffordabilityBand, f: AffordabilityFeatures): string {
  const income = f.monthlyIncome > 0 ? `${NAIRA(f.monthlyIncome)}/mo income` : 'no clear income';
  const spend =
    f.expenseToIncome !== null ? `spending ${PCT(f.expenseToIncome)} of it` : 'spending pattern only';
  const lead: Record<AffordabilityBand, string> = {
    A: 'Strong affordability signal',
    B: 'Good affordability signal',
    C: 'Fair affordability signal',
    D: 'Weak affordability signal',
    E: 'Poor affordability signal',
  };
  return `${lead[band]}: ${income}, ${spend}.`;
}

