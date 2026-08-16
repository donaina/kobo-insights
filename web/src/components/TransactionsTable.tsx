import { useMemo, useState } from 'react';
import { TxnRow } from '../lib/api';
import { formatNaira } from '../lib/money';
import { categoryLabel } from '../lib/categories';
import { CategoryTag, SectionTitle, SourceBadge } from './primitives';

const PAGE = 25;

export function TransactionsTable({ txns }: { txns: TxnRow[] }) {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [limit, setLimit] = useState(PAGE);

  const categories = useMemo(() => {
    const set = new Set<string>();
    txns.forEach((t) => t.category && set.add(t.category));
    return Array.from(set).sort();
  }, [txns]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return txns.filter((t) => {
      if (cat !== 'all' && t.category !== cat) return false;
      if (!q) return true;
      return (
        t.narration.toLowerCase().includes(q) ||
        (t.merchant?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [txns, query, cat]);

  const shown = filtered.slice(0, limit);

  return (
    <div className="card card-pad">
      <SectionTitle hint={`${filtered.length} of ${txns.length}`}>Transactions</SectionTitle>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="Search narration or merchant…"
          className="w-full rounded-lg border border-line bg-night-900/60 px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-champagne-500/50 focus:outline-none"
        />
        <select
          value={cat}
          onChange={(e) => {
            setCat(e.target.value);
            setLimit(PAGE);
          }}
          className="rounded-lg border border-line bg-night-900/60 px-3 py-2 text-sm text-ink-2 focus:border-champagne-500/50 focus:outline-none"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
      </div>

      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
              <th className="px-2 py-2 font-medium">Date</th>
              <th className="px-2 py-2 font-medium">Narration</th>
              <th className="px-2 py-2 font-medium">Category</th>
              <th className="px-2 py-2 text-center font-medium">By</th>
              <th className="px-2 py-2 text-right font-medium">Amount</th>
              <th className="px-2 py-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.id} className="border-b border-line/60 last:border-0 hover:bg-night-700/40">
                <td className="whitespace-nowrap px-2 py-2.5 text-ink-3">{t.postedAt.slice(0, 10)}</td>
                <td className="max-w-[280px] px-2 py-2.5">
                  <div className="truncate text-ink" title={t.narration}>
                    {t.merchant ?? t.narration}
                  </div>
                  {t.merchant && (
                    <div className="truncate text-xs text-ink-3" title={t.narration}>
                      {t.narration}
                    </div>
                  )}
                </td>
                <td className="px-2 py-2.5">
                  {t.category ? <CategoryTag category={t.category} label={categoryLabel(t.category)} /> : '—'}
                </td>
                <td className="px-2 py-2.5 text-center">
                  <SourceBadge by={t.categorizedBy} />
                </td>
                <td
                  className={`stat whitespace-nowrap px-2 py-2.5 text-right ${
                    t.direction === 'CREDIT' ? 'text-success-500' : 'text-ink'
                  }`}
                >
                  {t.direction === 'CREDIT' ? '+' : '−'}
                  {formatNaira(t.amount)}
                </td>
                <td className="stat whitespace-nowrap px-2 py-2.5 text-right text-ink-3">
                  {t.balanceAfter == null ? '—' : formatNaira(t.balanceAfter)}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-8 text-center text-ink-3">
                  No matching transactions.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {limit < filtered.length && (
        <button
          onClick={() => setLimit((n) => n + PAGE)}
          className="mt-4 w-full rounded-lg border border-line py-2 text-sm text-ink-2 transition hover:border-champagne-500/40 hover:text-ink"
        >
          Show more ({filtered.length - limit} remaining)
        </button>
      )}
    </div>
  );
}
