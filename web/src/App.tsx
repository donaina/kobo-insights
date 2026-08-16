import { useCallback, useEffect, useState } from 'react';
import {
  api,
  AffordabilitySnapshot,
  Health,
  InsightsReport,
  StatementDetail,
  StatementSummary,
} from './lib/api';
import { SummaryCards } from './components/SummaryCards';
import { CashflowChart } from './components/CashflowChart';
import { CategoryDonut } from './components/CategoryDonut';
import { IncomeCard } from './components/IncomeCard';
import { AffordabilityCard } from './components/AffordabilityCard';
import { TopMerchants } from './components/TopMerchants';
import { RecurringList } from './components/RecurringList';
import { TransactionsTable } from './components/TransactionsTable';
import { AskPanel } from './components/AskPanel';
import { UploadStatement } from './components/UploadStatement';
import { Spinner } from './components/primitives';

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [statements, setStatements] = useState<StatementSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<StatementDetail | null>(null);
  const [insights, setInsights] = useState<InsightsReport | null>(null);
  const [affordability, setAffordability] = useState<AffordabilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatements = useCallback(async () => {
    const list = await api.listStatements();
    setStatements(list);
    return list;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [h, list] = await Promise.all([api.health(), loadStatements()]);
        setHealth(h);
        if (list.length) setSelectedId(list[0].id);
        else setLoading(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to reach the API. Is it running on port 3001?');
        setLoading(false);
      }
    })();
  }, [loadStatements]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [d, ins, aff] = await Promise.all([
          api.getStatement(selectedId),
          api.insights(selectedId),
          api.affordability(selectedId),
        ]);
        if (cancelled) return;
        setDetail(d);
        setInsights(ins);
        setAffordability(aff);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load statement.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function handleUploaded(statementId: string) {
    await loadStatements();
    setSelectedId(statementId);
  }

  const aiEnabled = health?.aiEnabled ?? false;
  const ready = detail && insights && affordability;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Kobo <span className="text-champagne-400">Insights</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-ink-2">
            Transaction intelligence for Nigerian bank statements — categorization, cash-flow, recurring detection and
            an explainable affordability signal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {statements.length > 0 && (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded-lg border border-line bg-night-900/60 px-3 py-2 text-sm text-ink-2 focus:border-champagne-500/50 focus:outline-none"
            >
              {statements.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} ({s.txnCount})
                </option>
              ))}
            </select>
          )}
          <UploadStatement onUploaded={(r) => handleUploaded(r.statementId)} />
        </div>
      </header>

      {error && (
        <div className="card card-pad mb-6 border-error-500/30 bg-error-500/5 text-sm text-error-500">{error}</div>
      )}

      {loading && (
        <div className="flex justify-center py-24">
          <Spinner label="Crunching transactions…" />
        </div>
      )}

      {!loading && !ready && !error && (
        <div className="card card-pad text-center text-ink-2">
          No statements yet. Upload a CSV to get started, or seed the sample with{' '}
          <code className="rounded bg-night-900/70 px-1 py-0.5 text-xs text-champagne-200">npm run seed</code> in the
          API.
        </div>
      )}

      {!loading && ready && (
        <div className="space-y-6 animate-fadeIn">
          <SummaryCards report={insights} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CashflowChart data={insights.cashflow} />
            </div>
            <IncomeCard income={insights.income} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <CategoryDonut categories={insights.categories} />
            <AffordabilityCard snapshot={affordability} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <TopMerchants merchants={insights.topMerchants} />
            <RecurringList items={insights.recurring} />
          </div>

          <AskPanel statementId={detail.id} aiEnabled={aiEnabled} />

          <TransactionsTable txns={detail.transactions} />

          <footer className="border-t border-line pt-6 text-center text-xs leading-relaxed text-ink-3">
            Demo uses synthetic data. Money is handled as integer kobo end-to-end. Categorization runs on a
            deterministic rule engine
            {aiEnabled ? ', upgraded by the optional AI layer' : ' (optional AI layer off)'}.
          </footer>
        </div>
      )}
    </div>
  );
}
