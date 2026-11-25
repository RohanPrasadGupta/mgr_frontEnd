# MoneyMgr — Frontend Analysis (source material for the new project)

Source: `moneyMgr` repo (Next.js app named `money-mgr`, page title "Rohan Money Manager"). Read from code; where the README disagrees with the code the code wins (§11).

It is a **frontend-only, single-user, no-auth** app that talks to two independent Express/Mongo backends (see `mgr_backend/BACKEND_ANALYSIS.md`). The frontend is the *only* place the two data worlds are joined, and it also hosts business logic that should move server-side (avg price, P/L, SIP calc, FX display).

---

## 1. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js **16** App Router, React **19.2**, JS/JSX components + a few `.ts` service files (`allowJs`, `tsconfig`/`jsconfig` both present). `next.config.mjs` is empty. |
| UI | MUI 7 (`@mui/material`, `icons-material`, `@mui/x-date-pickers` 8, `@mui/x-charts` 8 — installed), Emotion + `styled-components` + `@mui/styled-engine-sc`, Tailwind 4 (postcss only; effectively unused), Geist fonts |
| Server state | TanStack Query v5 (one `QueryClient` with **default options**) |
| Charts | Highcharts 12 + `highcharts-react-official` (analysis, SIP, gauges), Recharts 3 (portfolio/investment overview, stock donut) |
| Dates | Day.js (pickers via `mui-date-adapter.js`), date-fns 4 |
| Export | jsPDF 2.5 + jspdf-autotable (lazy-loaded), hand-rolled CSV |
| Toasts | react-hot-toast (`Toaster` in root layout) |
| Package manager | npm (`package-lock.json`) |

No state library, no form library (controlled `useState` forms), no router beyond file-based routes, no i18n, no tests, no lint config, no auth, no service worker.

## 2. Routes & navigation

`app/page.js` renders `pages/page.jsx`, which shows a spinner and does a client-side `router.push("/pages/home")`. All screens live under `/pages/*` (unusual: a literal `pages` segment inside `app/`).

| Route | Page file → component | Backend |
|---|---|---|
| `/pages/home` | `Homepage` → `TransactionView` + `AddTransaction` FAB | core |
| `/pages/analysis` | `AnalysisPage` | core |
| `/pages/exportinfo` | `ExportPage` | core |
| `/pages/categories` | `CategoryPage` (+ currency manager) | core |
| `/pages/notes` | `NotesPage` | core |
| `/pages/stocks` | `StocksPage` | stock |
| `/pages/investments` | `InvestmentsPage` (tabs: Overview, Stock, Coin, SIP, **SSF**) | stock |

`pages/layout.jsx` (client): fixed 240px left `Navbar` on ≥ `md`; below `md` a floating `SpeedDialNavbar` (bottom-left, zIndex 1500). Content area `height:100vh; overflow-y:auto`. Wraps children in `QueryProvider` → `ErrorBoundary` (class component, "Try Again"). `navConfig.js` is the single nav list (Home, Analysis, Export Data, Categories, Notes, Stock Analysis, Investments) shared by both nav components.

Dark/light toggle lives in the Navbar bottom and the speed-dial; **dark default, state not persisted** (`ThemeContext` + `MuiThemeProvider`).

## 3. Environment variables (all `NEXT_PUBLIC_*`, bundled into the client)

| Var | Points at | Used by |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | core backend **origin** (code appends `/api/...`) | transactions, analysis, export, categories, currencies, notes |
| `NEXT_PUBLIC_API_URL_STOCK` | stock backend **including `/api`** (code appends `/transactions`) | `StocksPage` |
| `NEXT_PUBLIC_API_URL_STOCK_CAPITAL` | stock backend **including `/api`** (appends `/capital`, `/sip-capital`, `/ssf-capital`) | Stock/SIP/SSF tabs, Overview |
| `NEXT_PUBLIC_API_URL_COIN_CAPITAL` | stock backend **including `/api`** (appends `/coin-capital`) | Coin tab, Overview |

Gotcha: the base-URL convention is inconsistent — the core var has **no** `/api`, the three stock vars **must** end in `/api`. `credentials: "include"` is sent on core transaction/category/currency/analysis/export calls; notes and all stock-backend calls send no credentials.

## 4. Data layer

### 4.1 Types (`app/types/index.ts` — authoritative shapes the UI relies on)
```ts
Transaction { _id; date: string; account: "Cash"|"Online"; category: string; note: string; currency: string; type: "Income"|"Expense"; amount: number }
Category    { _id; name; categoryType: "Income"|"Expense"; currency }
Currency    { _id; code; name; symbol; isDefault }
Note        { _id; title; content; date; __v? }
StockInvestment (stock capital) { _id; date; amount; type: "BUY"|"SELL"; currency; createdAt?; updatedAt? }
CoinInvestment { …same + transactionCharge; totalAmount }
SipInvestment  { _id; name; date; amount; currency }
SsfCapitalRecord { _id; amount; monthsPaid; totalAmount; dateAdded; paidDate; currency; notes; createdAt?; updatedAt? }
StockCapitalSummary { totalCapital; totalBuyAmount; totalSellAmount; recordCount; first/lastInvestmentDate?; averageInvestment }
CoinCapitalSummary  { totalAmount; totalTransactionCharge; grandTotal; totalBuy/SellAmount; totalBuy/SellGrand; recordCount; …averages }
SsfCapitalSummary   { totalAmount; totalMonthsPaid; recordCount; first/lastPaidDate?; averageAmount; records }
SipCalculatorResult { totalInvested; estimatedReturns; maturityValue; yearlyBreakdown:[{year,invested,returns,total}] }
```
There is **no** TS type for the per-trade `StockTransaction` (`{stockSymbol, stockName, type, price, quantity, totalAmount, investedDate, currency, useForAvgPrice}`) — it is untyped inside `StocksPage.jsx`.

### 4.2 Fetching conventions
Mixed on purpose-less lines: only `services/` has proper hooks (`useCategoryQuery`, `useCurrencyQuery` + `getCurrencyMenuOptions`, `useNotesQuery` + CRUD functions, `useSsfCapitalQuery`/summary + CRUD). Every other screen inlines `fetch` inside `useQuery`/`useMutation`. No axios, no shared client, no error normaliser; mutations call `invalidateQueries` then `toast`. `useMonthlyTransactions` in `useTransactionServices.ts` and `categoryMapping.js` are dead code.

### 4.3 Endpoint ↔ query-key map

| Screen | Query key | Request |
|---|---|---|
| Home (`TransactionView`) | `["getMonthlyTransactions", year, month]` (`staleTime:0`, refetch on mount/focus/reconnect) | `GET core /api/data/{year}/{month}` → `res.data` |
| Add/Edit/Delete tx | invalidates `getMonthlyTransactions`; dispatches `window` `CustomEvent("transactions:changed")` | `POST /api/data`, `PUT/DELETE /api/data/{id}` |
| Categories everywhere | `["getCategories"]` (also `["exportCategories"]`) | `GET /api/category` (bare array) |
| Currencies | `["getCurrencies"]` | `GET/POST/PUT/DELETE /api/currency` |
| Analysis | `["getTransactionData", y, m]` | `/api/data/{y}/{m}` |
| | `["getTransactionDataYearly", barYear]` | `/api/dataPerYear/{y}` → `data.IncomeArray/ExpensesArray` |
| | `["getDataAnalysis", viewMode, y, m]` | `/api/dataReportAll` or `/api/dataAnalysis/{y}[/{m}]` (must cope with the dual response shape) |
| | `["getAllTransactionData"]` | `/api/data` (all, used for the 12-month trend & top categories) |
| Export | `["exportCategories"]`, report query keyed by dates+category | `/api/data/report?startDate&endDate[&category]` |
| Notes | `["getNotes"]` | `/api/allnotes`, `/api/getNote/{id}`, `/api/addNote`, `/api/updateNote/{id}`, `/api/deleteNote/{id}` |
| Stocks | `["transactions"]` | `GET/POST {STOCK}/transactions`, `PUT/DELETE /transactions/{id}`, avg toggle `PUT` then fallback `PATCH {STOCK}/transactions/{id}` |
| Stock capital | `["capitalInvestments", typeFilter]`, `["capitalInvestmentsSummary"]` | `{CAP}/capital[?type=]`, `/capital/summary/total` |
| Coin | `["coinInvestments", typeFilter]`, `["coinInvestmentsSummary"]` | `{COIN}/coin-capital[?type=]`, `/summary/total` |
| SIP | `["sipCapitalInvestments"]` | `{CAP}/sip-capital` CRUD (PUT) |
| SSF | `["ssfCapitalInvestments"]`, `["ssfCapitalSummary"]` | `{CAP}/ssf-capital` CRUD (PATCH for update) |
| Investments overview | reuses `capitalInvestments`, `coinInvestments`, `sipCapitalInvestments`, `ssfCapitalInvestments` | unfiltered lists |

Note: the Overview tab and the Stock/Coin tabs share the prefixes `capitalInvestments` / `coinInvestments`, so invalidating the prefix refreshes both.

## 5. Screens — behaviour in detail

### 5.1 Home / transactions
- **Month + year dropdown selectors** (year range = current ±5), default current month. Day-grouped list (grouped client-side by calendar day) with per-day income/expense totals; summary cards Income / Expense / Net for the month.
- Row: avatar icon by type with a MUI `Badge` showing the row's currency (`currencyBadgeSx`), category (emoji prefix preserved), note, amount, account.
- Filters (all client-side over the month's data): free-text on category+note, type (All/Income/Expense), account (All/Cash/Online), sort by date|amount asc|desc, removable "filters applied" chips, empty-state message differentiating "no data" vs "filtered out".
- Edit / delete dialogs per row (edit defaults currency to the row's current value; legacy rows missing currency → `THB`). Delete has a confirm dialog.
- **Add transaction** (`AddTransaction`, FAB → dialog): type toggle (Income/Expense), date-time picker (Day.js), account `Cash|Online` (hardcoded `accountOptions`), category chips filtered by `categoryType === form.type`, currency dropdown that **defaults from the selected category's currency** and is overridable, amount (`> 0` enforced, category required), optional note. Inline "quick-add category" posts `/api/category`, refreshes categories. On success: close, invalidate, dispatch `transactions:changed`, toast.
- Cross-component refresh uses the `transactions:changed` `window` event (also listened to by Analysis) in addition to Query invalidation.

### 5.2 Analysis
- View modes **Monthly / Yearly / View All**; currency display toggle THB ⇄ NPR with a rate dropdown of **17 options 3.9 → 5.5 step 0.1** (`1 THB = x NPR`, default 3.9). The conversion is a presentational multiply on every stat/chart/tooltip/axis; no data is converted server-side.
- KPI cards: Income, Expense, Net, **Savings rate = (income − expense) / income × 100** (null if income 0). Colour/label thresholds: `≥ 20%` green "Healthy savings", `0–20%` amber "Low buffer", `< 0` red "Spending more than earned". Radial gauge clamps value to 0–100.
- Charts (Highcharts): income/expense donuts by category; **Top-10** expense and income horizontal bars; **12-month stacked area of top expense categories** (trailing year, independent of period filter, built from `/api/data`); monthly income-vs-expense columns for a chosen year (`barYear`) driven by `dataPerYear`; monthly net and cumulative-net areaspline. Colours from `chartPalette`/`chartPieGradients` + `investmentChartColors(mode)` (mode-aware; charts cannot read MUI theme paths).

### 5.3 Categories + currency manager
- Unified searchable list with filter stat cards All / Income / Expense (double as counts), per-row type + currency badges, per-row pending spinner, add / **edit** / delete (confirm dialog) with fields `name`, `categoryType`, `currency`.
- "Manage Currencies" panel: add/edit/delete, set default. Backend enforces single default.

### 5.4 Notes
Sticky-note board (coloured cards, pin, ruled paper, slight tilt, responsive grid), search on title+body, large editor dialog; **both title and content required** (save disabled otherwise). Opening a card does a fresh `GET /getNote/{id}` before editing. Delete via shared `InvestmentDeleteDialog`. Uses the typed functions in `useNoteServices.ts` which parse `{message,data,errMsg}`.

### 5.5 Export
Range presets 7/30/90 days or manual dates + optional category filter → live preview (count + first 5 rows) + KPI cards (count/income/expense). **CSV**: UTF-8 BOM, `"` doubled. **PDF**: jsPDF + autoTable, dynamic import, totals header. Emoji prefixes stripped from category names in both outputs. The UI sends `startDate = startOf("day")` and `endDate = endOf("day")` as ISO strings, which works with the backend's exclusive `$lt` end.

### 5.6 Stock portfolio (`StocksPage`, ~92 KB, the largest file)
- CRUD BUY/SELL trades; symbol/name **autocomplete from existing trades**; currency dropdown (default NPR); accordion grouped per `stockSymbol`; zero-holding positions dimmed and sorted last; symbol donut of capital at stake.
- **Formulas (all client-side, per symbol, `Number(x||0)` guarded):**
  - Total Bought = Σ `totalAmount` of BUYs. Sold = Σ `totalAmount` of SELLs. Remaining shares = Σ BUY qty − Σ SELL qty.
  - **Overall avg price** = Σ BUY totalAmount / Σ BUY qty (all BUYs; used by Remaining and P/L).
  - **Displayed Avg Price** = same formula but **only over BUY rows with `useForAvgPrice === true`**; 0 if none selected.
  - Remaining value = `max(0, overallAvg × remainingQty)`.
  - **Realised P/L** = Σ SELL totalAmount − overallAvg × Σ SELL qty (0 if no sells).
  - Latest buy/sell price chips = most recent by `investedDate`.
  - Portfolio: total stocks, total transactions, Overall Invested, Current Invested, Total Sold, Overall P/L (sum of symbol values; naive across currencies).
- Currency formatting is hardwired to `NPR` via `Intl.NumberFormat` regardless of a row's currency.

### 5.7 Investments hub (tabbed: Overview, Stock, Coin, SIP, SSF)
- **Overview**: stat strip (stock / SIP / NPR-combined / coin / SSF), NPR allocation donut (stock+SIP, same-currency only), 12-month stacked area of capital added, entries-by-type bar, merged Recent Activity across trackers. Coin kept separate in THB.
- **Stock capital**: BUY/SELL type filter (server `?type=`), signed amounts (`SELL` negative via `stockCapitalHelpers`), glass stat cards, yearly bar, "Investment Momentum" area+line of monthly contributions vs running total.
- **Coin**: always THB, no currency selector; selectable **BHT→NPR rate** (`useState("4.3")`) applied to stat cards, tooltips and an NPR table column; signed `amount`/`totalAmount` helpers (`signedCoinAmount`, `signedCoinGrandTotal`); `transactionCharge` field.
- **SIP**: fund name, NPR, stacked bar by year & fund, donut by fund, table, and a **SIP calculator**:
  `monthlyRate = annual% / 12 / 100`; `maturity = P × (((1+r)^n − 1)/r) × (1+r)` (annuity-due; `P×n` if r = 0); `returns = maturity − P×n`; per-year breakdown loop repeats the formula for `m = 12·year`.
- **SSF**: `amount` per month × `monthsPaid`, `dateAdded`, `paidDate`, notes; uses the typed hooks in `useSsfCapitalServices.ts` (the only investment tab on proper service functions).
- Shared UI: `InvestmentFormUi.jsx` (dialog header, form shell, delete dialog, `InvestmentStatCard`, `accentFieldSx`).

## 6. Multi-currency behaviour (as built)
- Defaults: THB for core data and coin; NPR for stock/SIP/SSF. Legacy rows missing `currency` fall back client-side.
- One currency list from `GET core /api/currency`, reused even on stock pages. `getCurrencyMenuOptions` appends an orphaned code so an edit dialog never loses its current value.
- **No FX, no per-currency subtotals**: day/month/portfolio totals sum raw amounts. The THB⇄NPR/BHT→NPR switches are cosmetic, manual-rate, display-only.

## 7. Design system
- `themeStyles.js` is the token source: `colors` (dark: bg `#0f1115`, paper `#1e222a`, elevated `#252a33`, primary `#64b5f6`/`#42a5f5`, success `#66bb6a`/`#43a047`, error `#ef5350`/`#e53935`, warning `#ffb74d`, text `#f0f2f5/#b0b8c1/#6b7280`, border `#23272f`), `gradients`, card/dialog/button `sx` presets (`themedCardSx`, `primaryButtonSx`, `dangerButtonSx`, …), `chartPalette`, `chartPieGradients`, `statCardSx(variant, mode)`, `investmentChartColors(mode)`, `currencyBadgeSx(code)`, `adaptiveColor`.
- `MuiThemeProvider.jsx` builds full light **and** dark MUI themes (light: bg `#f5f7fa`, paper `#fff`, primary `#1976d2`; success/error use the "Dark" tints so they stay legible on white). `app/theme.js` is a legacy dark-only theme, unused.
- Conventions: pill shapes (`borderRadius: 999px`), glass stat cards with coloured top accent bar, gradient icon-avatar section headers, vibrant gradient KPI cards, mode-aware chart helpers. Large hard-coded colour usage inside components still exists (scrollbars, toaster is white regardless of mode).

## 8. File map
```
app/
  layout.js            root layout, Geist fonts, MuiThemeProvider, Toaster
  page.js → pages/page.jsx (redirect)
  pages/{home,analysis,exportinfo,categories,notes,stocks,investments}/page.jsx  + pages/layout.jsx, QueryProvider.jsx
  components/
    Homepage.jsx · header/TitleHeader.jsx · navbar/{Navbar,SpeedDialNavbar}.jsx · common/{ErrorBoundary,PageLoadingState}.jsx
    transactions/{TransactionView 59KB, AddTransaction 24KB}.jsx
    analysisComp/AnalysisPage.jsx 65KB · categoryComp/CategoryPage.jsx 41KB · exportPage/ExportPage.jsx 29KB · notesComp/NotesPage.jsx 22KB
    stocksComp/StocksPage.jsx 92KB
    investmentsComp/{InvestmentsPage 27KB, StockInvestmentPage 35KB, CoinInvestmentPage 36KB, SipInvestmentPage 49KB, SsfInvestmentPage 22KB, InvestmentFormUi 21KB}.jsx
  services/{useCategoryServices,useCurrencyServices,useNoteServices,useSsfCapitalServices,useTransactionServices}.ts · stockCapitalHelpers.js · categoryMapping.js (unused)
  context/ThemeContext.jsx · MuiThemeProvider.jsx · themeStyles.js · theme.js (unused) · navConfig.js · constant/constant.js (MockDataTransactions, unused) · types/index.ts · mui-date-adapter.js
```
Single components of 20–90 KB mix fetching, formulas, charts, dialogs and styles; that is the main maintainability debt.

## 9. Frontend ↔ backend contract summary (what the UI actually depends on)

| UI expectation | Backend reality to preserve or fix |
|---|---|
| `GET /api/category`, `/api/currency` return a **bare array** | keep or wrap and update hooks |
| `/api/data*` return `{message,data}`; **`dataAnalysis` cache-miss returns top-level `incomeTypes/expenseTypes`** | normalise to one shape |
| Stock APIs return `{success,data,…}` + summary objects described in the backend doc | keep envelope |
| Month param accepts number or English name | Home keeps `currentMonth` in state initialised to `""` (set later, likely a name or number) — not verified which; the backend accepts both |
| Updates: SIP → `PUT`; SSF → `PATCH`; stock-avg toggle → `PUT` then `PATCH`; capital/coin → `PUT` | a new API should accept both verbs or standardise on PATCH |
| Create of a stock trade must include `totalAmount` | compute server-side |

## 10. Known gaps in the current frontend
No auth; theme not persisted; no FX/per-currency subtotals; no pagination (month fetch is fine, "all data" fetch on Analysis is not); no optimistic updates; `staleTime` left at default 0 almost everywhere; errors surfaced only as generic toasts; category names are matched as raw strings (emoji included); accounts hard-coded (`Cash`, `Online`) and the real data export also contains other account labels in principle; env URL conventions inconsistent; dead code (`theme.js`, `categoryMapping.js`, `MockDataTransactions`, `useMonthlyTransactions`); a literal `/pages/` URL segment; very large single-file components; no tests, no accessibility pass, no i18n, English/emoji hard-coded strings.

## 11. README ↔ code discrepancies
- README Investments section describes **Overview / Stock / Coin / SIP** tabs; the code also has an **SSF** tab (`TABS` has 5 entries, `ssfResp` query in Overview, `SsfInvestmentPage`). README's "API surface" also omits `/ssf-capital`.
- README says the stock-avg `PUT` falls back to `PATCH` — true in code (`StocksPage.jsx` ~L183–200).
- README says toasts/loading states exist on every page — true for fetch/mutation paths; no suspense/skeleton framework.
- `categoryMapping.js` contains a hard-coded snapshot of the author's category list (with emoji and one `id`), useful as seed data for the new project.

## 12. Carry-forward recommendations for the new frontend
- Keep what works: month-grouped ledger with fast filters, category-chip entry with currency inheritance, the Analysis KPI/savings-rate set, notes board, CSV+PDF export, mode-aware tokenised theme, investment stat-card system, the SIP calculator.
- Restructure: a typed API client generated from an OpenAPI spec (one base URL, one envelope), feature folders with hooks + presentational components (split the 60–90 KB files), shared money/date utilities, persisted theme + user settings (default currency, FX source, timezone), route group without the `/pages` prefix, error/empty/loading primitives, form lib + schema validation shared with the backend.
- Move calculations server-side (avg cost basis, realised/unrealised P/L, savings rate, top categories, 12-month trends) and have the UI render them; add real FX conversion with stored rate-at-time; add auth/user scoping; add tests (unit for formulas, Playwright for flows).
- Feature candidates the data already hints at: budgets per category, recurring transactions, account transfers, account balances, import UI for the Money-Manager xls/CSV, goals, live prices for holdings (unrealised P/L), SSF/SIP schedules and reminders, multi-user sharing, PWA/offline entry, mobile layout parity (current speed-dial nav is a stopgap).
