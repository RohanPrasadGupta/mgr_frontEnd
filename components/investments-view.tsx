"use client";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";
import { toast } from "@/lib/toast";
import { useConfirm } from "./feedback";
import { call, client } from "@/lib/api/client";
import { invalidateInvestments, qk, useAllTrades, useMe, useMutate, usePortfolio } from "@/lib/api/hooks";
import type { AssetClass, Body, CostMethod, Holding, Trade } from "@/lib/api/types";
import { CLASS_BORDER, CLASS_DOT, CLASS_FILL, CLASS_LABEL, CLASS_STROKE, CLASS_TEXT, CLASS_VAR, RECORD_CHOICE, amountOnlyTrade, defaultTracking, entryLabel } from "@/lib/investments";
import { assetIndex, classesOf, portfolioValue, shownIn, currenciesOf, lastMonths, monthlyCapital, recent, totalsByClass, yearlyCapital, type ClassTotals, type PerCurrency } from "@/lib/invest-board";
import { compact, toSlices } from "@/lib/chart-utils";
import { DonutChart, GroupedBarChart, LineChart, NoData } from "./charts";
import { formatMoney, formatPct, formatQty, formatUnitPrice, toMajor } from "@/lib/money";
import { Button, Card, Empty, ErrorNote, Field, Input, ListSkeleton, Modal, PageSkeleton, Select, Skeleton, cx, SCROLL_LIST } from "./ui";
import { PortfolioChart } from "./portfolio-chart";
import { exportFileName, investmentSheets } from "@/lib/invest-export";
import { todayIso } from "@/lib/dates";
import { EntryAmount, EntryIcon } from "./entry-amount";
import { CurrencySelect } from "./currency-options";

const tone = (n: number | null) => (n === null || n === 0 ? "" : n > 0 ? "text-income" : "text-expense");

type Tab = "overview" | AssetClass;
// The open tab lives in the URL (?tab=stock) so a reload or a shared link opens the same tab.
const TAB_EVENT = "mm:investments-tab";
const readTab = (): Tab => (new URLSearchParams(window.location.search).get("tab") as Tab) || "overview";
const subscribeTab = (cb: () => void) => { window.addEventListener("popstate", cb); window.addEventListener(TAB_EVENT, cb); return () => { window.removeEventListener("popstate", cb); window.removeEventListener(TAB_EVENT, cb); }; };
const writeTab = (t: Tab) => {
  const u = new URL(window.location.href);
  if (t === "overview") u.searchParams.delete("tab"); else u.searchParams.set("tab", t);
  window.history.replaceState(window.history.state, "", u);
  window.dispatchEvent(new Event(TAB_EVENT));
};

export function InvestmentsView() {
  const portfolio = usePortfolio();
  const trades = useAllTrades();
  const [adding, setAdding] = useState<AssetClass | null>(null);
  const [exporting, setExporting] = useState(false);
  const tab = useSyncExternalStore(subscribeTab, readTab, () => "overview" as Tab);
  const setTab = writeTab;
  const p = portfolio.data;
  const classes = p ? classesOf(p.holdings) : [];
  const active: Tab = tab !== "overview" && !classes.includes(tab) ? "overview" : tab;

  /** Every entry of the open type (or of all types, one sheet each) as an Excel file. Read fresh per asset, not from the board's 500-entry sample. */
  async function exportEntries() {
    if (!p) return;
    setExporting(true);
    try {
      const cls = active === "overview" ? classes : [active];
      const list = p.holdings.map((h) => h.asset).filter((a) => cls.includes(a.class));
      const all = (await Promise.all(list.map(async (a) => (await call(client.GET("/investments/trades", { params: { query: { assetId: a.id, limit: 500 } } }))).data))).flat();
      const XLSX = await import("xlsx"); // loaded on demand
      const wb = XLSX.utils.book_new();
      const header = ["Date", "Symbol", "Name", "Type", "Quantity", "Price", "Amount", "Signed amount", "Fee", "Currency", "Use for average", "Note"];
      for (const s of investmentSheets(all, list, cls)) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.rows, { header }), s.name);
      XLSX.writeFile(wb, exportFileName(active === "overview" ? "all" : active, todayIso()));
      toast.success(`Exported ${all.length} ${all.length === 1 ? "entry" : "entries"}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Export failed"); }
    finally { setExporting(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Investments</h1>
          <p className="text-sm text-muted">Each kind of investment you add gets its own tab.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/investments/calculator" className="inline-flex items-center rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium hover:bg-border/40">SIP calculator</Link>
          {p && p.holdings.length > 0 && (
            <Button variant="ghost" onClick={() => void exportEntries()} loading={exporting} aria-label={`Export ${active === "overview" ? "all investment entries" : `${CLASS_LABEL[active]} entries`} to Excel`}>
              Export {active === "overview" ? "all" : CLASS_LABEL[active]}
            </Button>
          )}
          <Button onClick={() => setAdding(active === "overview" ? "stock" : active)}>+ Add {active === "overview" ? "asset" : CLASS_LABEL[active].toLowerCase()}</Button>
        </div>
      </div>

      {p && p.holdings.length > 0 && (
        <div role="tablist" aria-label="Investment types" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {(["overview", ...classes] as Tab[]).map((t) => {
            const on = active === t;
            return (
              <button key={t} type="button" role="tab" aria-selected={on} onClick={() => setTab(t)}
                className={cx("inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition",
                  on ? (t === "overview" ? "border-primary bg-primary text-primary-fg" : cx(CLASS_BORDER[t], "bg-card text-fg shadow-sm")) : "border-border text-muted hover:text-fg")}>
                {t !== "overview" && <span className={cx("size-2.5 rounded-full", CLASS_DOT[t])} aria-hidden />}
                {t === "overview" ? "Overview" : CLASS_LABEL[t]}
              </button>
            );
          })}
        </div>
      )}

      {portfolio.isPending ? <PageSkeleton /> : portfolio.error ? <ErrorNote error={portfolio.error} retry={() => portfolio.refetch()} /> : p!.holdings.length === 0 ? (
        <Empty>No investments yet. Add an asset (a stock, crypto, a SIP or pension fund…) then record trades or contributions.</Empty>
      ) : active === "overview" ? (
        <Overview p={p!} trades={trades.data} tradesError={trades.error} onOpen={setTab} />
      ) : (
        <ClassTab cls={active} p={p!} trades={trades.data} />
      )}
      {/* keyed so each opening starts fresh with the class of the tab it was opened from */}
      <AssetDialog key={adding ?? "closed"} open={adding !== null} initialClass={adding ?? "stock"} onClose={() => setAdding(null)} />
    </div>
  );
}

type Portfolio = NonNullable<ReturnType<typeof usePortfolio>["data"]>;
const perCur = (m: PerCurrency) => Object.entries(m).filter(([, v]) => v !== 0);
/** A per-currency amount as text: "NPR 136,856.00 · THB 4,630.00" (never summed across currencies). */
const showPer = (m: PerCurrency, sign = false) => { const e = perCur(m); return e.length ? e.map(([c, v]) => formatMoney(v, c, { sign })).join(" · ") : "—"; };

function ClassCard({ t, onOpen }: { t: ClassTotals; onOpen?: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={cx("min-w-0 rounded-2xl border border-t-4 border-border bg-card p-4 text-left shadow-sm transition hover:shadow-md", CLASS_BORDER[t.cls].replace("border-", "border-t-"))}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted"><span className={cx("size-2 rounded-full", CLASS_DOT[t.cls])} />{CLASS_LABEL[t.cls]} capital</div>
      <div className={cx("mt-1 text-lg font-semibold tabular-nums", CLASS_TEXT[t.cls])}>{showPer(t.capital)}</div>
      <div className="mt-0.5 text-xs text-muted">{t.entries} {t.entries === 1 ? "entry" : "entries"} · {t.open} of {t.holdings} {t.holdings === 1 ? "holding" : "holdings"} open</div>
    </button>
  );
}

function CurrencyChips({ list, value, onChange }: { list: string[]; value: string; onChange: (c: string) => void }) {
  if (list.length < 2) return null;
  return <div className="flex gap-1" role="group" aria-label="Currency">{list.map((c) => <button key={c} type="button" aria-pressed={c === value} onClick={() => onChange(c)} className={cx("rounded-full border px-2.5 py-0.5 text-xs", c === value ? "border-primary text-primary" : "border-border text-muted")}>{c}</button>)}</div>;
}

function Overview({ p, trades, tradesError, onOpen }: { p: Portfolio; trades?: Trade[]; tradesError: unknown; onOpen: (t: Tab) => void }) {
  const totals = totalsByClass(p.holdings);
  const worth = portfolioValue(p.holdings);
  const byCur = new Map<string, number>();
  for (const h of p.holdings) { const c = shownIn(h.asset).cur; byCur.set(c, (byCur.get(c) ?? 0) + 1); }
  const [allocCur, setAllocCur] = useState<string | null>(null);
  const aCur = allocCur && worth[allocCur] !== undefined ? allocCur : Object.keys(worth)[0];
  const assets = assetIndex(p.holdings);
  const months = lastMonths(today(), 12);
  const curs = trades ? currenciesOf(trades, assets) : [];
  const [cur, setCur] = useState<string | null>(null);
  const chartCur = cur && curs.includes(cur) ? cur : curs[0];
  const monthly = trades && chartCur ? monthlyCapital(trades, assets, chartCur, months) : {};
  const maxEntries = Math.max(1, ...totals.map((t) => t.entries));
  const slices = aCur ? toSlices(totals.filter((c) => c.value[aCur]).map((c) => ({ label: CLASS_LABEL[c.cls], value: c.value[aCur]! })), totals.filter((c) => c.value[aCur]).map((c) => CLASS_VAR[c.cls]), 8) : [];
  return (
    <>
      {/* One total per currency: investments are only added up when they're in (or converted to) the same currency. */}
      <section aria-label="Portfolio value" className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-3">
        {Object.entries(worth).length === 0 ? <Stat label="Portfolio value" value="—" sub="nothing invested yet" /> : Object.entries(worth).map(([c, v]) => (
          <Stat key={c} label={Object.keys(worth).length > 1 ? `Portfolio value · ${c}` : "Portfolio value"} value={formatMoney(v, c)}
            sub={`${byCur.get(c) ?? 0} ${(byCur.get(c) ?? 0) === 1 ? "holding" : "holdings"} · latest prices, else cost`} />
        ))}
      </section>
      {Object.keys(worth).length > 1 && <p className="text-xs text-muted">Different currencies are kept apart. To see one total, add a conversion on an asset (its page → “Show in another currency”).</p>}

      <section aria-label="By type" className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3">
        {totals.map((t) => <ClassCard key={t.cls} t={t} onOpen={() => onOpen(t.cls)} />)}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Allocation{aCur && <span className="font-normal text-muted"> ({aCur})</span>}</h2><CurrencyChips list={Object.keys(worth)} value={aCur ?? ""} onChange={setAllocCur} /></div>
          <DonutChart slices={slices} centerLabel="Total" centerValue={aCur ? formatMoney(worth[aCur]!, aCur) : "—"} format={(v) => formatMoney(v, aCur!)} ariaLabel="Allocation by investment type" />
        </Card>
        <Card>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Capital added per month{chartCur && <span className="font-normal text-muted"> (last 12 months, {chartCur})</span>}</h2>
            <CurrencyChips list={curs} value={chartCur ?? ""} onChange={setCur} />
          </div>
          {tradesError ? <ErrorNote error={tradesError} /> : !trades ? <Skeleton className="h-52" /> : !chartCur || Object.keys(monthly).length === 0 ? <NoData>Nothing added in the last 12 months.</NoData> : (
            <LineChart labels={months.map(monthShort)} ariaLabel={`Capital added per month in ${chartCur}`} format={(v) => formatMoney(v, chartCur, { sign: true })} axis={(v) => compact(toMajor(v, chartCur))}
              series={(Object.keys(monthly) as AssetClass[]).map((c) => ({ name: CLASS_LABEL[c], values: monthly[c]!, className: CLASS_STROKE[c] }))} />
          )}
          <p className="mt-1 text-xs text-muted">Buys and contributions minus sells and withdrawals. Other currencies aren&apos;t mixed in — pick one above.</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Entries by type</h2>
          <ul className="space-y-3">
            {totals.map((t) => (
              <li key={t.cls}>
                <div className="flex justify-between text-sm"><span>{CLASS_LABEL[t.cls]}</span><span className={cx("font-semibold tabular-nums", CLASS_TEXT[t.cls])}>{t.entries}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-border"><div className={cx("bar-fill h-full rounded-full", CLASS_DOT[t.cls])} style={{ width: `${Math.max(2, (t.entries / maxEntries) * 100)}%` }} /></div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Recent activity</h2>
          {!trades ? <ListSkeleton rows={4} /> : <ActivityList trades={recent(trades, 8)} assets={assets} />}
        </Card>
      </div>

      <PortfolioChart />
    </>
  );
}

function ActivityList({ trades, assets }: { trades: Trade[]; assets: ReturnType<typeof assetIndex> }) {
  if (trades.length === 0) return <Empty>Nothing recorded yet.</Empty>;
  return (
    <ul className={cx("divide-y divide-border", SCROLL_LIST)} aria-label="Recent activity">
      {trades.map((t) => {
        const a = assets.get(t.assetId);
        if (!a) return null;
        return (
          <li key={t.id}>
            <Link href={`/investments/${t.assetId}`} className="flex items-center gap-3 px-1 py-2.5 hover:bg-border/30">
              <EntryIcon type={t.type} className="size-8" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{CLASS_LABEL[a.cls]} · {a.symbol} <span className="font-normal text-muted">· {entryLabel(t.type, { class: a.cls, tracking: a.tracking })}{t.quantity !== null ? ` ${formatQty(t.quantity)}` : ""}</span></span>
                <span className="block text-xs text-muted">{fmtDay(t.tradedOn)}</span>
              </span>
              <EntryAmount type={t.type} amountMinor={t.amountMinor} currency={a.currency} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ClassTab({ cls, p, trades }: { cls: AssetClass; p: Portfolio; trades?: Trade[] }) {
  const holdings = p.holdings.filter((h) => h.asset.class === cls).sort((x, y) => Number(x.closed) - Number(y.closed));
  const t = totalsByClass(holdings)[0]!;
  const units = holdings.some((h) => h.asset.tracking === "units");
  const traded = units || holdings.some((h) => amountOnlyTrade(h.asset));
  const assets = assetIndex(p.holdings);
  const curs = trades ? currenciesOf(trades, assets, cls) : [];
  const [cur, setCur] = useState<string | null>(null);
  const chartCur = cur && curs.includes(cur) ? cur : curs[0];
  const yearly = trades && chartCur ? yearlyCapital(trades, assets, cls, chartCur) : null;
  const dates = holdings.flatMap((h) => [h.firstTradedOn, h.lastTradedOn]).filter((d): d is string => !!d).sort();
  return (
    <>
      <section aria-label={`${CLASS_LABEL[cls]} summary`} className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-3">
        <Stat label="Capital at stake" value={showPer(t.capital)} cls={CLASS_TEXT[cls]} sub={units ? "cost of what you still hold" : "contributions minus withdrawals"} />
        <Stat label={traded ? "Total bought" : "Total contributed"} value={showPer(t.putIn)} sub="everything ever put in" />
        {units ? <Stat label="Realised P/L" value={showPer(t.realised, true)} sub="on units sold" /> : <Stat label="Current value" value={showPer(t.value)} sub="your latest value, else at cost" />}
        <Stat label="Entries" value={String(t.entries)} sub={`${t.open} of ${t.holdings} ${t.holdings === 1 ? "holding" : "holdings"} open`} />
      </section>
      {dates.length > 0 && <p className="text-xs text-muted">Entries from {fmtDay(dates[0]!)} to {fmtDay(dates[dates.length - 1]!)}</p>}

      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Capital added per year{chartCur && <span className="font-normal text-muted"> ({chartCur})</span>}</h2>
          <CurrencyChips list={curs} value={chartCur ?? ""} onChange={setCur} />
        </div>
        {!trades ? <Skeleton className="h-52" /> : !yearly || yearly.years.length === 0 ? <NoData>No entries yet.</NoData> : (
          <GroupedBarChart labels={yearly.years} ariaLabel={`${CLASS_LABEL[cls]} capital added per year in ${chartCur}`} format={(v) => formatMoney(v, chartCur!, { sign: true })} axis={(v) => compact(toMajor(v, chartCur!))}
            series={[{ name: "Capital added", values: yearly.values.map((v) => Math.max(0, v)), className: CLASS_FILL[cls] }]} />
        )}
      </Card>

      <ul className={cx("stagger space-y-3", SCROLL_LIST)} aria-label="Holdings">
        {holdings.map((h) => <HoldingRow key={h.asset.id} h={h} />)}
      </ul>

      <Card>
        <h2 className="mb-2 text-sm font-semibold">Latest {CLASS_LABEL[cls].toLowerCase()} entries</h2>
        {!trades ? <ListSkeleton rows={4} /> : <ActivityList trades={recent(trades, 12, cls, assets)} assets={assets} />}
      </Card>

      <RemoveType cls={cls} holdings={holdings} />
    </>
  );
}

/**
 * Removes a whole investment type, which means deleting its assets — allowed only while nothing is recorded under
 * it (the API refuses to delete an asset that has entries, so this is enforced there too, not just here).
 */
function RemoveType({ cls, holdings }: { cls: AssetClass; holdings: Holding[] }) {
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const entries = holdings.reduce((n, h) => n + h.tradeCount, 0);
  const label = CLASS_LABEL[cls];
  async function remove() {
    const names = holdings.map((h) => h.asset.symbol).join(", ");
    if (!(await confirm({ title: `Remove ${label}?`, confirmLabel: `Remove ${label}`, destructive: true, message: `This deletes ${holdings.length === 1 ? "its asset" : `its ${holdings.length} assets`} (${names}). Nothing is recorded under ${label}, so no entries are lost.` }))) return;
    setBusy(true); setError(null);
    try {
      for (const h of holdings) await call(client.DELETE("/investments/assets/{id}", { params: { path: { id: h.asset.id } } }));
      toast.success(`${label} removed`);
    } catch (e) { setError(e); } finally {
      setBusy(false);
      await invalidateInvestments(qc); // the tab disappears once its assets are gone
    }
  }
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 text-sm">
        <div className="font-medium">Remove {label}</div>
        <div className="text-muted">{entries === 0 ? `Nothing is recorded under ${label}, so it can be removed.` : `Only possible while nothing is recorded under ${label} — delete its ${entries} ${entries === 1 ? "entry" : "entries"} first, or archive the assets instead.`}</div>
        {error !== null && <div className="mt-2"><ErrorNote error={error} /></div>}
      </div>
      <Button variant="danger" onClick={remove} loading={busy} disabled={entries > 0}>Remove {label}</Button>
    </Card>
  );
}

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const monthShort = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en", { month: "short", year: "2-digit", timeZone: "UTC" });
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function Stat({ label, value, cls, sub }: { label: string; value: string; cls?: string; sub?: string }) {
  return (
    <Card>
      <div className="text-xs text-muted">{label}</div>
      <div className={cx("mt-1 text-xl font-semibold tabular-nums sm:text-2xl", cls)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </Card>
  );
}

/** One box of figures on a holding row (label, value, a short note underneath). */
function Figure({ label, value, note, cls }: { label: string; value: string; note: string; cls?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-bg/40 px-3 py-2 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={cx("whitespace-nowrap text-sm font-semibold tabular-nums", cls)}>{value}</div>
      <div className="truncate text-[11px] text-muted">{note}</div>
    </div>
  );
}

function HoldingRow({ h }: { h: Holding }) {
  const a = h.asset;
  const units = a.tracking === "units";
  const m = (n: number, o?: { sign?: boolean }) => formatMoney(n, a.currency, o);
  const sold = h.totalSoldMinor > 0;
  const figures = units ? [
    { label: "Avg price", value: h.avgCostMinor === null ? "—" : formatUnitPrice(h.avgCostMinor, a.currency), note: "per unit" },
    { label: "Total bought", value: m(h.totalBoughtMinor), note: "all buys ever", cls: "text-income" },
    ...(sold ? [{ label: "Sold", value: m(h.totalSoldMinor), note: "received", cls: "text-expense" }] : []),
    { label: "Remaining", value: m(h.remainingCostMinor), note: "capital at stake", cls: "text-primary" },
    h.marketValueMinor !== null && !h.closed
      ? { label: "Unrealised", value: m(h.unrealisedPnlMinor ?? 0, { sign: true }), note: `value ${m(h.marketValueMinor)}`, cls: tone(h.unrealisedPnlMinor) }
      : { label: "Realised P/L", value: sold ? m(h.realisedPnlMinor, { sign: true }) : "—", note: sold ? "on sold units" : "no sells yet", cls: tone(h.realisedPnlMinor) },
  ] : amountOnlyTrade(a) ? [
    { label: "Total bought", value: m(h.contributedMinor), note: "all buys ever", cls: "text-income" },
    ...(h.withdrawnMinor > 0 ? [{ label: "Sold", value: m(h.withdrawnMinor), note: "received", cls: "text-expense" }] : []),
    { label: "Remaining", value: m(h.remainingCostMinor), note: "capital at stake (buys + fees − sells)", cls: "text-primary" },
    { label: "Current value", value: h.marketValueMinor === null ? "—" : m(h.marketValueMinor), note: h.marketValueMinor === null ? "no value set" : `${formatPct(h.returnPct, true)} return`, cls: tone(h.unrealisedPnlMinor) },
  ] : [
    { label: "Contributed", value: m(h.contributedMinor), note: "paid in", cls: "text-income" },
    ...(h.withdrawnMinor > 0 ? [{ label: "Withdrawn", value: m(h.withdrawnMinor), note: "taken out", cls: "text-expense" }] : []),
    { label: "Net invested", value: m(h.remainingCostMinor), note: "capital at stake", cls: "text-primary" },
    { label: "Current value", value: h.marketValueMinor === null ? "—" : m(h.marketValueMinor), note: h.marketValueMinor === null ? "no value set" : `${formatPct(h.returnPct, true)} return`, cls: tone(h.unrealisedPnlMinor) },
  ];
  return (
    <li className={cx(h.closed && "opacity-55 transition-opacity hover:opacity-100")}>
      <Link href={`/investments/${a.id}`} aria-label={`${a.symbol}${h.closed ? " (closed)" : ""}`} className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/50">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 lg:w-72 lg:shrink-0">
            <div className="flex items-center gap-2">
              <span className={cx("size-2.5 shrink-0 rounded-full", CLASS_DOT[a.class])} aria-hidden />
              <span className="truncate text-base font-semibold">{a.symbol}</span>
              <span className="text-xs text-muted">{CLASS_LABEL[a.class]} · {a.currency}</span>
            </div>
            <div className="truncate text-sm text-primary">{a.name}</div>
            {a.convertCurrency && a.convertRate && <div className="text-xs text-muted">Counted in {a.convertCurrency} · 1 {a.currency} = {a.convertRate} {a.convertCurrency} · ≈ {formatMoney(Math.round(h.remainingCostMinor * shownIn(a).k), a.convertCurrency)} at stake</div>}
            <div className="text-xs text-muted">
              {h.tradeCount} {h.tradeCount === 1 ? "entry" : "entries"}{units && <> · {h.closed ? "0 units (closed)" : `${formatQty(h.quantity)} units`}</>}{!units && h.quantity > 0 && <> · {formatQty(h.quantity)} units noted</>}
            </div>
            {(h.lastBuyPriceMinor !== null || h.lastSellPriceMinor !== null) && (
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] tabular-nums">
                {h.lastBuyPriceMinor !== null && <span className="rounded-full border border-income/40 px-2 py-0.5 text-income">↗ Last buy: {formatUnitPrice(h.lastBuyPriceMinor, a.currency)}</span>}
                {h.lastSellPriceMinor !== null && <span className="rounded-full border border-expense/40 px-2 py-0.5 text-expense">↘ Last sell: {formatUnitPrice(h.lastSellPriceMinor, a.currency)}</span>}
              </div>
            )}
          </div>
          <div className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-2">
            {figures.map((f) => <Figure key={f.label} {...f} />)}
          </div>
        </div>
      </Link>
    </li>
  );
}

const CLASSES = Object.keys(CLASS_LABEL) as AssetClass[];
export function AssetDialog({ open, onClose, initialClass = "stock" }: { open: boolean; onClose: () => void; initialClass?: AssetClass }) {
  const { data: me } = useMe();
  const [cls, setCls] = useState<AssetClass>(initialClass);
  const choice = RECORD_CHOICE[cls];
  const [mode, setMode] = useState<"units" | "value" | null>(null);
  const tracking = choice ? (mode && choice.includes(mode) ? mode : choice[0]!) : defaultTracking(cls);
  const [error, setError] = useState<string | null>(null);
  const create = useMutate((body: Body<"/investments/assets", "post">) => call(client.POST("/investments/assets", { body })), async (qc) => { await invalidateInvestments(qc); await qc.invalidateQueries({ queryKey: qk.me }); }, "Asset added");
  const units = tracking === "units";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      await create.mutateAsync({ symbol: String(f.get("symbol")).trim(), name: String(f.get("name")).trim(), class: cls, currency: String(f.get("currency")), tracking, costMethod: (String(f.get("costMethod") || "wavg") as CostMethod) });
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Add asset">
      {open && (
        <form onSubmit={submit} className="space-y-3">
          <Field label="Type"><Select value={cls} onChange={(e) => setCls(e.target.value as AssetClass)}>{CLASSES.map((c) => <option key={c} value={c}>{CLASS_LABEL[c]}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Symbol / short name"><Input name="symbol" required maxLength={30} placeholder={units ? "e.g. ACME" : "e.g. GROWTH-SIP"} autoFocus /></Field>
            <Field label="Currency"><CurrencySelect name="currency" defaultValue={me?.baseCurrency ?? "THB"} current={me?.baseCurrency} /></Field>
          </div>
          <Field label="Name"><Input name="name" required maxLength={100} placeholder={units ? "e.g. Acme Corporation" : "e.g. Example Growth Fund"} /></Field>
          {choice && (
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-muted">How do you record it?</legend>
              <div role="radiogroup" aria-label="How do you record it?" className="grid gap-2 sm:grid-cols-2">
                {choice.map((m) => (
                  <label key={m} className={cx("flex cursor-pointer gap-2 rounded-lg border p-2.5 text-sm", tracking === m ? "border-primary bg-primary/10" : "border-border")}>
                    <input type="radio" name="tracking" value={m} checked={tracking === m} onChange={() => setMode(m)} className="mt-0.5 accent-[var(--primary)]" />
                    <span>{m === "value" ? <><b>Amount only</b><span className="block text-xs text-muted">Each buy or sell is an amount plus fee; the quantity is optional.</span></> : <><b>Units and price</b><span className="block text-xs text-muted">Each buy or sell is a quantity × price per unit.</span></>}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {units ? (
            <Field label="Cost method" hint="Weighted average is the default. “Selected buys” uses only buys you flag for the displayed average (your v1 “Use for avg”).">
              <Select name="costMethod" defaultValue="wavg"><option value="wavg">Weighted average</option><option value="fifo">FIFO</option><option value="manual">Selected buys (manual)</option></Select>
            </Field>
          ) : <p className="text-xs text-muted">{choice ? "You record what you paid and received; set the current total value yourself when you want to see a gain or loss." : "Tracked by value: you record contributions and withdrawals, and update the current total value yourself."}</p>}
          {error && <ErrorNote error={new Error(error)} />}
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={create.isPending}>Add</Button></div>
        </form>
      )}
    </Modal>
  );
}
