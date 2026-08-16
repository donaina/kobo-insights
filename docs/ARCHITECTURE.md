# Kobo Insights — Architecture & Design Notes

## 1. Project Goals

- **Clean-room, 100 % own IP** — no client code, no proprietary data.
- **Clone-and-run** — zero external dependencies in default mode (SQLite, deterministic rules).
- **AI as upgrade** — `ANTHROPIC_API_KEY` unlocks categorization tier 2 + Ask panel; app works fully without it.
- **Nigerian-domain expertise** — narration parsing, category taxonomy, recurring detection tuned for real NIP/bank-statement patterns.
- **Explainable affordability** — rules-based score with named reason codes, shaped to hand off to a future credit-decisioning engine.
- **PR-first publishing** — `donaina/kobo-insights`, Ayoola merges; portfolio entry in `donaina/Portfolio`.

---

## 2. Repo Layout

```
kobo-insights/
├── api/                 # NestJS 10 + Fastify + Prisma + SQLite
│   ├── src/
│   │   ├── categorization/   # rule engine + optional AI
│   │   ├── insights/         # cash-flow, merchants, recurring, income
│   │   ├── affordability/    # explainable scoring
│   │   ├── ask/              # Q&A with compact context
│   │   ├── ingest/           # CSV parser (Nigerian formats)
│   │   ├── statements/       # CRUD + upload
│   │   ├── health/           # liveness + aiEnabled flag
│   │   ├── ai/               # optional Anthropic wrapper
│   │   ├── common/           # money.ts, errors, types
│   │   ├── config/           # loadConfig()
│   │   ├── prisma/           # PrismaService, seed
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── prisma/schema.prisma
│   ├── test/ (jest + ts-jest)
│   ├── package.json
│   └── .env.example
├── web/                 # React 18 + Vite + Tailwind
│   ├── src/
│   │   ├── components/       # dashboard widgets (all hand-rolled SVG)
│   │   ├── lib/              # api.ts, money.ts, categories.ts
│   │   ├── App.tsx, main.tsx
│   │   └── index.css
│   ├── package.json
│   └── .env.example
├── sample-data/         # synthetic statement CSV + generator
├── docker-compose.yml
├── README.md
├── LICENSE (MIT)
├── .gitignore
└── docs/ARCHITECTURE.md (this file)
```

---

## 3. Backend — Module Responsibilities

### 3.1 `config/configuration.ts`
Single source of truth. `loadConfig()` returns typed `AppConfig`:
- `port` (default 3001)
- `databaseUrl` (default `file:./dev.db`)
- `aiEnabled` (true only if `AI_ENABLED===true` AND `ANTHROPIC_API_KEY` present)
- `anthropicApiKey`
- `categorizeModel` (default `claude-haiku-4-5`)
- `askModel` (default `claude-sonnet-5`)
- `maxUploadRows` (default 5000)

### 3.2 `prisma/` — Data layer
- `PrismaService` extends `PrismaClient`, connects onModuleInit, disconnects onModuleDestroy.
- **Models**: `Statement` (1) → `Transaction` (n)
  - `Statement`: id, label, source (SAMPLE\|UPLOAD), bankHint?, accountName?, periodStart, periodEnd, openingBalanceKobo, closingBalanceKobo, createdAt
  - `Transaction`: id, statementId, postedAt, direction (DEBIT\|CREDIT), amountKobo (Int, >0), narration, balanceAfterKobo?, category?, merchant?, categoryConfidence?, categorizedBy (RULES\|AI)?
- Indexes on `statementId`, `category`.

### 3.3 `common/money.ts`
**Integer kobo everywhere.** No floating-point money.
- `assertKobo(n)` — validates positive finite integer ≤ 1_000_000_000_000
- `nairaToKobo(n)` — converts naira (max 2 dp) to kobo, rejects sub-kobo
- `koboToNaira(n)` / `koboToNairaString(n)` — display helpers only

### 3.4 `ingest/` — CSV → NormalizedTxn[]
- **Header sniffing**: finds date, narration, debit/credit OR amount, balance, type columns by regex.
- **Date parsing**: ISO, DD-Mon-YYYY, DD Mon YY, DD/MM/YYYY, DD-MM-YYYY (day-first; flips if day > 12).
- **Amount parsing**: handles ₦/NGN/N, commas, parentheses (negative), DR/CR suffixes.
- **Output**: `NormalizedTxn[]` + periodStart/End, opening/closingBalance (kobo), skipped count.
- **Validation**: throws if required columns missing; rejects sub-kobo amounts via `nairaToKobo`.

### 3.5 `categorization/` — Two-tier engine
**File: `rules.ts`** — ordered array of `Rule` objects (first match wins). Each rule:
- `id`, `category` (CategoryKey), `confidence`, `test` (RegExp on upper-cased narration), optional `direction`, optional `merchant` (string or `(upper, match) => string`).
- **Precedence**: specific brands (Bet9ja, DStv, Piggyvest) → generic classes (POS, transfer catch-all).
- **Getting counterparties**: `extractCounterparty()` pulls name-like runs after FROM/TO/FRM/BENEF markers.

**File: `categorization.service.ts`**
- `classifyByRules(narration, direction)` — pure, deterministic, side-effect-free.
- `categorizeStatement(statementId)` — runs rules on all txns, collects `other` candidates, calls `AiService.categorizeBatch()` if enabled, persists results in single transaction.

**Fixed taxonomy (17 keys)** from `taxonomy.ts`:
| Key | Label | SpendClass |
|-----|-------|------------|
| income | Income | income |
| transfer | Transfers | transfer |
| pos_retail | POS & Retail | discretionary |
| airtime_data | Airtime & Data | essential |
| utilities | Utilities & Bills | essential |
| transport_fuel | Transport & Fuel | essential |
| food_dining | Food & Dining | discretionary |
| groceries | Groceries | essential |
| betting | Betting & Gaming | discretionary |
| loans | Loans & Repayments | debt |
| bank_charges | Bank Charges & Fees | charges |
| atm | ATM Withdrawals | discretionary |
| subscriptions | Subscriptions | discretionary |
| health | Health | essential |
| education | Education | essential |
| savings | Savings & Investments | savings |
| other | Uncategorized | discretionary |

`spendClass` drives affordability feature extraction.

### 3.6 `ai/` — Optional Anthropic wrapper
`AiService` mirrors the NIP sim's optional-Redis `CacheService`:
- `onModuleInit`: checks `config.aiEnabled`, lazy-`require('@anthropic-ai/sdk')` in try/catch, sets client or null.
- `isEnabled()` — boolean.
- `categorizeBatch(inputs: {narration, direction}[])` — strict JSON prompt constrained to taxonomy + merchant + confidence.
- `answerQuestion(context, question)` — compact structured context + user question → natural-language answer.

`@anthropic-ai/sdk` is in `optionalDependencies` in package.json.

### 3.7 `insights/` — Pure aggregation (no side effects)
`insights.util.ts` exports typed functions:
- `cashflowByMonth(txns)` → `MonthlyCashflow[]` (inflow/outflow/net per YYYY-MM)
- `categoryBreakdown(txns)` → `CategorySummary[]` (outflow/inflow/count per category, with spendClass)
- `topMerchants(txns, limit)` → `MerchantSummary[]` (DEBIT only, by total outflow)
- `detectRecurring(txns)` → `RecurringItem[]` (≥3 hits, median gap → weekly/biweekly/monthly, amount stability ±35%, monthlyEquivalent via multipliers 4.33 / 2.17 / 1)
- `detectIncome(txns)` → `IncomeSummary` (explicit `income` category credits + recurring credit sources ≥₦5k median, stability = 1 - CV of monthly totals)

### 3.8 `affordability/` — Explainable scoring
`affordability.util.ts`:
- `computeFeatures(report, balance)` → 13 numeric features (monthlyIncome, incomeStability, monthlyExpense, expenseToIncome, essentialRatio, discretionaryRatio, savingsRate, gamblingExposure, debtBurden, chargesPerMonth, netMonthly, avgBalance, minBalance).
- `scoreAffordability(report, balance)` — base 50, applies **signed reason-coded adjustments**:
  | Code | Title | Impact | Points | Trigger |
  |------|-------|--------|--------|---------|
  | NO_INCOME | No verifiable income | - | -25 | monthlyIncome ≤ 0 |
  | INCOME_DETECTED | Regular income detected | + | +8 | monthlyIncome > 0 |
  | INCOME_STABLE | Steady income | + | +10 | stability ≥ 0.7 |
  | INCOME_VOLATILE | Volatile income | - | -8 | stability < 0.4 |
  | LIVES_WITHIN_MEANS | Spends well within income | + | +14 | expenseToIncome ≤ 0.7 |
  | MODERATE_SPEND | Moderate spending headroom | ± | +2 | ≤ 0.95 |
  | SPENDS_ALL | Spends almost all income | - | -10 | ≤ 1.1 |
  | OVERSPENDS | Spending exceeds income | - | -18 | > 1.1 |
  | POSITIVE_CASHFLOW | Positive monthly cashflow | + | +6 | netMonthly > 0 |
  | NEGATIVE_CASHFLOW | Negative monthly cashflow | - | -8 | netMonthly < 0 |
  | SAVES_REGULARLY | Saves/invests regularly | + | +10 | savingsRate ≥ 0.1 |
  | SOME_SAVINGS | Some savings activity | + | +4 | savingsRate > 0 |
  | HIGH_GAMBLING | High betting exposure | - | -16 | gamblingExposure ≥ 0.25 |
  | SOME_GAMBLING | Notable betting activity | - | -8 | ≥ 0.1 |
  | HIGH_DEBT_SERVICE | High loan-repayment burden | - | -12 | debtBurden ≥ 0.35 |
  | MODERATE_DEBT_SERVICE | Moderate loan repayments | ± | -3 | ≥ 0.15 |
  | FREQUENT_CHARGES | Frequent bank charges | - | -6 | chargesPerMonth ≥ 8 |
  | HITS_ZERO | Balance hits zero | - | -10 | minBalance ≤ 0 |
  | HEALTHY_BUFFER | Healthy balance buffer | + | +8 | avgBalance ≥ monthlyExpense |
  | THIN_BUFFER | Thin balance buffer | - | -6 | avgBalance < 0.25 × monthlyExpense |

- Clamps 0..100, sorts reasons by \|points\| desc, band: A≥80, B≥65, C≥50, D≥35, E otherwise.
- **Disclaimer** baked into every response.

### 3.9 `ask/` — Natural-language Q&A
- `buildAskContext({report, affordability, sampleTxns, txnCap})` — compact text blob: period, totals, monthly cashflow, category spend, income sources, recurring, top merchants, affordability band+reasons, **largest 40 txns by amount**. Never dumps all rows.
- `AskService.ask(statementId, question)` — validates question, validates statement exists (real 404), returns `DISABLED_HINT` if AI off, else calls `AiService.answerQuestion()`.

### 3.10 `statements/` — CRUD + upload
- `upload({label, csv, bankHint?, accountName?})` → `IngestService.ingestCsv(..., source: 'UPLOAD')` → returns `statementId, transactions, skipped, categorization`.
- `list()` with `_count.transactions`.
- `get(id)` — metadata + all transactions (kobo, ISO dates).
- `remove(id)` — cascade delete, returns `{deleted: true}`.

### 3.11 `health/` — Liveness
`GET /api/health` → `{status: 'ok', aiEnabled, counts: {statements, transactions}}`.

---

## 4. Frontend — `web/`

**Stack**: React 18, Vite 5, Tailwind 3, TypeScript strict.

**Design system** (mirrors portfolio):
- Colors: `night-{950..500}`, `champagne-{200..700}`, `ink-{DEFAULT,2,3}`, `line-{DEFAULT,strong}`, semantic `success/error/warning-500`
- Fonts: `Inter` (body), `Space Grotesk` (headings), `JetBrains Mono` (numerals)
- Animations: `fadeIn`, `slideInUp`

**Components** (all in `src/components/`):
- `SummaryCards` — 4 cards: Money in / out / net / period
- `CashflowChart` — hand-rolled SVG grouped bar chart (in vs out per month)
- `CategoryDonut` — SVG donut (stroke-dasharray arcs), centered total, ranked legend (top 10)
- `IncomeCard` — monthly income + stability bar + source breakdown
- `AffordabilityCard` — band badge (colored), score track, reason list with impact dots
- `TopMerchants` — horizontal bars with category pills
- `RecurringList` — cadence chips, monthly equivalent
- `TransactionsTable` — filterable (search + category), paginated (25 rows), category tags + RULES/AI badge per row
- `AskPanel` — input + suggestions, graceful disabled-state banner when AI off
- `UploadStatement` — client-side CSV read → JSON POST, no multipart
- `primitives.tsx` — `SectionTitle`, `CategoryTag`, `SourceBadge` (champagne border for AI), `Spinner`

**API client** (`src/lib/api.ts`):
- Types mirror Nest payloads exactly (all money = integer kobo).
- `BASE` from `VITE_API_BASE` (empty = same-origin, proxied in dev).
- `req<T>` helper with typed error responses.

---

## 5. Sample Data

`sample-data/generate.mjs` — deterministic mulberry32 PRNG (seed 20250809).
- Persona: Lagos professional, ₦520k/mo salary, 3 months (May–Jul 2025).
- Includes: salary, DStv, Netflix, Spotify, Spectranet, IKEDC, Piggyvest autosave, upkeep transfer, airtime/data, Bet9ja, groceries/food/rides/fuel/retail, ATM, P2P transfers, health, SMS/stamp-duty/VAT charges.
- 141 txns (136 debits, 5 credits), closing balance ₦930,672.
- **All synthetic** — no real data.

---

## 6. Testing

```
api/
├── src/
│   ├── common/money.spec.ts           # 9 tests
│   ├── categorization/categorization.spec.ts   # 60+ Nigerian narration cases
│   ├── ingest/csv-parser.spec.ts      # 18 tests (splitCsv, date, amount, full parse)
│   └── insights/insights.spec.ts      # 60+ tests (cashflow, categories, merchants, recurring, income)
└── test/                              # e2e (Supertest) — upload→categorize→insights→affordability→ask
```

**Run**: `cd api && npm test` → **145 passing unit tests**.
**e2e**: `npm run test:e2e` (requires running DB; uses test setup env).

---

## 7. Docker

### 7.1 `docker-compose.yml`
- `api` — builds from `api/Dockerfile`, mounts named volume `kobo-api-data` at `/data` for SQLite, healthcheck on `/api/health`.
- `web` — builds from `web/Dockerfile` (nginx serving SPA), proxies `/api/` to `api:3001`, depends_on `api` healthy.

### 7.2 `api/Dockerfile`
- Multi-stage: builder (full deps, `prisma generate`, `npm run build`) → runner (node:20-alpine, non-root user, copies dist + node_modules + prisma).
- Entrypoint: `sh -c "npx prisma migrate deploy && node dist/main.js"`

### 7.3 `web/Dockerfile`
- Multi-stage: builder (npm ci + build) → nginx:alpine (copies `dist/` + `nginx.conf`).

---

## 8. Safety Gate (before any `git push`)

Run the scan script (or manual equivalent) and **show output to Ayoola** for explicit go-ahead:

```bash
# Checklist:
# 1. No real statements in sample-data/ (only synthetic generator output)
# 2. No .env files with real values (only .env.example)
# 3. No mysql:// / postgres:// connection strings
# 4. No DB password string: skdcnwauicn2ucnaecasdsajdnizucawencascdca
# 5. No prod hostnames: eduvrse.co, 132.226.80.40, bellsmonieprod-25-08-2025-time-02-27.cempgcwugcf3.us-east-2.rds.amazonaws.com
# 6. No Fineract basic-auth blobs
# 7. No real ANTHROPIC_API_KEY
# 8. No stray *.sql, *.csv (except sample-data/sample-statement.csv), *.db
```

**Public pushes are irreversible.**

---

## 9. Deployment Notes

- **Default**: AI off, SQLite file DB (zero-setup).
- **AI on**: set `AI_ENABLED=true` + `ANTHROPIC_API_KEY` in `api/.env` (or docker-compose env).
- **Production DB**: swap `DATABASE_URL` to Postgres/MySQL; run `prisma migrate deploy`.
- **Env overrides**: all config via env vars; `.env.example` documents every key.

---

## 10. Portfolio Integration

After PR merged to `donaina/kobo-insights`:
1. Add entry to `donaina/Portfolio/src/data/portfolioData.ts`:
   ```ts
   {
     id: 3,
     slug: 'kobo-insights',
     title: 'Kobo Insights',
     status: 'live',
     featured: true,
     sourceUrl: 'https://github.com/donaina/kobo-insights',
     metrics: { tests: 145, categories: 17, txnsSeeded: 141 },
     stack: ['NestJS', 'Prisma', 'SQLite', 'React', 'Vite', 'Tailwind', 'TypeScript'],
     highlights: [
       'Deterministic Nigerian narration categorizer (60+ rules)',
       'Explainable affordability signal with 20 reason codes',
       'Optional AI upgrade (Claude) — zero-config fallback',
       'Hand-rolled SVG charts, premium fintech dark theme'
     ],
     buildStory: {
       problem: 'No open, offline-first tool to turn Nigerian bank CSVs into actionable financial intelligence.',
       approach: 'Rules-first categorizer + optional AI; kobo integer math; explainable affordability bridge to credit engine.',
       challenges: ['Nigerian narration variance', 'Running balance reconstruction', 'Rules ordering precedence'],
       decisions: ['Integer kobo everywhere', 'Fixed 17-key taxonomy', 'AI as plugin not dependency'],
       tradeoffs: ['No PDF parsing (v1)', 'Rules require maintenance', 'No ML credit score (explainability > black box)'],
       validation: ['145 unit tests', 'Docker compose verified', 'Synthetic seed clones and runs'],
       future: ['PDF upload', 'Multi-statement diff', 'Credit decisioning engine integration']
     }
   }
   ```
2. `cd /Users/ayoola/Dev/Portfolio && npm run build` (must pass `tsc --noEmit && vite build`).
3. PR to `donaina/Portfolio`; Ayoola merges.

---

## 11. Future Work (Backlog)

- PDF statement parsing (tabula / pdf-parse).
- Multi-statement comparison / trend view.
- Export insights to PDF/CSV.
- Watchdog service (budget alerts, anomaly detection) — separate repo `donaina/kobo-watchdog`.
- Credit decisioning engine — separate repo `donaina/kobo-credit`.