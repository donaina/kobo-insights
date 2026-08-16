import { RecurringItem } from '../lib/api';
import { formatNaira } from '../lib/money';
import { CADENCE_LABEL } from '../lib/categories';
import { CategoryTag, SectionTitle } from './primitives';

export function RecurringList({ items }: { items: RecurringItem[] }) {
  const monthlyTotal = items.reduce((s, r) => s + r.monthlyEquivalent, 0);
  return (
    <div className="card card-pad">
      <SectionTitle hint={items.length ? `≈ ${formatNaira(monthlyTotal)}/mo` : undefined}>
        Recurring &amp; subscriptions
      </SectionTitle>
      {items.length === 0 ? (
        <p className="text-sm text-ink-3">No recurring payments detected in this period.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((r) => (
            <li key={`${r.merchant}-${r.category}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-ink">{r.label}</span>
                  <CategoryTag category={r.category} label={CADENCE_LABEL[r.cadence] ?? r.cadence} />
                </div>
                <div className="stat mt-0.5 text-xs text-ink-3">
                  {formatNaira(r.typicalAmount)} × {r.count}
                </div>
              </div>
              <span className="stat shrink-0 text-sm text-ink-2">{formatNaira(r.monthlyEquivalent)}/mo</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
