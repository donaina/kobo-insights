import { NormalizedTxn, Direction } from '../common/types';
import { nairaToKobo } from '../common/money';

/**
 * Small, dependency-free statement CSV reader. Nigerian bank statement exports
 * vary a lot, so this is deliberately tolerant: it sniffs the header row for
 * the columns it needs and supports both the common "Debit / Credit" two-column
 * layout and a single signed/typed "Amount" column.
 */

export interface ParsedStatement {
  txns: NormalizedTxn[];
  periodStart?: Date;
  periodEnd?: Date;
  openingBalance?: number;
  closingBalance?: number;
  skipped: number;
}

/** RFC-4180-ish splitter that respects double-quoted fields containing commas. */
export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Parse the date formats Nigerian statements actually use. Day-first. */
export function parseStatementDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;

  // ISO: 2026-01-31 (optionally with time)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return utc(+iso[1], +iso[2], +iso[3]);

  // DD-Mon-YYYY / DD Mon YYYY  (12-Jan-2026, 12 JAN 26)
  const named = s.match(/^(\d{1,2})[\s\-/]+([A-Za-z]{3,})[\s\-/]+(\d{2,4})/);
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (month) return utc(fullYear(+named[3]), month, +named[1]);
  }

  // DD/MM/YYYY or DD-MM-YYYY (day-first, the Nigerian convention)
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (dmy) {
    let day = +dmy[1];
    let month = +dmy[2];
    // If the first field can't be a day but the second can, it was month-first.
    if (day > 12 && month <= 12) {
      /* already day-first */
    } else if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }
    return utc(fullYear(+dmy[3]), month, day);
  }
  return null;
}

function fullYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

function utc(y: number, m: number, d: number): Date | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Parse a money cell to a signed naira number. Handles ₦/N/NGN symbols, thousands
 * commas, parentheses or trailing DR/CR for sign. Returns null if not a number.
 */
export function parseNairaAmount(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }
  if (/\bDR\b/i.test(s)) sign = -1;
  if (/\bCR\b/i.test(s)) sign = 1;
  s = s.replace(/NGN|₦|CR|DR/gi, '').replace(/[,\s]/g, '').replace(/[^0-9.\-]/g, '');
  if (s === '' || s === '-' || s === '.') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return sign * n;
}

function findColumn(header: string[], patterns: RegExp[]): number {
  for (let i = 0; i < header.length; i++) {
    const cell = header[i].trim().toLowerCase();
    if (patterns.some((p) => p.test(cell))) return i;
  }
  return -1;
}

/** Parse a full statement CSV into normalized transactions + period/balance metadata. */
export function parseStatementCsv(text: string): ParsedStatement {
  const grid = splitCsv(text);
  if (grid.length < 2) return { txns: [], skipped: 0 };

  const header = grid[0];
  const dateCol = findColumn(header, [/date/]);
  const narrCol = findColumn(header, [/narration|description|details|remarks|particulars|transaction detail/]);
  const debitCol = findColumn(header, [/debit|withdrawal|money out|outflow|^dr$/]);
  const creditCol = findColumn(header, [/credit|lodg|deposit|money in|inflow|^cr$/]);
  const amountCol = findColumn(header, [/amount|value/]);
  const balanceCol = findColumn(header, [/balance/]);
  const typeCol = findColumn(header, [/type|dr\/cr|drcr/]);

  if (dateCol === -1 || narrCol === -1) {
    throw new Error('CSV must have a recognizable date column and a narration/description column');
  }
  const hasDebitCredit = debitCol !== -1 && creditCol !== -1;
  if (!hasDebitCredit && amountCol === -1) {
    throw new Error('CSV must have either Debit and Credit columns, or a single Amount column');
  }

  const txns: NormalizedTxn[] = [];
  let skipped = 0;

  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    const postedAt = parseStatementDate(cells[dateCol] ?? '');
    const narration = (cells[narrCol] ?? '').trim();
    if (!postedAt || !narration) {
      skipped++;
      continue;
    }

    let direction: Direction | null = null;
    let naira: number | null = null;

    if (hasDebitCredit) {
      const debit = parseNairaAmount(cells[debitCol] ?? '');
      const credit = parseNairaAmount(cells[creditCol] ?? '');
      if (debit && Math.abs(debit) > 0) {
        direction = 'DEBIT';
        naira = Math.abs(debit);
      } else if (credit && Math.abs(credit) > 0) {
        direction = 'CREDIT';
        naira = Math.abs(credit);
      }
    } else {
      const amt = parseNairaAmount(cells[amountCol] ?? '');
      if (amt !== null && amt !== 0) {
        const typeVal = typeCol !== -1 ? (cells[typeCol] ?? '').trim().toLowerCase() : '';
        if (typeVal) {
          direction = /^c|cr|credit|deposit|inflow/.test(typeVal) ? 'CREDIT' : 'DEBIT';
        } else {
          direction = amt < 0 ? 'DEBIT' : 'CREDIT';
        }
        naira = Math.abs(amt);
      }
    }

    if (!direction || naira === null || naira === 0) {
      skipped++;
      continue;
    }

    const balanceRaw = balanceCol !== -1 ? parseNairaAmount(cells[balanceCol] ?? '') : null;
    txns.push({
      postedAt,
      direction,
      amountKobo: nairaToKobo(naira),
      narration,
      balanceAfterKobo: balanceRaw !== null ? nairaToKobo(Math.abs(balanceRaw)) : undefined,
    });
  }

  txns.sort((a, b) => a.postedAt.getTime() - b.postedAt.getTime());

  const result: ParsedStatement = { txns, skipped };
  if (txns.length > 0) {
    result.periodStart = txns[0].postedAt;
    result.periodEnd = txns[txns.length - 1].postedAt;
    const last = txns[txns.length - 1];
    const first = txns[0];
    if (last.balanceAfterKobo !== undefined) result.closingBalance = last.balanceAfterKobo;
    if (first.balanceAfterKobo !== undefined) {
      const signed = first.direction === 'CREDIT' ? first.amountKobo : -first.amountKobo;
      result.openingBalance = first.balanceAfterKobo - signed;
    }
  }
  return result;
}
