import { AffordabilitySnapshot, AffordabilityBand } from '../lib/api';
import { SectionTitle } from './primitives';

const BAND_COLOR: Record<AffordabilityBand, string> = {
  A: '#10B981',
  B: '#A3E635',
  C: '#E4C580',
  D: '#F59E0B',
  E: '#EF4444',
};

const IMPACT_COLOR = {
  positive: '#10B981',
  negative: '#EF4444',
  neutral: '#94A3B8',
} as const;

export function AffordabilityCard({ snapshot }: { snapshot: AffordabilitySnapshot }) {
  const color = BAND_COLOR[snapshot.band];
  return (
    <div className="card card-pad">
      <SectionTitle hint="rules-based · explainable">Affordability signal</SectionTitle>

      <div className="flex items-center gap-5">
        <div
          className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border"
          style={{ borderColor: `${color}66`, backgroundColor: `${color}14` }}
        >
          <span className="font-heading text-3xl font-bold" style={{ color }}>
            {snapshot.band}
          </span>
          <span className="stat text-[11px] text-ink-3">{snapshot.score}/100</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm text-ink-2">{snapshot.summary}</p>
          {/* score track */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-night-600">
            <div className="h-full rounded-full" style={{ width: `${snapshot.score}%`, backgroundColor: color }} />
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="label mb-2">Why</div>
        <ul className="space-y-2">
          {snapshot.reasons.map((r) => (
            <li key={r.code} className="flex items-start gap-2.5 text-sm">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: IMPACT_COLOR[r.impact] }}
              />
              <span className="min-w-0">
                <span className="font-medium text-ink">{r.title}</span>{' '}
                <span
                  className="stat text-xs"
                  style={{ color: IMPACT_COLOR[r.impact] }}
                >
                  {r.points > 0 ? `+${r.points}` : r.points}
                </span>
                <span className="block text-xs text-ink-3">{r.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-5 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-3">
        {snapshot.disclaimer}
      </p>
    </div>
  );
}
