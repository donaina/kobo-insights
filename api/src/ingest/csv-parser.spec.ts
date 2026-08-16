import {
  splitCsv,
  parseStatementDate,
  parseNairaAmount,
  parseStatementCsv,
  ParsedStatement,
} from './csv-parser';

describe('CSV parser utilities', () => {
  describe('splitCsv (RFC-4180-ish)', () => {
    it('splits simple rows', () => {
      expect(splitCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
    });

    it('handles quoted fields with commas', () => {
      const res = splitCsv('"a,b",c\n"x,y",z');
      expect(res).toEqual([['a,b', 'c'], ['x,y', 'z']]);
    });

    it('handles escaped quotes', () => {
      const res = splitCsv('"a""b",c');
      expect(res).toEqual([['a"b', 'c']]);
    });

    it('skips empty lines', () => {
      const res = splitCsv('a,b\n\nc,d');
      expect(res.length).toBe(2);
    });

    it('handles CRLF', () => {
      expect(splitCsv('a,b\r\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
    });
  });

  describe('parseStatementDate', () => {
    it('parses ISO (2026-01-31)', () => {
      const d = parseStatementDate('2026-01-31');
      expect(d).toEqual(new Date(Date.UTC(2026, 0, 31)));
    });

    it('parses ISO with time (date part only; time not captured)', () => {
      const d = parseStatementDate('2026-01-31 14:30:00');
      // Current parser extracts date only; time component is ignored
      expect(d).toEqual(new Date(Date.UTC(2026, 0, 31)));
    });

    it('parses DD-Mon-YYYY (12-Jan-2026)', () => {
      const d = parseStatementDate('12-Jan-2026');
      expect(d).toEqual(new Date(Date.UTC(2026, 0, 12)));
    });

    it('parses DD Mon YYYY (12 JAN 26)', () => {
      const d = parseStatementDate('12 JAN 26');
      expect(d).toEqual(new Date(Date.UTC(2026, 0, 12)));
    });

    it('parses DD/MM/YYYY (day-first Nigerian convention)', () => {
      const d = parseStatementDate('31/01/2026');
      expect(d).toEqual(new Date(Date.UTC(2026, 0, 31)));
    });

    it('parses DD-MM-YYYY', () => {
      const d = parseStatementDate('31-01-2026');
      expect(d).toEqual(new Date(Date.UTC(2026, 0, 31)));
    });

    it('auto-flips MM/DD when day > 12', () => {
      const d = parseStatementDate('12/31/2026'); // month-first US, but day=31 flips
      expect(d).toEqual(new Date(Date.UTC(2026, 11, 31))); // 31 Dec
    });

    it('returns null for garbage', () => {
      expect(parseStatementDate('')).toBeNull();
      expect(parseStatementDate('not-a-date')).toBeNull();
    });
  });

  describe('parseNairaAmount', () => {
    it('parses plain numbers', () => {
      expect(parseNairaAmount('1000')).toBe(1000);
      expect(parseNairaAmount('1,234.56')).toBe(1234.56);
    });

    it('handles naira symbols', () => {
      expect(parseNairaAmount('₦1,000.00')).toBe(1000);
      expect(parseNairaAmount('NGN 500.00')).toBe(500);
      expect(parseNairaAmount('N100')).toBe(100);
    });

    it('handles parentheses = negative', () => {
      expect(parseNairaAmount('(1,000.00)')).toBe(-1000);
    });

    it('handles DR/CR suffixes', () => {
      expect(parseNairaAmount('1000 DR')).toBe(-1000);
      expect(parseNairaAmount('1000 CR')).toBe(1000);
    });

    it('returns null for non-numbers', () => {
      expect(parseNairaAmount('')).toBeNull();
      expect(parseNairaAmount('ABC')).toBeNull();
    });
  });

  describe('parseStatementCsv (integration)', () => {
    it('parses the exact synthetic sample header (Date,Narration,Debit,Credit,Balance)', () => {
      const csv = `Date,Narration,Debit,Credit,Balance
12-May-2025,Salary Credit,,520000,850000
13-May-2025,ATM Withdrawal,20000,,830000
14-May-2025,POS Purchase Shoprite,15000,,815000`;
      const res = parseStatementCsv(csv);
      expect(res.txns.length).toBe(3);
      expect(res.skipped).toBe(0);
      // salary credit
      expect(res.txns[0].direction).toBe('CREDIT');
      expect(res.txns[0].amountKobo).toBe(52000000);
      expect(res.txns[0].narration).toBe('Salary Credit');
      // ATM debit
      expect(res.txns[1].direction).toBe('DEBIT');
      expect(res.txns[1].amountKobo).toBe(2000000);
      // POS debit
      expect(res.txns[2].direction).toBe('DEBIT');
      expect(res.txns[2].amountKobo).toBe(1500000);

      // period & balances
      // openingBalance = first row's balanceAfter - signed(first txn amount)
      // First txn: Credit 520000, BalanceAfter 850000
      // opening = 850000 - 520000 = 330000 naira = 33000000 kobo
      expect(res.openingBalance).toBe(33000000);
      expect(res.closingBalance).toBe(81500000);
    });

    it('parses single Amount column with signed values', () => {
      const csv = `Date,Narration,Amount
12-May-2025,Salary,520000
13-May-2025,ATM Withdrawal,-20000`;
      const res = parseStatementCsv(csv);
      expect(res.txns.length).toBe(2);
      expect(res.txns[0].direction).toBe('CREDIT');
      expect(res.txns[0].amountKobo).toBe(52000000);
      expect(res.txns[1].direction).toBe('DEBIT');
      expect(res.txns[1].amountKobo).toBe(2000000);
    });

    it('parses Amount + Type column (DR/CR)', () => {
      const csv = `Date,Narration,Amount,Type
12-May-2025,Salary,520000,CR
13-May-2025,ATM,20000,DR`;
      const res = parseStatementCsv(csv);
      expect(res.txns.length).toBe(2);
      expect(res.txns[0].direction).toBe('CREDIT');
      expect(res.txns[1].direction).toBe('DEBIT');
    });

    it('handles quoted narrations with internal commas', () => {
      const csv = `Date,Narration,Debit,Credit,Balance
12-May-2025,"TRANSFER TO, JOHN DOE",10000,,840000`;
      const res = parseStatementCsv(csv);
      expect(res.txns.length).toBe(1);
      expect(res.txns[0].narration).toBe('TRANSFER TO, JOHN DOE');
    });

    it('skips rows with missing date or narration', () => {
      const csv = `Date,Narration,Debit,Credit,Balance
12-May-2025,Valid,1000,,
,Missing Date,2000,,
13-May-2025,,3000,,`;
      const res = parseStatementCsv(csv);
      expect(res.txns.length).toBe(1);
      expect(res.skipped).toBe(2);
    });

    it('throws on missing required columns', () => {
      expect(() => parseStatementCsv('Foo,Bar\n1,2')).toThrow('date column');
      expect(() => parseStatementCsv('Date,Foo\n1,2')).toThrow('narration');
    });

    it('throws when neither Debit/Credit nor Amount present', () => {
      const csv = `Date,Narration\n12-May-2025,Test`;
      expect(() => parseStatementCsv(csv)).toThrow('Debit and Credit columns, or a single Amount column');
    });

    it('deduces openingBalance from first row balanceAfter - signed first amount', () => {
      const csv = `Date,Narration,Debit,Credit,Balance
12-May-2025,Salary,,520000,570000`;
      const res = parseStatementCsv(csv);
      // 570000 - 520000 = 50000 opening
      expect(res.openingBalance).toBe(5000000);
    });
  });
});