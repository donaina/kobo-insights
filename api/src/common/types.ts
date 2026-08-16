export type Direction = 'DEBIT' | 'CREDIT';

/** A single normalized statement line, produced by the ingest layer. */
export interface NormalizedTxn {
  postedAt: Date;
  direction: Direction;
  amountKobo: number; // integer kobo, always positive
  narration: string;
  balanceAfterKobo?: number;
}
