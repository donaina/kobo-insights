import { CategorizationService, Classification } from './categorization.service';
import { CategoryKey } from './taxonomy';
import { Direction } from '../common/types';

function makeService(): CategorizationService {
  const ai = {
    isEnabled: () => false,
    categorizeBatch: jest.fn(),
  } as any;
  const prisma = {} as any;
  return new CategorizationService(prisma, ai);
}

describe('CategorizationService — classifyByRules (tier 1, deterministic)', () => {
  const svc = makeService();

  const c = (narration: string, direction: Direction = 'DEBIT') =>
    svc.classifyByRules(narration, direction);

  // Helper to assert category + merchant
  const expectCat = (narration: string, category: CategoryKey, merchant?: string, dir: Direction = 'DEBIT') => {
    const res = c(narration, dir);
    expect(res.category).toBe(category);
    if (merchant !== undefined) expect(res.merchant).toBe(merchant);
    expect(res.categorizedBy).toBe('RULES');
    expect(res.confidence).toBeGreaterThan(0);
  };

  // --- Bank charges ---
  describe('bank charges', () => {
    it('VAT', () => expectCat('VAT ON TRANSFER', 'bank_charges', 'VAT'));
    it('Stamp Duty / EMTL', () => expectCat('STAMP DUTY CHG', 'bank_charges', 'Stamp Duty / EMTL'));
    it('EMTL', () => expectCat('ELECTRONIC MONEY TRANSFER LEVY', 'bank_charges', 'Stamp Duty / EMTL'));
    it('SMS Alert', () => expectCat('SMS ALERT CHARGE', 'bank_charges', 'SMS Alert'));
    it('Account Maintenance', () => expectCat('ACCOUNT MAINTENANCE FEE', 'bank_charges', 'Account Maintenance'));
    it('Card Maintenance', () => expectCat('CARD MAINTENANCE', 'bank_charges', 'Account Maintenance'));
    it('COT', () => expectCat('COT CHARGE', 'bank_charges', 'Account Maintenance'));
    it('generic charge fallback', () => expectCat('SERVICE FEE', 'bank_charges', 'Bank Charge'));
    it('generic charge is DEBIT only', () => {
      const credit = c('SERVICE FEE', 'CREDIT');
      expect(credit.category).toBe('other'); // direction mismatch
    });
  });

  // --- Betting ---
  describe('betting & gaming', () => {
    it('Bet9ja', () => expectCat('NIP/BET9JA/ONLINE BET', 'betting', 'Bet9ja'));
    it('SportyBet variants', () => {
      expectCat('SPORTYBET COM', 'betting', 'Sportybet');
      expectCat('SPORTY BET NG', 'betting', 'Sporty Bet');
    });
    it('1xBet', () => expectCat('1XBET DEPOSIT', 'betting', '1xbet'));
    it('BetKing', () => expectCat('BETKING', 'betting', 'Betking'));
    it('MSport', () => expectCat('MSPORT', 'betting', 'Msport'));
    it('Generic betting keyword', () => expectCat('BETTING ACCOUNT TOPUP', 'betting', 'Betting'));
  });

  // --- Airtime & Data ---
  describe('airtime & data', () => {
    it('VTU / Airtime / Recharge', () => expectCat('VTU AIRTIME RECHARGE', 'airtime_data', 'Airtime / Data'));
    it('Data Bundle', () => expectCat('DATA BUNDLE PURCHASE', 'airtime_data', 'Airtime / Data'));
    it('MTN RECHARGE matches VTU rule first (RECHARGE keyword)', () => {
      const res = c('MTN RECHARGE');
      expect(res.category).toBe('airtime_data');
      expect(res.merchant).toBe('Airtime / Data');
    });
    it('GLO DATA matches network rule (no VTU keyword)', () => {
      const res = c('GLO DATA');
      expect(res.category).toBe('airtime_data');
      expect(res.merchant).toBe('Glo');
    });
    it('AIRTEL AIRTIME matches VTU rule first (AIRTIME keyword)', () => {
      const res = c('AIRTEL AIRTIME');
      expect(res.category).toBe('airtime_data');
      expect(res.merchant).toBe('Airtime / Data');
    });
    it('9MOBILE matches network rule (no VTU keyword)', () => {
      const res = c('9MOBILE');
      expect(res.category).toBe('airtime_data');
      expect(res.merchant).toBe('9mobile');
    });
    it('Spectranet without VTU keyword', () => expectCat('SPECTRANET INTERNET', 'airtime_data', 'Spectranet'));
  });

  // --- Utilities ---
  describe('utilities & bills', () => {
    it('IKEDC', () => expectCat('IKEDC PREPAID METER', 'utilities', 'Ikedc'));
    it('EKEDC', () => expectCat('EKEDC POSTPAID', 'utilities', 'Ekedc'));
    it('DStv', () => expectCat('DSTV SUBSCRIPTION', 'utilities', 'Dstv'));
    it('GOtv', () => expectCat('GOTV RENEWAL', 'utilities', 'Gotv'));
    it('Startimes', () => expectCat('STARTIMES', 'utilities', 'Startimes'));
    it('Water Board', () => expectCat('WATER BILL LAGOS', 'utilities', 'Water'));
  });

  // --- Savings ---
  describe('savings & investments', () => {
    it('Piggyvest', () => expectCat('PIGGYVEST AUTOSAVE', 'savings', 'Piggyvest'));
    it('Piggy Bank', () => expectCat('PIGGY BANK SAVE', 'savings', 'Piggy Bank'));
    it('Cowrywise', () => expectCat('COWRYWISE INVEST', 'savings', 'Cowrywise'));
    it('Risevest', () => expectCat('RISEVEST', 'savings', 'Risevest'));
    it('Bamboo', () => expectCat('BAMBOO INVEST', 'savings', 'Bamboo'));
    it('generic savings', () => expectCat('SAVINGS DEPOSIT', 'savings', 'Savings'));
  });

  // --- Loans ---
  describe('loans & repayments', () => {
    it('FairMoney', () => expectCat('FAIRMONEY REPAYMENT', 'loans', 'Fairmoney'));
    it('Carbon', () => expectCat('CARBON LOAN', 'loans', 'Carbon'));
    it('Palmcredit', () => expectCat('PALMCREDIT', 'loans', 'Palmcredit'));
    it('Branch', () => expectCat('BRANCH LOAN REPAY', 'loans', 'Branch'));
    it('generic loan repayment', () => expectCat('LOAN REPAYMENT', 'loans', 'Loan'));
  });

  // --- Transport & Fuel ---
  describe('transport & fuel', () => {
    it('NNPC', () => expectCat('NNPC FILLING STATION', 'transport_fuel', 'Nnpc'));
    it('TotalEnergies', () => expectCat('TOTAL ENERGIES', 'transport_fuel', 'Total'));
    it('Uber', () => expectCat('UBER TRIP', 'transport_fuel', 'Uber'));
    it('Bolt', () => expectCat('BOLT RIDE', 'transport_fuel', 'Bolt'));
    it('inDrive', () => expectCat('INDRIVE', 'transport_fuel', 'Indrive'));
  });

  // --- Groceries ---
  describe('groceries', () => {
    it('Shoprite', () => expectCat('SHOPRITE IKEJA', 'groceries', 'Shoprite'));
    it('SPAR', () => expectCat('SPAR SUPERMARKET', 'groceries', 'Spar'));
    it('Ebeano', () => expectCat('PRINCE EBEANO', 'groceries', 'Prince Ebeano'));
    it('Addide', () => expectCat('ADDIDE STORE', 'groceries', 'Addide'));
    it('Justrite', () => expectCat('JUSTRITE', 'groceries', 'Justrite'));
    it('Hubmart', () => expectCat('HUBMART', 'groceries', 'Hubmart'));
  });

  // --- Food & Dining ---
  describe('food & dining', () => {
    it('Chicken Republic', () => expectCat('CHICKEN REPUBLIC', 'food_dining', 'Chicken Republic'));
    it('Domino\'s', () => expectCat('DOMINOS PIZZA', 'food_dining', 'Dominos'));
    it('KFC', () => expectCat('KFC NIGERIA', 'food_dining', 'Kfc'));
    it('Cold Stone', () => expectCat('COLD STONE CREAMERY', 'food_dining', 'Cold Stone'));
    it('Glovo', () => expectCat('GLOVO DELIVERY', 'food_dining', 'Glovo'));
    it('Chowdeck', () => expectCat('CHOWDECK', 'food_dining', 'Chowdeck'));
  });

  // --- Health ---
  describe('health', () => {
    it('Pharmacy', () => expectCat('MEDPLUS PHARMACY', 'health', 'Medplus'));
    it('Hospital', () => expectCat('RELIANCE HMO HOSPITAL', 'health', 'Reliance Hmo'));
  });

  // --- Education ---
  describe('education', () => {
    it('School fees', () => expectCat('SCHOOL FEES PAYMENT', 'education', 'School Fees'));
    it('WAEC EXAM FEE hits generic "FEE" charge rule first', () => {
      const res = c('WAEC EXAM FEE');
      expect(res.category).toBe('bank_charges'); // generic charge rule fires first
    });
    it('JAMB', () => expectCat('JAMB REGISTRATION', 'education', 'Jamb'));
  });

  // --- Subscriptions ---
  describe('subscriptions', () => {
    it('Netflix', () => expectCat('NETFLIX.COM', 'subscriptions', 'Netflix'));
    it('Spotify', () => expectCat('SPOTIFY PREMIUM', 'subscriptions', 'Spotify'));
    it('YouTube Premium', () => expectCat('YOUTUBE PREMIUM', 'subscriptions', 'Youtube Premium'));
    it('Apple -- titleCase on full match', () => {
      const res = c('APPLE.COM/BILL');
      expect(res.category).toBe('subscriptions');
      expect(res.merchant).toBe('Apple.Com'); // titleCase on "APPLE.COM" -> "Apple.Com"
    });
    it('Google One', () => expectCat('GOOGLE ONE', 'subscriptions', 'Google One'));
    it('ChatGPT', () => expectCat('OPENAI CHATGPT', 'subscriptions', 'Openai'));
  });

  // --- E-commerce / POS ---
  describe('POS & retail', () => {
    it('Jumia', () => expectCat('JUMIA NIGERIA', 'pos_retail', 'Jumia'));
    it('Konga', () => expectCat('KONGA ONLINE', 'pos_retail', 'Konga'));
    it('POS PURCHASE SHOPRITE matches grocery rule first', () => {
      const res = c('POS PURCHASE SHOPRITE');
      expect(res.category).toBe('groceries'); // SHOPRITE matches grocery rule first
      expect(res.merchant).toBe('Shoprite');
    });
    it('WEB PURCHASE AMAZON matches ecom rule first', () => {
      const res = c('WEB PURCHASE AMAZON');
      expect(res.category).toBe('pos_retail');
      expect(res.merchant).toBe('Amazon'); // ecom rule captures brand
    });
    it('Paystack', () => expectCat('PAYSTACK PAYMENT', 'pos_retail', 'POS / Retail'));
  });

  // --- ATM ---
  describe('ATM withdrawals', () => {
    it('ATM', () => expectCat('ATM WITHDRAWAL', 'atm', 'ATM Withdrawal'));
    it('Cash Withdrawal', () => expectCat('CASH WITHDRAWAL AT ACCESS BANK', 'atm', 'ATM Withdrawal'));
    it('WD', () => expectCat('WD 50000', 'atm', 'ATM Withdrawal'));
  });

  // --- Income ---
  describe('income (credits)', () => {
    it('Salary', () => expectCat('SALARY FOR AUGUST', 'income', 'Salary', 'CREDIT'));
    it('SAL FOR', () => expectCat('SAL FOR JULY 2025', 'income', 'Salary', 'CREDIT'));
    it('Payroll', () => expectCat('PAYROLL CREDIT', 'income', 'Salary', 'CREDIT'));
    it('Stipend', () => expectCat('STIPEND RECEIVED', 'income', 'Salary', 'CREDIT'));
    it('generic credit income', () => expectCat('PAYMENT FROM JOHN DOE', 'income', 'Income', 'CREDIT'));
    it('reversal/refund', () => expectCat('REVERSAL OF FAILED TXN', 'income', 'Income', 'CREDIT'));
    it('income rules only fire on CREDIT', () => {
      const debit = c('SALARY', 'DEBIT');
      expect(debit.category).not.toBe('income');
    });
  });

  // --- Transfers (catch-all, runs last) ---
  describe('transfers', () => {
    it('NIP transfer with counterparty', () => {
      const res = c('NIP/TRF/FROM/JOHN DOE/GTB', 'CREDIT');
      expect(res.category).toBe('transfer');
      expect(res.merchant).toBe('John Doe');
    });
    it('TRF TO', () => {
      const res = c('TRF TO JANE SMITH', 'DEBIT');
      expect(res.category).toBe('transfer');
      expect(res.merchant).toBe('Jane Smith');
    });
    it('FRM marker', () => {
      const res = c('FRM PETER PAN/ACC123', 'CREDIT');
      expect(res.merchant).toBe('Peter Pan');
    });
    it('football pool excluded from transfer', () => {
      const res = c('FOOTBALL POOL TOPUP', 'DEBIT');
      expect(res.category).toBe('betting');
      expect(res.category).not.toBe('transfer');
    });
  });

  // --- Unknown / other ---
  describe('unknown falls to other', () => {
    it('random narration', () => {
      const res = c('XYZ123 UNKNOWN THING', 'DEBIT');
      expect(res.category).toBe('other');
      expect(res.confidence).toBeLessThan(0.3);
    });
  });
});