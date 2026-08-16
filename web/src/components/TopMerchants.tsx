import { MerchantSummary } from '../lib/api';
import { formatNaira } from '../lib/money';
import { categoryLabel } from '../lib/categories';
import { CategoryTag, SectionTitle } from './primitives';

export function TopMerchants({ merchants }: { merchants: MerchantSummary[] }) {
  if (merchants.length === 0) return null;
  const max = Math.max(...merchants.map((m) => m.total), 1);
  return (
    <div className="card card-pad">
      <SectionTitle hint="by total spend">Top merchants</SectionTitle>
      <ul className="space-y-3">
        {merchants.map((m) => (
          <li key={`${m.merchant}-${m.category}`}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium text-ink">{m.merchant}</span>
                <CategoryTag category={m.category} label={categoryLabel(m.category)} />
              </span>
              <span className="stat shrink-0 text-ink-2">{formatNaira(m.total)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-night-600">
                <div
                  className="h-full rounded-full bg-champagne-500/70"
                  style={{ width: `${(m.total / max) * 100}%` }}
                />
              </div>
              <span className="stat w-10 shrink-0 text-right text-xs text-ink-3">{m.count}×</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
