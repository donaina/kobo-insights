import { CategorySummary } from '../lib/api';
import { formatNaira, formatNairaCompact } from '../lib/money';
import { categoryColor } from '../lib/categories';
import { SectionTitle } from './primitives';

/** SVG donut of spending by category (outflow only) + a ranked legend. */
export function CategoryDonut({ categories }: { categories: CategorySummary[] }) {
  const spend = categories.filter((c) => c.outflow > 0).sort((a, b) => b.outflow - a.outflow);
  const total = spend.reduce((s, c) => s + c.outflow, 0);
  if (total === 0) return null;

  const R = 16;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = spend.map((c) => {
    const frac = c.outflow / total;
    const seg = { c, frac, dash: frac * C, offset: offset * C };
    offset += frac;
    return seg;
  });

  return (
    <div className="card card-pad">
      <SectionTitle hint={`${spend.length} categories`}>Where the money goes</SectionTitle>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <svg viewBox="0 0 40 40" className="h-40 w-40 -rotate-90">
            <circle cx="20" cy="20" r={R} fill="none" stroke="rgba(148,163,184,0.10)" strokeWidth="6" />
            {arcs.map(({ c, dash, offset: o }) => (
              <circle
                key={c.category}
                cx="20"
                cy="20"
                r={R}
                fill="none"
                stroke={categoryColor(c.category)}
                strokeWidth="6"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-o}
              >
                <title>{`${c.label} · ${formatNaira(c.outflow)} (${((c.outflow / total) * 100).toFixed(1)}%)`}</title>
              </circle>
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
            <span className="text-[10px] uppercase tracking-wider text-ink-3">Spent</span>
            <span className="stat text-sm font-semibold text-ink">{formatNairaCompact(total)}</span>
          </div>
        </div>
        <ul className="grid w-full grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {arcs.slice(0, 10).map(({ c, frac }) => (
            <li key={c.category} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColor(c.category) }} />
                <span className="truncate text-ink-2">{c.label}</span>
              </span>
              <span className="stat shrink-0 text-ink-3">{(frac * 100).toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
