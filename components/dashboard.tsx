"use client";
import Link from "next/link";
import { useState } from "react";
import { useAccounts, useBudgetStatus, useByCategory, useMe, useSummary, useTransactions, useTrend, useCategories } from "@/lib/api/hooks";
import { budgetDate, formatMoney, monthRange } from "@/lib/money";
import { Card, Empty, ErrorNote, Skeleton, cx } from "./ui";
import { MonthPicker } from "./month-picker";
import { TransactionRow } from "./transaction-row";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const bandStyle = { healthy: "bg-income/15 text-income", low: "bg-warn/15 text-warn", overspending: "bg-expense/15 text-expense", none: "bg-border text-muted" } as const;
const bandText = { healthy: "Healthy savings", low: "Low buffer", overspending: "Spending more than earned", none: "No income" } as const;

export function Dashboard() {
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const { from, to } = monthRange(ym.year, ym.month);
  const { data: me } = useMe();
  const cur = me?.baseCurrency ?? "THB";
  const summary = useSummary(from, to);
  const byCat = useByCategory(from, to, "expense");
  const trend = useTrend(ym.year);
  const accounts = useAccounts();
  const cats = useCategories();
  const recent = useTransactions({ from, to });
  const budgets = useBudgetStatus(budgetDate(ym.year, ym.month, now));
  const s = summary.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <MonthPicker year={ym.year} month={ym.month} onChange={(year, month) => setYm({ year, month })} />
      </div>

      {summary.error ? <ErrorNote error={summary.error} retry={() => summary.refetch()} /> : (
        <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Income" value={s && formatMoney(s.incomeMinor, cur)} tone="income" />
          <Stat label="Expense" value={s && formatMoney(s.expenseMinor, cur)} tone="expense" />
          <Stat label="Net" value={s && formatMoney(s.netMinor, cur, { sign: true })} tone={s && s.netMinor < 0 ? "expense" : "income"} />
          <Card>
            <div className="text-xs text-muted">Savings rate</div>
            {s ? (<>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{s.savingsRatePct === null ? "—" : `${s.savingsRatePct.toFixed(1)}%`}</div>
              <span className={cx("mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium", bandStyle[s.savingsBand])}>{bandText[s.savingsBand]}</span>
            </>) : <Skeleton className="mt-2 h-8 w-24" />}
          </Card>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Top expenses</h2>
          {byCat.isPending ? <Skeleton className="h-40" /> : byCat.error ? <ErrorNote error={byCat.error} /> : byCat.data.items.length === 0 ? <Empty>No expenses this month.</Empty> : (
            <ul className="space-y-2.5">
              {byCat.data.items.slice(0, 8).map((i) => (
                <li key={i.categoryId ?? "none"}>
                  <div className="flex justify-between text-sm"><span className="truncate">{i.name}</span><span className="tabular-nums text-muted">{formatMoney(i.totalMinor, cur)} · {i.pct.toFixed(0)}%</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-expense" style={{ width: `${Math.max(2, i.pct)}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold">{ym.year}: income vs expense</h2>
          {trend.isPending ? <Skeleton className="h-40" /> : trend.error ? <ErrorNote error={trend.error} /> : <TrendChart income={trend.data.incomeMinor} expense={trend.data.expenseMinor} currency={cur} />}
        </Card>
      </div>

      {budgets.data && budgets.data.items.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Budgets</h2><Link href="/budgets" className="text-xs text-primary underline">Manage</Link></div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...budgets.data.items].sort((a, b) => b.pct - a.pct).slice(0, 3).map((b) => (
              <li key={b.id}>
                <div className="flex justify-between text-sm"><span className="truncate">{b.categoryName ?? "All expenses"}</span><span className={cx("tabular-nums", b.state === "over" ? "text-expense" : b.state === "warning" ? "text-warn" : "text-muted")}>{b.pct.toFixed(0)}%</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border"><div className={cx("h-full rounded-full", b.state === "over" ? "bg-expense" : b.state === "warning" ? "bg-warn" : "bg-income")} style={{ width: `${Math.min(100, b.pct)}%` }} /></div>
                <div className="mt-1 text-xs text-muted tabular-nums">{formatMoney(b.spentMinor, cur)} / {formatMoney(b.amountMinor, cur)}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card>
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Recent transactions</h2><Link href="/transactions" className="text-xs text-primary underline">View all</Link></div>
          {recent.isPending ? <Skeleton className="h-40" /> : recent.error ? <ErrorNote error={recent.error} /> : (recent.data.pages[0]?.data.length ?? 0) === 0 ? <Empty>Nothing recorded this month.</Empty> : (
            <ul className="divide-y divide-border">
              {recent.data.pages[0]!.data.slice(0, 6).map((t) => <TransactionRow key={t.id} tx={t} categories={cats.data} accounts={accounts.data} baseCurrency={cur} />)}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Accounts</h2>
          {accounts.isPending ? <Skeleton className="h-24" /> : accounts.error ? <ErrorNote error={accounts.error} /> : (
            <ul className="space-y-2">
              {accounts.data.filter((a) => !a.archived).map((a) => (
                <li key={a.id} className="flex justify-between text-sm"><span className="truncate">{a.name}</span><span className={cx("tabular-nums", a.balanceMinor < 0 && "text-expense")}>{formatMoney(a.balanceMinor, a.currency)}</span></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value?: string; tone: "income" | "expense" }) {
  return (
    <Card>
      <div className="text-xs text-muted">{label}</div>
      {value === undefined ? <Skeleton className="mt-2 h-8 w-28" /> : <div className={cx("mt-1 text-2xl font-semibold tabular-nums", tone === "income" ? "text-income" : "text-expense")}>{value}</div>}
    </Card>
  );
}

function TrendChart({ income, expense, currency }: { income: number[]; expense: number[]; currency: string }) {
  const max = Math.max(1, ...income, ...expense);
  const W = 600, H = 170, base = 150, bw = 14, gap = W / 12;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly income and expense" className="w-full">
      {income.map((v, i) => {
        const x = i * gap + gap / 2;
        const hi = (v / max) * (base - 10), he = (expense[i]! / max) * (base - 10);
        return (
          <g key={i}>
            <title>{`${MONTHS[i]}: income ${formatMoney(v, currency)}, expense ${formatMoney(expense[i]!, currency)}`}</title>
            <rect x={x - bw - 1} y={base - hi} width={bw} height={hi} rx={2} className="fill-income" />
            <rect x={x + 1} y={base - he} width={bw} height={he} rx={2} className="fill-expense" />
            <text x={x} y={H - 6} textAnchor="middle" className="fill-muted text-[11px]">{MONTHS[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}
