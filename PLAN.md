# MoneyMgr v2 — Frontend Plan (web + iOS/Android) — living document

Companion docs: `FRONTEND_ANALYSIS.md` (what exists today), `../mgr_backend/PLAN.md` (API, schema, phases).
Status legend: `[ ]` todo · `[~]` in progress · `[x]` done. Add features under **Backlog**.

## 1. Goals
- One product on **web (Next.js)** and **iOS/Android (Expo React Native)** sharing types, validation, API client and money/date logic.
- Keep v1's best UX (month ledger, chip-based entry with currency inheritance, KPI dashboard, notes board, export, SIP calculator, light/dark tokens) and fix: giant files, no auth, no real FX, cosmetic-only currency conversion, non-persisted theme, `/pages` URL prefix, inconsistent API base URLs.
- Offline-capable quick entry on mobile.

## 2. Stack
| Concern | Choice |
|---|---|
| Language | TypeScript everywhere |
| Monorepo | pnpm + Turborepo (`apps/web`, `apps/mobile`, `packages/shared`, `packages/ui-tokens`, `packages/config`) |
| Web | Next.js (App Router), React 19, Tailwind, shadcn/ui (Radix) |
| Mobile | Expo SDK (current), Expo Router, NativeWind, React Native Reanimated, Gesture Handler |
| Server state | TanStack Query (both) |
| Client state | Zustand (UI prefs only) |
| Forms | React Hook Form + Zod resolvers (schemas from `packages/shared`) |
| API client | Generated from the backend OpenAPI spec into `packages/shared` (one base URL env: `API_URL`) |
| Charts | Web: Recharts or visx (drop Highcharts licence concerns); Mobile: Victory Native XL / react-native-skia charts |
| Dates | date-fns (+ tz) with the user timezone from settings |
| i18n | i18next (en first; th, ne later), locale-aware currency/date formatting via `Intl` |
| Local DB (mobile) | expo-sqlite + Drizzle; sync queue to `/sync/push|pull` |
| Secure storage | expo-secure-store (tokens), biometric lock via expo-local-authentication |
| Push | expo-notifications |
| Billing | RevenueCat (react-native-purchases) for Pro; Stripe on web later |
| Monitoring | Sentry (web + mobile), PostHog or similar analytics (opt-in) |
| Tests | Vitest + Testing Library, Playwright (web e2e), Maestro (mobile e2e), Storybook (web) |
| Build/release | EAS Build/Submit/Update (mobile), Vercel locally-equivalent Docker for web; AWS later (web: ECS or Amplify/CloudFront) |

## 3. Shared packages
- `packages/shared`: Zod schemas + inferred types, generated API client, `money` (minor-unit math, formatting, FX convert), `dates` (month buckets in user tz), constants (account types, category defaults), savings-rate/threshold helpers, SIP calculator (pure function, unit tested).
- `packages/ui-tokens`: colors/spacing/radius/typography as JSON → consumed by Tailwind (web) and NativeWind (mobile). Port v1 tokens (primary `#64b5f6`/`#1976d2`, success/error tints, dark bg `#0f1115`, paper `#1e222a`, pill radius 999) as the starting palette.

## 4. Information architecture (shared across web and mobile)
Route names (no `/pages` prefix on web):
```
/ (dashboard)            /transactions            /accounts         /categories
/budgets                 /recurring               /goals            /debts
/investments (overview · holdings · trades · SIP · SSF · calculator)
/insights (analysis)     /notes                   /import-export    /settings (profile, currencies, theme, security, billing)
/auth (login, register, forgot)
```
Mobile: bottom tabs **Home · Transactions · (+ quick add) · Insights · More**; More → budgets, accounts, goals, debts, investments, notes, settings. Web: left sidebar ≥ md, drawer below.

## 5. Screens → v1 parity + new
| Screen | v1 parity | New in v2 |
|---|---|---|
| Dashboard | month summary cards | net worth, account balances, budget progress, upcoming recurring, goals, quick add |
| Transactions | month/year selector, day grouping + day totals, search/type/account/sort filters, currency badge, edit/delete | infinite scroll (cursor), tags, attachments/receipt camera, transfers, bulk select, swipe actions (mobile), saved filters |
| Add transaction | type toggle, date-time, account, category chips filtered by type, currency inherits from category, amount > 0, note, quick-add category | account picker from real accounts, FX auto-rate preview, repeat toggle (recurring), split, receipt photo, numeric keypad sheet on mobile, offline queue |
| Insights | KPI cards, savings-rate gauge, donuts, top-10, 12-month trend, income vs expense, net & cumulative net, monthly/yearly/all | custom range, compare periods, category drill-down, cashflow forecast; all values from server (`/insights/*`), real FX base currency (no manual THB⇄NPR rate) |
| Categories | list + stat filters, add/edit/delete, currency manager | parent/sub-categories, icons/colors picker, merge, archive |
| Notes | sticky board, search, editor | pin, link to transaction/goal, markdown-lite |
| Export | 7/30/90d + custom + category, preview, CSV, PDF | XLSX, scheduled email, server-generated PDF reports, **Import wizard** (xls/CSV mapping, dry run, dedupe) |
| Stocks + Investments hub | per-symbol avg price (use-for-avg toggle), P/L, donut; capital trackers for stock/coin/SIP/SSF; BHT→NPR display; SIP calculator | unified portfolio from `/portfolio/*`: holdings table, cost-basis method switch, unrealised P/L with prices, history chart, dividends, SIP/SSF schedules + reminders |
| Settings | theme toggle (not persisted) | profile, base currency, timezone, week start, language, theme (persisted), biometric lock, privacy mode (hide amounts), data export/delete account, subscription |
| Auth | none | email/password, Google, Sign in with Apple, forgot/reset |

## 6. UX / quality rules
- Every list: loading skeleton, empty state, error state with retry; optimistic updates for add/edit/delete; toasts via one helper.
- Money display always through `shared/money`; never sum different currencies without base conversion.
- Light and dark from day one, theme persisted; WCAG AA contrast; large touch targets; dynamic type.
- Query keys namespaced `[userId, resource, params]`; `staleTime` tiers (static 1h, lists 30s, dashboards 60s); invalidate by resource, not by window events (v1 used `transactions:changed`).
- Components < 300 lines; feature folders: `features/<name>/{api,hooks,components,screens}`.
- No secrets in client; only `NEXT_PUBLIC_API_URL` / `EXPO_PUBLIC_API_URL` (a single origin including `/v1`).
- Accessibility labels on all controls; i18n keys for all strings from the start (even if only `en`).

## 7. Mobile specifics
- Offline: writes go to local SQLite with `client_id` + `version`, flushed by a sync worker (background fetch + on foreground); conflict UI = last-write-wins with "changed elsewhere" toast (revisit).
- Quick add: floating button + (later) home widget / share extension / Siri-Shortcuts action.
- Camera receipts → presigned upload; later OCR.
- Biometric gate on app open/resume; secure-store for refresh token; screenshot-blur in app switcher.
- Push: budget exceeded, recurring due, bill reminders, SIP due.
- Store assets: icon, screenshots, privacy labels, support URL, in-app account deletion, Sign in with Apple, TestFlight/internal track.

## 8. Phases (mirrors backend phases)
**P0 Foundation** — [ ] monorepo scaffold, [ ] tokens + Tailwind/NativeWind, [ ] generated API client, [ ] auth screens + session handling (web+mobile), [ ] app shells (nav), [ ] CI + Storybook
**P1 Ledger UI** — [ ] accounts, [ ] categories/tags, [ ] transactions list + add/edit (web + mobile), [ ] import wizard (migrate the v1 xls first), [ ] dashboard v1
**P2 Planning** — [ ] insights, [ ] budgets, [ ] recurring, [ ] goals, [ ] debts, [ ] notes, [ ] export/reports, [ ] settings + persisted theme + i18n scaffolding
**P3 Mobile polish** — [ ] offline SQLite + sync, [ ] push, [ ] biometric lock, [ ] camera receipts, [ ] EAS builds, [ ] TestFlight/Play internal testing
**P4 Investments** — [ ] holdings/trades, [ ] portfolio overview, [ ] SIP/SSF schedules + calculator, [ ] price display + history
**P5 Pro** — [ ] RevenueCat paywall + entitlements, [ ] AI categorise/insights chat, [ ] shared workspaces
**P6 Release** — [ ] store listings, [ ] privacy/legal pages, [ ] a11y + performance pass, [ ] production web deploy on AWS

## 8b. Status log
- 2026-11-24: Web slice built in this folder (Next.js 16 with Cache Components, Tailwind 4, TanStack Query). **Done:** login/register, httpOnly-cookie session via a same-origin gateway (`/api/auth/*`, `/api/v1/*`, silent token refresh with single-flight), dashboard (month summary, savings-rate band, top expenses, 12-month chart, recent, balances), transactions (month filter, day grouping, search, type/account filter, add/edit/delete, load more), accounts (add/archive/delete), categories (add/delete), light/dark via `prefers-color-scheme`, mobile bottom nav (no horizontal overflow at 375px). Verified against the live API with real imported data; `next build` passes.
- 2026-11-24 (later): **Budgets** (monthly/weekly/custom, per category or all expenses, progress bars with ok/warning/over, month browsing, add/edit/delete, dashboard widget) and **Recurring** (add/edit/pause/resume/delete, next-3-dates preview, backfill option, "Run due now", last-error display) screens built and verified in the browser against the live API (light + dark tokens, no overflow at 375px with the 6-item bottom nav). Ledger writes now also refresh budget status.
- 2026-11-24 (later): **Investments** built — overview (value, cost, unrealised/realised P/L, XIRR, allocation, holdings list, FX-excluded warning), add asset, asset detail (position stats for unit and value assets, trade/contribution add-edit-delete with oversell errors, manual price/value updates, cost-method switch, archive/delete) and the SIP calculator. Mobile nav is now 4 tabs + a More menu. Verified in the browser against the live API (numbers match the backend tests: wavg 150 avg / 750 realised, FIFO 1,000 realised, SIP 12,809.33).
- 2026-11-24 (later): **Import & export** and **Settings** built. Import: upload the real Money Manager `.xls` (or `.xlsx`/CSV) parsed in the browser, auto-detected columns, D/M/Y vs M/D/Y text-date choice, preview, dry-run check, then import, with a full report (new accounts/categories, duplicates, invalid rows); investments import from v1 Mongo JSON/JSONL; CSV export of transactions (formula-injection safe). Verified with the real 2,080-row file on a throwaway user: totals exact, re-import = 2,080 duplicates, 0 new. Settings: theme (System/Light/Dark, persisted, no flash), name, base currency (with warning), time zone, week start. Mobile More menu now lists Recurring, Accounts, Categories, Import & export, Settings.
- 2026-11-24 (later): **Transfers** built — `/transfers` lists each transfer as one row (from → to, amount sent and, for cross-currency, amount received), month picker, new-transfer dialog (swap accounts, balances shown, overdraft hint, implied rate, FX field only when unambiguous), edit note/date and delete (removes both legs) via the shared transaction form; entry points on the Accounts page (per-account and header). Verified on a throwaway user: balances update, cross-currency pair uses stored FX for its base value, transfers never touch income/expense insights.
- 2026-11-24 (later): **Frontend tests** added — Vitest + Testing Library (jsdom), `npm test` (108 tests, 15 files, ~3 s) + `.github/workflows/ci.yml` (typecheck, test, build). Covers: money/date/import/CSV helpers, API client, the server gateway (token refresh incl. single-flight, DELETE-without-body, API-down 502, auth routes never leaking tokens), and the main screens (auth, transaction form, transfers, budgets, transactions list, import/export incl. real .xlsx, settings/theme, app shell/nav). Tests found and fixed 4 real bugs: gateway crashed (500) instead of 502 when the API is down; CSV import garbled emoji/Thai/Nepali text (SheetJS decoded as Latin-1) and guessed US dates; transfer dialog never picked default accounts if accounts loaded after it opened; edit form reset typed input when accounts refreshed. Mutation-checked: reintroducing the DELETE-body, single-flight and CSV bugs makes tests fail.
- **Still no browser e2e** (Playwright needs a ~150 MB browser download — deferred until you approve), no visual regression, and `Dashboard`/`Investments`/`Recurring`/`Accounts`/`Categories` screens have no component tests yet (only manual browser checks).
- 2026-11-24 (later): **Typed OpenAPI client.** Backend: response schemas + a route registry in `@moneymgr/shared` generate an OpenAPI 3.1 document (53 operations, 28 named schemas) served at `GET /openapi.json` and written to `apps/api/openapi.json` (`pnpm --filter @moneymgr/api openapi`); every API integration test now validates each real response against the contract (mutation-checked), CI fails if `openapi.json` is stale. Frontend: `npm run api:sync` copies the spec and regenerates `lib/api/schema.d.ts` (openapi-typescript); `lib/api/client.ts` exposes an openapi-fetch `client` + `call()`; all hooks and components use it, so paths, params, bodies and responses are compile-time checked, and `lib/api/types.ts` is now derived from the schema (no hand-written API types). Verified in the browser (all 11 screens load; create/edit/delete/transfer/budget/asset/trade/price/recurring/settings succeed). 109 frontend tests + 47 API + 26 shared backend tests pass.
- 2026-11-24 (later): **Account deletion** (App Store requirement). Backend `DELETE /v1/me` (password re-auth, 5-wrong-attempts lock → 429, hard-deletes every owned row in one transaction, kills all sessions; a leftover access token gets a clean 401). Settings → "Delete account": explains what is lost, links to the CSV export, requires the password and typing DELETE, then clears the session and cache and returns to /login. Verified end to end in the browser (wrong password → inline error and stays signed in; correct → signed out, login and /me fail, no orphan rows). 116 frontend + 53 API tests.
- 2026-11-24 (later): **Mobile app started** in the sibling project `../mgr_mobile` (Expo SDK 58, Expo Router, TanStack Query, typed openapi-fetch client from the same OpenAPI spec). Built: sign in/register with a session guard, tokens in SecureStore (rotation-safe single-flight refresh, refresh before expiry, retry on 401, no sign-out on network blips), Dashboard (month summary, savings band, top expenses, recent, balances), Activity (day-grouped infinite list, filters, search, add/edit/delete), Budgets (status, add, delete), Accounts (add/archive/delete), Settings (profile, base currency, sign out, delete account with password + DELETE). 41 Jest tests (client/session/auth/transaction form/money) + mutation-checked; `expo-doctor` 20/20; iOS, Android and web bundles export cleanly. Verified end to end on Expo web against the live API (register → add/edit/delete transaction → budget → delete account). **Not run on a native simulator** (no Xcode here). Not built on mobile: investments, recurring, transfers, import/export, push, biometrics, offline.
- 2026-11-24 (later): **Mobile screens added:** Invest tab (portfolio totals, XIRR, allocation, holdings) + asset detail (position stats for unit and value assets, trades add/edit/delete with the API's oversell error, price/value update, cost method, archive/delete), add asset, SIP calculator; Transfers (list, new transfer with cross-currency received amount + implied rate + FX field only when unambiguous, edit/delete through the transaction screen, shortcut from Accounts); Recurring (list, add/edit with backfill option, pause/resume, delete, run due now); Categories (add/delete). Tabs are now Home · Activity · Budgets · Invest · More. 65 mobile tests; verified on Expo web against the live API with numbers identical to web/backend (wavg 150 avg, 750 realised, 75% return, FIFO 1,000, SIP 12,809.33, backfill posts 3). Forms now close via `goBack()` which lands on Home when there is no history (cold start / web reload).
- Found along the way: the API's CORS config allowed only GET/POST, which breaks PATCH/DELETE from any browser app on another origin (fixed in the backend + tested); React Compiler (enabled by the Expo template) miscompiled an optional-chaining initial state value, so it is disabled.
- Caveats: `xlsx` 0.18.5 (npm) has known advisories for untrusted files; it is lazy-loaded only on the import screen and only reads files the user picks — replace with a patched build or a server-side parser before opening the app to other users.
- **Not yet:** FX rate field polish, settings/profile, i18n, browser e2e (Playwright), mobile app (Expo).
- Notes: in this Next version a client component that reads `new Date()` must sit behind `<Suspense>`; the gateway must not send a body on DELETE (Fastify rejects empty JSON bodies).

## 9. Definition of done (per screen)
Works on web and mobile (or explicitly one), light + dark, 390/768/1280 widths, loading/empty/error states, i18n keys, a11y labels, unit test for logic, Playwright or Maestro flow for the happy path, no file over ~300 lines, documented here.

## 10. Open decisions
- Charts library per platform; Tailwind+shadcn vs another web kit.
- Whether web is a full app or mobile-first with a lighter web (assumed full).
- Offline scope (entry only vs full read cache).
- Sync approach (simple versions vs PowerSync).
- Locales at launch; tier boundaries (free vs Pro).
- App name, branding, domain.

## 11. Backlog (add ideas here)
Home-screen widgets, Apple Watch quick-add, Android SMS auto-log, receipt OCR line items, net-worth timeline, tax-year reports, shared-expense splitting, goal reminders, CSV bank templates, onboarding checklist, referral/share cards, desktop PWA install.
