/**
 * Money helpers. Every monetary amount in this service is an integer number
 * of KOBO (1 naira = 100 kobo). There is no floating-point money anywhere:
 * amounts are parsed to integer kobo at the boundary, validated here, and stay
 * integers through categorization, aggregation and scoring. Naira conversion
 * exists only for display.
 */

export class MoneyError extends Error {}

/**
 * Sanity ceiling for a single transaction (₦10,000,000,000.00). Statements can
 * legitimately carry large figures, so this is a guard against parse garbage
 * (a mis-read column, a concatenated number), not a business limit.
 */
export const MAX_KOBO = 1_000_000_000_000;

/**
 * Validate and normalise an amount that is expected to already be in kobo.
 * Rejects non-integers (sub-kobo), non-positive values, NaN/Infinity and
 * absurdly large values before they can enter the ledger of record.
 */
export function assertKobo(amount: unknown): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new MoneyError('amount must be a finite number of kobo');
  }
  if (!Number.isInteger(amount)) {
    throw new MoneyError('amount must be a whole number of kobo (no sub-kobo values)');
  }
  if (amount <= 0) {
    throw new MoneyError('amount must be greater than zero');
  }
  if (amount > MAX_KOBO) {
    throw new MoneyError(`amount exceeds the sanity limit of ${MAX_KOBO} kobo`);
  }
  return amount;
}

/** Convert naira (may have up to 2 dp) to integer kobo, rejecting sub-kobo. */
export function nairaToKobo(naira: number): number {
  if (typeof naira !== 'number' || !Number.isFinite(naira)) {
    throw new MoneyError('naira must be a finite number');
  }
  const kobo = Math.round(naira * 100);
  // Guard against sub-kobo precision (e.g. 10.001 -> 1000.1 rounded to 1000)
  if (Math.abs(naira * 100 - kobo) > 1e-6) {
    throw new MoneyError('naira has sub-kobo precision');
  }
  return kobo;
}

/** Display helper: integer kobo -> naira string like "1,234.56". */
export function koboToNairaString(kobo: number): string {
  const naira = kobo / 100;
  return naira.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Integer kobo -> naira number, for ratios and display payloads. */
export function koboToNaira(kobo: number): number {
  return kobo / 100;
}
