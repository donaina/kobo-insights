import { ReactNode } from 'react';
import { categoryColor } from '../lib/categories';

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="font-heading text-lg font-semibold text-ink">{children}</h2>
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </div>
  );
}

/** A colored category pill. */
export function CategoryTag({ category, label }: { category: string; label: string }) {
  const color = categoryColor(category);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

/** RULES vs AI provenance badge for a transaction row. */
export function SourceBadge({ by }: { by: 'RULES' | 'AI' | null }) {
  if (!by) return <span className="text-ink-3">—</span>;
  const isAi = by === 'AI';
  return (
    <span
      className={`chip !px-2 !py-0.5 ${
        isAi
          ? 'border-champagne-500/40 text-champagne-300'
          : 'border-line-strong text-ink-3'
      }`}
      title={isAi ? 'Categorized by the optional AI layer' : 'Categorized by the deterministic rule engine'}
    >
      {isAi ? 'AI' : 'Rules'}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-ink-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-champagne-400" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
