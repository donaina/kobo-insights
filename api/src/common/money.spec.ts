import {
  assertKobo,
  nairaToKobo,
  koboToNairaString,
  koboToNaira,
  MoneyError,
  MAX_KOBO,
} from './money';

describe('money helpers', () => {
  describe('assertKobo', () => {
    it('accepts positive integer kobo', () => {
      expect(assertKobo(100)).toBe(100);
      expect(assertKobo(12345)).toBe(12345);
    });

    it('rejects non-integers (sub-kobo)', () => {
      expect(() => assertKobo(100.5)).toThrow(MoneyError);
      expect(() => assertKobo(100.5)).toThrow('sub-kobo');
    });

    it('rejects non-positive', () => {
      expect(() => assertKobo(0)).toThrow(MoneyError);
      expect(() => assertKobo(-1)).toThrow(MoneyError);
    });

    it('rejects NaN/Infinity', () => {
      expect(() => assertKobo(NaN)).toThrow(MoneyError);
      expect(() => assertKobo(Infinity)).toThrow(MoneyError);
    });

    it('rejects over the sanity ceiling', () => {
      expect(() => assertKobo(MAX_KOBO + 1)).toThrow(MoneyError);
    });
  });

  describe('nairaToKobo', () => {
    it('converts clean naira to integer kobo', () => {
      expect(nairaToKobo(100)).toBe(10000);
      expect(nairaToKobo(1234.56)).toBe(123456);
      expect(nairaToKobo(0.01)).toBe(1);
    });

    it('rejects sub-kobo precision', () => {
      expect(() => nairaToKobo(10.001)).toThrow(MoneyError);
      expect(() => nairaToKobo(10.001)).toThrow('sub-kobo');
    });

    it('rejects non-finite', () => {
      expect(() => nairaToKobo(NaN)).toThrow(MoneyError);
      expect(() => nairaToKobo(Infinity)).toThrow(MoneyError);
    });
  });

  describe('koboToNairaString', () => {
    it('formats with N locale', () => {
      expect(koboToNairaString(123456)).toBe('1,234.56');
      expect(koboToNairaString(100)).toBe('1.00');
      expect(koboToNairaString(1)).toBe('0.01');
    });
  });

  describe('koboToNaira', () => {
    it('returns number for UI math', () => {
      expect(koboToNaira(123456)).toBe(1234.56);
      expect(koboToNaira(100)).toBe(1);
    });
  });
});