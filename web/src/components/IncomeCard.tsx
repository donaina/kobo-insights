import { IncomeSummary } from '../lib/api';
import { formatNaira, formatNairaCompact, formatPercent } from '../lib/money';
import { SectionTitle } from './primitives';

export function IncomeCard({ income }: { income: IncomeSummary }) {
  const stabilityPct = Math.round(income.stability * 100);
  return (
    <div className="card card-pad">
      <SectionTitle hint="detected from credits">Income</SectionTitle>
      {income.monthlyIncome === 0 ? (
        <p className="text-sm text-ink-3">No recurring or salary-like income detected in this period.</p>
      ) : (
        <>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="label">Est. monthly</div>
              <div className="stat mt-1 text-2xl font-semibold text-success-500">
                {formatNairaCompact(income.monthlyIncome)}
              </div>
            </div>
            <div className="text-right">
              <div className="label">Stability</div>
              <div className="stat mt-1 text-lg font-semibold text-ink">{formatPercent(income.stability)}</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-night-600">
            <div
              className="h-full rounded-full bg-champagne-400"
              style={{ width: `${stabilityPct}%` }}
              title={`Month-to-month consistency: ${stabilityPct}%`}
            />
          </div>
          <ul className="mt-4 space-y-1.5">
            {income.sources.map((s) => (
              <li key={s.merchant} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-ink-2">{s.merchant}</span>
                <span className="stat shrink-0 text-ink-3">
                  {formatNaira(s.monthlyAmount)}/mo · {s.count}×
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
