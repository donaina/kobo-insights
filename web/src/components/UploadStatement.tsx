import { useRef, useState } from 'react';
import { api, IngestResult } from '../lib/api';

export function UploadStatement({ onUploaded }: { onUploaded: (r: IngestResult) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setError(null);
    setFileName(file.name);
    if (!label) setLabel(file.name.replace(/\.csv$/i, ''));
    setCsv(await file.text());
  }

  async function submit() {
    if (!csv.trim() || !label.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.upload({ label: label.trim(), csv });
      onUploaded(result);
      // reset
      setOpen(false);
      setLabel('');
      setCsv('');
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="chip transition hover:border-champagne-500/40 hover:text-ink"
      >
        + Upload CSV
      </button>
    );
  }

  return (
    <div className="card card-pad w-full animate-slideInUp">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold text-ink">Upload a statement</h3>
        <button onClick={() => setOpen(false)} className="text-sm text-ink-3 hover:text-ink">
          Cancel
        </button>
      </div>

      <p className="mb-4 text-xs text-ink-3">
        Expected columns: <span className="text-ink-2">Date, Narration, Debit, Credit, Balance</span> (a single signed
        Amount column also works). Synthetic / anonymized data only.
      </p>

      <div className="flex flex-col gap-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Statement label (e.g. My GTBank — Q2)"
          className="rounded-lg border border-line bg-night-900/60 px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-champagne-500/50 focus:outline-none"
        />

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong bg-night-900/40 px-3 py-3 text-sm transition hover:border-champagne-500/40">
          <span className={fileName ? 'text-ink' : 'text-ink-3'}>{fileName || 'Choose a .csv file…'}</span>
          <span className="chip">Browse</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>

        {error && <p className="text-sm text-error-500">{error}</p>}

        <button
          onClick={submit}
          disabled={busy || !csv.trim() || !label.trim()}
          className="rounded-lg bg-champagne-500 py-2.5 text-sm font-semibold text-night-950 transition hover:bg-champagne-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Analyzing…' : 'Analyze statement'}
        </button>
      </div>
    </div>
  );
}
