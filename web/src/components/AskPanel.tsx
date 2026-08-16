import { FormEvent, useState } from 'react';
import { api, AskResult } from '../lib/api';
import { SectionTitle, Spinner } from './primitives';

const SUGGESTIONS = [
  'How much did I spend on betting?',
  'What are my biggest recurring bills?',
  'Can I afford a ₦50,000 monthly loan repayment?',
  'Where does most of my money go?',
];

export function AskPanel({ statementId, aiEnabled }: { statementId: string; aiEnabled: boolean }) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.ask(statementId, trimmed));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit(question);
  }

  return (
    <div className="card card-pad">
      <SectionTitle hint={aiEnabled ? 'AI enabled' : 'AI off'}>Ask your statement</SectionTitle>

      {!aiEnabled && (
        <div className="mb-4 rounded-lg border border-champagne-500/25 bg-champagne-500/5 px-4 py-3 text-sm text-ink-2">
          <span className="font-medium text-champagne-300">AI isn&apos;t configured.</span> Set{' '}
          <code className="rounded bg-night-900/70 px-1 py-0.5 text-xs text-champagne-200">ANTHROPIC_API_KEY</code>{' '}
          in <code className="rounded bg-night-900/70 px-1 py-0.5 text-xs text-champagne-200">api/.env</code> to ask
          free-form questions. Everything else on this dashboard runs fully offline.
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={aiEnabled ? 'Ask anything about this statement…' : 'e.g. How much did I spend on betting?'}
          className="w-full rounded-lg border border-line bg-night-900/60 px-3 py-2.5 text-sm text-ink placeholder:text-ink-3 focus:border-champagne-500/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="shrink-0 rounded-lg bg-champagne-500 px-5 py-2.5 text-sm font-semibold text-night-950 transition hover:bg-champagne-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ask
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setQuestion(s);
              submit(s);
            }}
            className="chip transition hover:border-champagne-500/40 hover:text-ink"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {loading && <Spinner label="Thinking…" />}
        {error && <p className="text-sm text-error-500">{error}</p>}
        {result && !loading && (
          <div className="animate-fadeIn rounded-lg border border-line bg-night-900/40 p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{result.answer}</p>
          </div>
        )}
      </div>
    </div>
  );
}
