import { MonthlyCashflow } from '../lib/api';
import { formatNairaCompact, formatNaira } from '../lib/money';
import { SectionTitle } from './primitives';

/**
 * Hand-rolled SVG grouped bar chart (in vs out per month) — no chart library, to
 * keep the bundle lean and the rendering fully in our control.
 */
export function CashflowChart({ data }: { data: MonthlyCashflow[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.flatMap((d) => [d.inflow, d.outflow]), 1);

  const H = 180;
  const groupW = 100 / data.length;
  const barW = Math.min(22, groupW * 0.28);

  return (
    <div className="card card-pad">
      <SectionTitle hint="in vs out">Monthly cashflow</SectionTitle>
      <div className="flex items-center gap-4 pb-3 text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-success-500" /> In
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-error-500" /> Out
        </span>
      </div>
      <svg viewBox={`0 0 100 ${H + 24}`} className="w-full" preserveAspectRatio="none" role="img">
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line
            key={g}
            x1="0"
            x2="100"
            y1={H - g * H}
            y2={H - g * H}
            stroke="rgba(148,163,184,0.10)"
            strokeWidth="0.3"
          />
        ))}
        {data.map((d, i) => {
          const cx = i * groupW + groupW / 2;
          const inH = (d.inflow / max) * H;
          const outH = (d.outflow / max) * H;
          return (
            <g key={d.month}>
              <rect x={cx - barW - 1} y={H - inH} width={barW} height={inH} rx="1.5" fill="#10B981">
                <title>{`${d.month} · in ${formatNaira(d.inflow)}`}</title>
              </rect>
              <rect x={cx + 1} y={H - outH} width={barW} height={outH} rx="1.5" fill="#EF4444">
                <title>{`${d.month} · out ${formatNaira(d.outflow)}`}</title>
              </rect>
              <text x={cx} y={H + 16} textAnchor="middle" className="fill-ink-3" style={{ fontSize: 6 }}>
                {d.month.slice(5)}/{d.month.slice(2, 4)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        {data.map((d) => (
          <div key={d.month}>
            <div className="text-ink-3">{d.month}</div>
            <div className={`stat ${d.net < 0 ? 'text-error-500' : 'text-success-500'}`}>
              {d.net < 0 ? '' : '+'}
              {formatNairaCompact(d.net)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
