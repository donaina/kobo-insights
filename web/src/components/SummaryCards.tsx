import { InsightsReport } from '../lib/api';
import { formatNairaCompact } from '../lib/money';

function Card({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'in' | 'out' | 'net';
}) {
  const color =
    accent === 'in'
      ? 'text-success-500'
      : accent === 'out'
        ? 'text-error-500'
        : accent === 'net'
          ? 'text-champagne-300'
          : 'text-ink';
  return (
    <div className="card card-pad animate-slideInUp">
      <div className="label">{label}</div>
      <div className={`stat mt-2 text-2xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

export function SummaryCards({ report }: { report: InsightsReport }) {
  const { totals, period } = report;
  const start = period.start?.slice(0, 10) ?? '—';
  const end = period.end?.slice(0, 10) ?? '—';
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Card label="Money in" value={formatNairaCompact(totals.inflow)} sub={`${period.months} month(s)`} accent="in" />
      <Card label="Money out" value={formatNairaCompact(totals.outflow)} sub={`${totals.txnCount} transactions`} accent="out" />
      <Card
        label="Net"
        value={`${totals.net < 0 ? '' : '+'}${formatNairaCompact(totals.net)}`}
        sub={totals.net < 0 ? 'spending exceeds income' : 'positive cashflow'}
        accent="net"
      />
      <Card label="Period" value={`${start.slice(5)} → ${end.slice(5)}`} sub={`${start.slice(0, 4)}`} />
    </div>
  );
}
