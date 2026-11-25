"use client";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccounts, useBudgetStatus, useByCategory, useCategories, useDaily, useLatestTransaction, useMe, useSummary, useTransactions, useTrend } from "@/lib/api/hooks";
import { compact, toSlices } from "@/lib/chart-utils";
import { budgetDate, formatMoney, monthLabel, monthRange, pad, shiftMonth, toMajor } from "@/lib/money";
import { DailyBars, DonutChart, Gauge, GroupedBarChart, LineChart } from "./charts";
import { MonthPicker } from "./month-picker";
import { TransactionRow } from "./transaction-row";
import { Button, Card, Empty, Skeleton, cx } from "./ui";
import { useCountUp } from "@/lib/use-count-up";
import { Widget } from "./widget";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PALETTE = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)", "var(--c7)", "var(--c8)"];
const bandText = { healthy: "Healthy savings", low: "Low buffer", overspending: "Spending more than earned", none: "No income" } as const;

export function Dashboard() {
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const touched = useRef(false); // once the user picks a month themselves we stop auto-selecting
  const { from, to } = monthRange(ym.year, ym.month);
  const prev = shiftMonth(ym.year, ym.month, -1);
  const prevRange = monthRange(prev.year, prev.month);
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const qc = useQueryClient();
  const me = useMe();
  const cur = me.data?.baseCurrency ?? "THB";
  const summary = useSummary(from, to);
  const prevSummary = useSummary(prevRange.from, prevRange.to);
  const expenseCats = useByCategory(from, to, "expense");
  const incomeCats = useByCategory(from, to, "income");
  const daily = useDaily(from, to);
  const trend = useTrend(ym.year);
  const accounts = useAccounts();
  const cats = useCategories();
  const budgets = useBudgetStatus(budgetDate(ym.year, ym.month, now));
  const recent = useTransactions({ from, to });
  const latest = useLatestTransaction();
  const s = summary.data;
  // A returning user whose current month is still empty lands on their most recent month with data instead of a blank page.
  useEffect(() => {
    if (touched.current || !latest.data || summary.data?.transactionCount !== 0) return;
    const [y, m] = latest.data.occurredOn.split("-").map(Number) as [number, number];
    if (y !== ym.year || m !== ym.month) setYm({ year: y, month: m });
  }, [latest.data, summary.data?.transactionCount, ym.year, ym.month]);
  const fmt = (v: number) => formatMoney(v, cur);
  const axis = (v: number) => compact(toMajor(v, cur));

  const expenseSlices = useMemo(() => toSlices((expenseCats.data?.items ?? []).map((i) => ({ label: i.name, value: i.totalMinor })), PALETTE), [expenseCats.data]);
  const incomeSlices = useMemo(() => toSlices((incomeCats.data?.items ?? []).map((i) => ({ label: i.name, value: i.totalMinor })), PALETTE), [incomeCats.data]);
  const activeAccounts = (accounts.data ?? []).filter((a) => !a.archived);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <MonthPicker year={ym.year} month={ym.month} onChange={(year, month) => { touched.current = true; setYm({ year, month }); }} />
      </div>

      {summary.error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-expense/40 bg-expense/10 p-3 text-sm text-expense">
          <span>{summary.error instanceof Error ? summary.error.message : "Couldn’t load your dashboard."}</span>
          <Button variant="ghost" onClick={() => void qc.invalidateQueries()}>Retry everything</Button>
        </div>
      )}
      <section aria-label="Summary" className="stagger grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Income" failed={!!summary.error} value={s && fmt(s.incomeMinor)} format={fmt} tone="income" now={s?.incomeMinor} before={prevSummary.data?.incomeMinor} goodWhenUp />
        <Kpi label="Expense" failed={!!summary.error} value={s && fmt(s.expenseMinor)} format={fmt} tone="expense" now={s?.expenseMinor} before={prevSummary.data?.expenseMinor} goodWhenUp={false} />
        <Kpi label="Net" failed={!!summary.error} value={s && formatMoney(s.netMinor, cur, { sign: true })} format={(n) => formatMoney(n, cur, { sign: true })} tone={s && s.netMinor < 0 ? "expense" : "income"} now={s?.netMinor} before={prevSummary.data?.netMinor} goodWhenUp />
        <Card className="col-span-2 p-3 xl:col-span-1">
          <div className="text-xs text-muted">Savings rate</div>
          {s ? <Gauge pct={s.savingsRatePct} band={s.savingsBand} label={bandText[s.savingsBand]} /> : summary.error ? <p className="mt-2 text-sm text-muted">—</p> : <Skeleton className="mt-2 h-24" />}
        </Card>
      </section>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Widget title={`Income vs expense · ${ym.year}`} className="lg:col-span-2" state={trend}>
          {trend.data && <GroupedBarChart labels={MONTHS} ariaLabel={`Monthly income and expense for ${ym.year}`} format={fmt} axis={axis}
            series={[{ name: "Income", values: trend.data.incomeMinor, className: "fill-income" }, { name: "Expense", values: trend.data.expenseMinor, className: "fill-expense" }]} />}
        </Widget>

        <Widget title="Where the money went" state={expenseCats}>
          <DonutChart slices={expenseSlices} centerLabel="Expenses" centerValue={fmt(expenseCats.data?.totalMinor ?? 0)} format={fmt} ariaLabel={`Expenses by category for ${monthLabel(ym.year, ym.month)}`} />
        </Widget>

        <Widget title={`Spending per day · ${monthLabel(ym.year, ym.month)}`} className="lg:col-span-2" state={daily}>
          {daily.data && <DailyBars days={daily.data.days.map((d) => ({ date: d.date, value: d.expenseMinor }))} today={todayStr} format={fmt} axis={axis} ariaLabel={`Daily spending for ${monthLabel(ym.year, ym.month)}`} />}
        </Widget>

        <Widget title="Income sources" state={incomeCats}>
          <DonutChart slices={incomeSlices} centerLabel="Income" centerValue={fmt(incomeCats.data?.totalMinor ?? 0)} format={fmt} ariaLabel={`Income by category for ${monthLabel(ym.year, ym.month)}`} />
        </Widget>

        <Widget title={`Net & running total · ${ym.year}`} className="lg:col-span-2" state={trend}>
          {trend.data && <LineChart labels={MONTHS} ariaLabel={`Monthly net and cumulative net for ${ym.year}`} format={(v) => formatMoney(v, cur, { sign: true })} axis={axis}
            series={[{ name: "Net", values: trend.data.netMinor, className: "stroke-primary", stroke: "area" }, { name: "Running total", values: trend.data.cumulativeNetMinor, className: "stroke-warn" }]} />}
        </Widget>

        <Widget title="Budgets" state={budgets} action={<Link href="/budgets" className="text-xs text-primary underline">Manage</Link>}>
          {budgets.data && (budgets.data.items.length === 0 ? <Empty>No budgets this month. <Link href="/budgets" className="text-primary underline">Add one</Link></Empty> : (
            <ul className="stagger space-y-3">
              {[...budgets.data.items].sort((a, b) => b.pct - a.pct).slice(0, 5).map((b) => (
                <li key={b.id}>
                  <div className="flex justify-between gap-2 text-sm"><span className="truncate">{b.categoryName ?? "All expenses"}</span><span className={cx("shrink-0 tabular-nums", b.state === "over" ? "text-expense" : b.state === "warning" ? "text-warn" : "text-muted")}>{b.pct.toFixed(0)}%</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border"><div className={cx("bar-fill h-full rounded-full", b.state === "over" ? "bg-expense" : b.state === "warning" ? "bg-warn" : "bg-income")} style={{ width: `${Math.min(100, b.pct)}%` }} /></div>
                  <div className="mt-0.5 text-xs text-muted tabular-nums">{fmt(b.spentMinor)} / {fmt(b.amountMinor)}</div>
                </li>
              ))}
            </ul>
          ))}
        </Widget>

        <Widget title="Recent transactions" className="lg:col-span-2" state={recent} action={<Link href="/transactions" className="text-xs text-primary underline">View all</Link>}>
          {(recent.data?.pages[0]?.data.length ?? 0) === 0 ? <Empty>Nothing recorded this month.</Empty> : (
            <ul className="stagger divide-y divide-border">
              {recent.data!.pages[0]!.data.slice(0, 6).map((t) => <TransactionRow key={t.id} tx={t} categories={cats.data} accounts={accounts.data} baseCurrency={cur} />)}
            </ul>
          )}
        </Widget>

        <Widget title="Accounts" state={accounts} action={<Link href="/accounts" className="text-xs text-primary underline">Manage</Link>}>
          {activeAccounts.length === 0 ? <Empty>No accounts yet.</Empty> : <BalanceBars accounts={activeAccounts} />}
        </Widget>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, now, before, goodWhenUp, failed, format }: { label: string; value?: string; failed?: boolean; format?: (n: number) => string; tone: "income" | "expense"; now?: number; before?: number; goodWhenUp: boolean }) {
  const delta = now !== undefined && before !== undefined && before !== 0 ? ((now - before) / Math.abs(before)) * 100 : null;
  const good = delta === null ? null : goodWhenUp ? delta >= 0 : delta <= 0;
  const rolling = useCountUp(value === undefined ? undefined : now);
  const shown = format && rolling !== undefined && rolling !== now ? format(rolling) : value;
  return (
    <Card className="p-3 sm:p-4">
      <div className="text-xs text-muted">{label}</div>
      {value === undefined ? (failed ? <div className="mt-1 text-lg text-muted sm:text-2xl">—</div> : <Skeleton className="mt-2 h-7 w-24" />) : <div className={cx("mt-1 truncate text-lg font-semibold tabular-nums sm:text-2xl", tone === "income" ? "text-income" : "text-expense")} title={value}>{shown}</div>}
      {delta !== null && Math.abs(delta) >= 0.5 && (
        <div className={cx("mt-1 text-xs tabular-nums", good ? "text-income" : "text-expense")} aria-label={`${delta > 0 ? "Up" : "Down"} ${Math.abs(delta).toFixed(0)} percent versus last month`}>{delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}% <span className="text-muted">vs last month</span></div>
      )}
    </Card>
  );
}

/** Balances side by side as bars (positive right of the axis in green, overdrawn in red), grouped by currency so units are never mixed. */
function BalanceBars({ accounts }: { accounts: { id: string; name: string; currency: string; balanceMinor: number }[] }) {
  const maxByCur = new Map<string, number>();
  for (const a of accounts) maxByCur.set(a.currency, Math.max(maxByCur.get(a.currency) ?? 0, Math.abs(a.balanceMinor)));
  return (
    <ul className="stagger space-y-3">
      {accounts.map((a) => {
        const pct = (Math.abs(a.balanceMinor) / (maxByCur.get(a.currency) || 1)) * 100;
        return (
          <li key={a.id}>
            <div className="flex justify-between gap-2 text-sm"><span className="truncate">{a.name}</span><span className={cx("shrink-0 tabular-nums", a.balanceMinor < 0 && "text-expense")}>{formatMoney(a.balanceMinor, a.currency)}</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border"><div className={cx("bar-fill h-full rounded-full", a.balanceMinor < 0 ? "bg-expense" : "bg-primary")} style={{ width: `${Math.max(2, pct)}%` }} /></div>
          </li>
        );
      })}
    </ul>
  );
}
