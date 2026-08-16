import { CategoryKey } from './taxonomy';
import { Direction } from '../common/types';

/**
 * A single categorization rule. Rules are evaluated top-to-bottom and the first
 * match wins, so order encodes precedence: specific merchants and bill types
 * come before the generic transfer catch-all, because a betting top-up or a
 * DStv payment usually arrives wrapped in the very same `NIP/…/TRANSFER`
 * narration that a person-to-person transfer does.
 *
 * `merchant` is either a fixed brand label or a function that pulls the
 * counterparty out of the narration. All matching is done against an
 * upper-cased, whitespace-collapsed copy of the narration.
 */
export interface Rule {
  id: string;
  category: CategoryKey;
  confidence: number;
  test: RegExp;
  direction?: Direction;
  merchant?: string | ((upper: string, match: RegExpMatchArray) => string | undefined);
}

/** Title-case a rough token run pulled from a narration ("JOHN DOE" -> "John Doe"). */
export function titleCase(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Best-effort counterparty extraction for transfer narrations. Nigerian NIP /
 * NEFT narrations are wildly inconsistent, so this pulls the most name-like run
 * of words after a FROM/TO marker and gives up gracefully when there isn't one.
 */
export function extractCounterparty(upper: string): string | undefined {
  const marked = upper.match(/\b(?:FRM|FROM|TO|BENEF(?:ICIARY)?|SENDER)[:\/\s-]+([A-Z][A-Z .'-]{3,40})/);
  if (marked) {
    const name = marked[1].replace(/\b(NIP|NEFT|RTGS|TRF|TRANSFER|MOBILE|USSD|WEB)\b/g, '').trim();
    if (name.length >= 3) return titleCase(name);
  }
  // Fallback: a slash-delimited segment that looks like a person's name.
  for (const seg of upper.split(/[\/|]/)) {
    const s = seg.trim();
    if (/^[A-Z][A-Z .'-]{4,40}$/.test(s) && /\s/.test(s) && !/\d/.test(s)) {
      return titleCase(s);
    }
  }
  return undefined;
}

const brand = (label: string) => label;

/**
 * The ruleset. Grouped by intent; order within and across groups is deliberate.
 * Confidence reflects how unambiguous the signal is: a named biller or brand is
 * near-certain; a bare "TRANSFER" is a weak default.
 */
export const RULES: Rule[] = [
  // --- Bank charges & fees (usually small, clearly labelled debits) ---
  { id: 'chg-vat', category: 'bank_charges', confidence: 0.98, test: /\bVAT\b/, merchant: brand('VAT') },
  { id: 'chg-stamp', category: 'bank_charges', confidence: 0.98, test: /STAMP\s*DUTY|\bEMTL\b|ELECTRONIC\s+MONEY\s+TRANSFER\s+LEVY/, merchant: brand('Stamp Duty / EMTL') },
  { id: 'chg-sms', category: 'bank_charges', confidence: 0.95, test: /SMS\s*(ALERT|NOTIF|CHARGE)|ALERT\s+CHARGE/, merchant: brand('SMS Alert') },
  { id: 'chg-maint', category: 'bank_charges', confidence: 0.9, test: /\b(COT|ACCOUNT\s+MAINTENANCE|MAINTENANCE\s+FEE|CARD\s+MAINTENANCE|MGT\s+FEE)\b/, merchant: brand('Account Maintenance') },
  { id: 'chg-generic', category: 'bank_charges', confidence: 0.82, test: /\b(CHARGE|CHRG|COMMISSION|SERVICE\s+FEE|TRANSFER\s+FEE|LEVY|FEE)\b/, direction: 'DEBIT', merchant: brand('Bank Charge') },

  // --- Betting & gaming (very specific brands) ---
  { id: 'bet-brands', category: 'betting', confidence: 0.97, test: /\b(BET9JA|SPORTYBET|SPORTY\s*BET|1XBET|BETKING|NAIRABET|MERRYBET|BETWAY|MSPORT|22BET|PARIMATCH|SUREBET|BANGBET|FOOTBALL\s*POOL)\b/, merchant: (u, m) => titleCase(m[1]) },
  { id: 'bet-generic', category: 'betting', confidence: 0.75, test: /\bBETTING\b|\bWAGER\b|\bCASINO\b/, merchant: brand('Betting') },

  // --- Airtime & data (VTU / recharge / networks) ---
  { id: 'air-vtu', category: 'airtime_data', confidence: 0.95, test: /\b(VTU|AIRTIME|RECHARGE|TOP\s?UP|TOPUP|DATA\s*BUNDLE|DATA\s*PLAN)\b/, merchant: brand('Airtime / Data') },
  { id: 'air-networks', category: 'airtime_data', confidence: 0.9, test: /\b(MTN|GLO|AIRTEL|9MOBILE|ETISALAT|SMILE|SPECTRANET)\b/, merchant: (u, m) => titleCase(m[1]) },

  // --- Utilities & bills (electricity discos, cable TV, water) ---
  { id: 'util-disco', category: 'utilities', confidence: 0.95, test: /\b(IKEDC|EKEDC|AEDC|PHED|IBEDC|EEDC|KAEDCO|KEDCO|JED|BEDC|PHCN|NEPA)\b|\bELECTRIC(?:ITY)?\b|\b(PREPAID|POSTPAID)\s+(METER|TOKEN)|\bMETER\s+TOKEN\b/, merchant: (u, m) => (m[1] ? titleCase(m[1]) : 'Electricity') },
  { id: 'util-cable', category: 'utilities', confidence: 0.95, test: /\b(DSTV|GOTV|STARTIMES|MULTICHOICE)\b/, merchant: (u, m) => titleCase(m[1]) },
  { id: 'util-water', category: 'utilities', confidence: 0.85, test: /\bWATER\s+BOARD\b|\bWATER\s+BILL\b/, merchant: brand('Water') },

  // --- Savings & investments (Nigerian fintech savings/invest apps) ---
  { id: 'save-apps', category: 'savings', confidence: 0.92, test: /\b(PIGGYVEST|PIGGY\s*BANK|COWRYWISE|RISEVEST|RISE\s*VEST|BAMBOO|TROVE|CHAKA|PLENTYWAKA\s*SAVE)\b/, merchant: (u, m) => titleCase(m[1]) },
  { id: 'save-generic', category: 'savings', confidence: 0.75, test: /\b(SAVINGS?\s+(DEPOSIT|PLAN|TARGET)|FIXED\s+DEPOSIT|TARGET\s+SAVINGS?|MUTUAL\s+FUND|INVESTMENT)\b/, merchant: brand('Savings') },

  // --- Loans & repayments (digital lenders + generic) ---
  { id: 'loan-lenders', category: 'loans', confidence: 0.9, test: /\b(FAIRMONEY|CARBON|RENMONEY|PALMCREDIT|BRANCH|ALAT\s+LOAN|QUICKCHECK|ADVANCLY|LENDIGO|EASYBUY|CREDITDIRECT)\b/, merchant: (u, m) => titleCase(m[1]) },
  { id: 'loan-generic', category: 'loans', confidence: 0.8, test: /\b(LOAN\s+(REPAYMENT|DISBURSE|DISBURSEMENT)?|REPAYMENT|LOAN\s+FROM|LENDING)\b/, merchant: brand('Loan') },

  // --- Transport & fuel (filling stations + ride-hailing) ---
  { id: 'fuel-stations', category: 'transport_fuel', confidence: 0.9, test: /\b(NNPC|TOTAL|TOTALENERGIES|CONOIL|MOBIL|OANDO|ARDOVA|FORTE\s*OIL|AP\s+FILLING|MRS\s+OIL|PETROL|DIESEL|FUEL|FILLING\s+STATION)\b/, merchant: (u, m) => titleCase(m[1]) },
  { id: 'ride-hailing', category: 'transport_fuel', confidence: 0.9, test: /\b(UBER|BOLT|INDRIVE|IN\s?DRIVE|LAGRIDE|RIDA|BRT|COWRY|LAGFERRY)\b/, merchant: (u, m) => titleCase(m[1]) },

  // --- Groceries & supermarkets ---
  { id: 'grocery-stores', category: 'groceries', confidence: 0.9, test: /\b(SHOPRITE|SPAR|EBEANO|PRINCE\s*EBEANO|ADDIDE|JUSTRITE|JUST\s*RITE|GRAND\s*SQUARE|HUBMART|MARKET\s*SQUARE|NEXT\s*CASH|SUPERMARKET|GROCER(?:Y|IES))\b/, merchant: (u, m) => titleCase(m[1]) },

  // --- Food & dining (QSRs, restaurants, food delivery) ---
  { id: 'food-qsr', category: 'food_dining', confidence: 0.9, test: /\b(CHICKEN\s*REPUBLIC|DOMINO'?S|PIZZA\s*HUT|KFC|THE\s+PLACE|SWEET\s*SENSATION|MR\s*BIGGS|TANTALIZERS|JEVINIK|COLD\s*STONE|RESTAURANT|EATERY|BUKKA|CAFE|KITCHEN)\b/, merchant: (u, m) => titleCase(m[1]) },
  { id: 'food-delivery', category: 'food_dining', confidence: 0.9, test: /\b(GLOVO|CHOWDECK|JUMIA\s*FOOD|FOODCOURT|GOKADA\s*FOOD)\b/, merchant: (u, m) => titleCase(m[1]) },

  // --- Health (pharmacies, hospitals, clinics) ---
  { id: 'health', category: 'health', confidence: 0.88, test: /\b(PHARMAC(?:Y|IES)|MEDPLUS|HEALTHPLUS|HOSPITAL|CLINIC|MEDICAL|DIAGNOSTIC|LABORATOR(?:Y|IES)|HMO|RELIANCE\s*HMO)\b/, merchant: (u, m) => titleCase(m[1]) },

  // --- Education (schools, exam bodies, tuition) ---
  { id: 'education', category: 'education', confidence: 0.85, test: /\b(SCHOOL\s*FEES?|TUITION|WAEC|NECO|JAMB|UNIVERSITY|POLYTECHNIC|COLLEGE|ACADEMY|LESSON|EXAM\s*FEE|UDEMY|COURSERA)\b/, merchant: (u, m) => titleCase(m[1]) },

  // --- Subscriptions (streaming & software) ---
  { id: 'subs', category: 'subscriptions', confidence: 0.92, test: /\b(NETFLIX|SPOTIFY|SHOWMAX|YOUTUBE\s*PREMIUM|PRIME\s*VIDEO|APPLE\.?COM|ICLOUD|GOOGLE\s*(ONE|STORAGE|PLAY)|MICROSOFT|ADOBE|CANVA|CHATGPT|OPENAI|LINKEDIN)\b/, merchant: (u, m) => titleCase(m[1]) },

  // --- E-commerce & POS retail (after the specific merchant groups above) ---
  { id: 'ecom', category: 'pos_retail', confidence: 0.85, test: /\b(JUMIA|KONGA|ALIEXPRESS|AMAZON|TEMU|SLOT|POINTEK|JIJI)\b/, merchant: (u, m) => titleCase(m[1]) },
  { id: 'pos', category: 'pos_retail', confidence: 0.72, test: /\b(POS\b|POS\s+PURCHASE|WEB\s+PURCHASE|CARD\s+PURCHASE|PURCHASE\s+AT|MERCHANT|PAYSTACK|FLUTTERWAVE|STORE|SUPERMART|BOUTIQUE)\b/, merchant: brand('POS / Retail') },

  // --- ATM cash withdrawals ---
  { id: 'atm', category: 'atm', confidence: 0.92, test: /\b(ATM|CASH\s+WITHDRAWAL|WITHDRAWAL\s+AT|CARDLESS\s+WITHDRAWAL|\bWD\b)\b/, merchant: brand('ATM Withdrawal') },

  // --- Income: salary (credits that name themselves) ---
  { id: 'income-salary', category: 'income', confidence: 0.95, direction: 'CREDIT', test: /\b(SALARY|SAL\s*FOR|SAL\/|PAYROLL|STAFF\s+SAL|WAGES|STIPEND|EMOLUMENT)\b/, merchant: brand('Salary') },
  { id: 'income-generic', category: 'income', confidence: 0.6, direction: 'CREDIT', test: /\b(PAYMENT\s+FROM|INFLOW|CREDIT\s+ALERT|REVERSAL|REFUND|DIVIDEND|INTEREST\s+(EARNED|PAID))\b/, merchant: brand('Income') },

  // --- Transfers: the catch-all for account-to-account movement ---
  // Runs last so any of the specific categories above win first.
  {
    id: 'transfer',
    category: 'transfer',
    confidence: 0.6,
    test: /\b(NIP|NEFT|RTGS|TRF|TRANSFER|INSTANT\s+PAYMENT|MOBILE\s+TRANSFER|USSD\s+TRANSFER|FT\b|FUNDS?\s+TRANSFER|SENT\s+TO|RECEIVED\s+FROM|TO\s+[A-Z]+|FRM\b)\b/,
    merchant: (u) => extractCounterparty(u),
  },
];
