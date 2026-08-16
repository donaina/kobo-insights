/** Client-side money display. The API speaks integer KOBO; naira is display-only. */

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

/** "₦1,234.56" — full precision, for tables and exact figures. */
export function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "₦1.2m" / "₦450k" — compact, for headline cards and axes. */
export function formatNairaCompact(kobo: number): string {
  const naira = kobo / 100;
  const abs = Math.abs(naira);
  const sign = naira < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}₦${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}m`;
  if (abs >= 1_000) return `${sign}₦${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 0)}k`;
  return `${sign}₦${abs.toFixed(0)}`;
}

export function formatPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}
