/*
 * Generates a SYNTHETIC Nigerian bank statement CSV — no real customer data,
 * ever. Output is deterministic (seeded PRNG, fixed dates) so the committed
 * sample-statement.csv is reproducible and the tests can assert on it.
 *
 * Persona: "Ada Ok-- (SYNTHETIC)", a Lagos-based mid-level professional on a
 * ~N450k monthly salary, three months (May–Jul 2025). The mix is designed to
 * exercise every insight: recurring bills, subscriptions, savings, betting
 * exposure, salary income, and a healthy running balance.
 *
 *   node sample-data/generate.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// --- deterministic PRNG (mulberry32) -------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20250809);
const rand = (min, max) => min + Math.floor(rng() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const jitter = (d) => Math.min(28, Math.max(1, d + rand(-1, 1)));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const txns = []; // { y, m, d, narr, debit, credit }  (amounts in whole/decimal naira)
const push = (y, m, d, narr, debit, credit) => txns.push({ y, m, d, narr, debit, credit });

const GROCERS = ['SHOPRITE LEKKI', 'SPAR ILUPEJU', 'PRINCE EBEANO SUPERMARKET', 'HUBMART CIRCLE MALL'];
const FOOD = ['THE PLACE VICTORIA ISLAND', 'CHICKEN REPUBLIC', 'DOMINOS PIZZA LEKKI', 'CAFE NEO', 'JEVINIK RESTAURANT'];
const RIDES = ['UBER BV', 'BOLT/TXFR', 'INDRIVE LAGOS'];
const FUEL = ['NNPC RETAIL LEKKI', 'TOTALENERGIES ADMIRALTY', 'CONOIL VI'];
const RETAIL = ['JUMIA/ORDER', 'KONGA ONLINE', 'POS PURCHASE/JUST SHOP', 'WEB PURCHASE/PAYSTACK STORE'];
const PEOPLE_OUT = ['TO TUNDE BALOGUN', 'TO NGOZI EZE', 'TO IBRAHIM MUSA', 'TO CHIDINMA OKAFOR', 'TO FEMI ADELEKE'];
const PEOPLE_IN = ['FROM EMEKA OBI', 'FROM BLESSING ALADE', 'FROM KUNLE SANNI', 'FROM AISHA BELLO'];

let ref = 830112;
const r = () => (ref++).toString();

for (const { y, m } of [{ y: 2025, m: 5 }, { y: 2025, m: 6 }, { y: 2025, m: 7 }]) {
  const mn = MONTHS[m - 1].toUpperCase();

  // --- income + monthly recurring outgoings (fixed-ish day, small jitter) ---
  push(y, m, 25, `NIP/CR/ACME TECHNOLOGIES LTD/SALARY ${mn} ${y}/REF${r()}`, 0, 520000 + rand(-1, 1) * 2500);
  push(y, m, jitter(3), `WEB/DSTV SUBSCRIPTION COMPACT PLUS/MULTICHOICE NG/REF${r()}`, 24500, 0);
  push(y, m, jitter(5), `WEB/NETFLIX.COM 8663434/AMSTERDAM NL/CARD3311`, 7900, 0);
  push(y, m, jitter(7), `WEB/SPOTIFY P0FA23/STOCKHOLM SE/CARD3311`, 1300, 0);
  push(y, m, jitter(6), `WEB/SPECTRANET LTE/INTERNET MONTHLY/REF${r()}`, 20600, 0);
  push(y, m, jitter(10), `WEB/IKEDC PREPAID/METER 45210178822 TOKEN/REF${r()}`, 15000, 0);
  push(y, m, jitter(26), `NIP/DR/PIGGYVEST/SAVEFLEX AUTOSAVE/REF${r()}`, 60000, 0);
  push(y, m, jitter(27), `NIP/DR/TO MERCY ADEYEMI/GTBANK/MONTHLY UPKEEP/REF${r()}`, 40000, 0);
  push(y, m, jitter(28), `CARD MAINTENANCE FEE/QTRLY/REF${r()}`, 105, 0);

  // --- airtime & data ---
  for (let i = 0; i < rand(3, 4); i++)
    push(y, m, rand(1, 28), `VTU/MTN/08034${rand(100000, 999999)}/${pick(['AIRTIME', 'DATA 10GB', 'DATA 25GB'])}`, pick([1000, 2000, 3000, 5000, 10000]), 0);

  // --- betting (moderate, a few deposits a month — an amber affordability flag) ---
  for (let i = 0; i < rand(3, 4); i++)
    push(y, m, rand(1, 28), `WEB/BET9JA/DEPOSIT/${rand(100000, 999999)}`, pick([10000, 15000, 20000]), 0);

  // --- groceries / food / transport / retail ---
  for (let i = 0; i < 3; i++) push(y, m, rand(1, 28), `POS/${pick(GROCERS)}/CARD3311`, rand(12, 30) * 1000, 0);
  for (let i = 0; i < 5; i++) push(y, m, rand(1, 28), `POS/${pick(FOOD)}/CARD3311`, rand(25, 120) * 100, 0);
  for (let i = 0; i < 4; i++) push(y, m, rand(1, 28), `POS/${pick(RIDES)}/LAGOS`, rand(15, 90) * 100, 0);
  for (let i = 0; i < 2; i++) push(y, m, rand(1, 28), `POS/${pick(FUEL)}/PMS`, rand(80, 200) * 100, 0);
  for (let i = 0; i < 3; i++) push(y, m, rand(1, 28), `${pick(RETAIL)}/REF${r()}`, rand(3, 20) * 1000, 0);

  // --- ATM withdrawals ---
  for (let i = 0; i < 2; i++) push(y, m, rand(1, 28), `ATM/WD/GTB LEKKI/CARD3311`, pick([20000, 30000]), 0);

  // --- person-to-person transfers out (varied ⇒ not "recurring") ---
  for (let i = 0; i < 2; i++)
    push(y, m, rand(1, 28), `NIP/DR/${pick(PEOPLE_OUT)}/${pick(['GTBANK', 'ACCESS', 'UBA', 'ZENITH'])}/REF${r()}`, rand(5, 35) * 1000, 0);

  // --- occasional inbound transfer / refund (varied ⇒ not counted as income) ---
  if (rng() > 0.4) push(y, m, rand(1, 28), `NIP/CR/${pick(PEOPLE_IN)}/${pick(['GTBANK', 'OPAY', 'KUDA'])}/REF${r()}`, 0, rand(10, 35) * 1000);

  // --- health (some months) ---
  if (rng() > 0.5) push(y, m, rand(1, 28), `POS/MEDPLUS PHARMACY/CARD3311`, rand(4, 18) * 1000, 0);

  // --- bank charges: SMS alerts, stamp duty, VAT ---
  for (let i = 0; i < 4; i++) push(y, m, rand(1, 28), `SMS ALERT CHARGE`, 52, 0);
  for (let i = 0; i < 3; i++) push(y, m, rand(1, 28), `STAMP DUTY CHARGE/EMTL`, 50, 0);
  for (let i = 0; i < 2; i++) push(y, m, rand(1, 28), `VAT ON ELECTRONIC TRANSFER`, rand(4, 12), 0);
}
// --- order chronologically; on a given day, credits land before debits so the
//     running balance never dips below zero from same-day ordering artifacts ---
txns.sort((a, b) => a.y - b.y || a.m - b.m || a.d - b.d || (b.credit - b.debit) - (a.credit - a.debit));

const OPENING = 850000;
const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cell = (s) => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const fmtDate = ({ y, m, d }) => `${String(d).padStart(2, '0')}-${MONTHS[m - 1]}-${y}`;

let balance = OPENING;
const lines = ['Date,Narration,Debit,Credit,Balance'];
for (const t of txns) {
  balance += (t.credit || 0) - (t.debit || 0);
  lines.push(
    [
      fmtDate(t),
      cell(t.narr),
      t.debit ? cell(money(t.debit)) : '',
      t.credit ? cell(money(t.credit)) : '',
      cell(money(balance)),
    ].join(','),
  );
}

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'sample-statement.csv');
writeFileSync(out, lines.join('\n') + '\n', 'utf8');

const debits = txns.filter((t) => t.debit).length;
const credits = txns.filter((t) => t.credit).length;
process.stdout.write(
  `Wrote ${txns.length} synthetic transactions (${debits} debits, ${credits} credits) to ${out}\n` +
    `Opening ₦${money(OPENING)} -> closing ₦${money(balance)}\n`,
);

