"use client";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import PrintRounded from "@mui/icons-material/PrintRounded";
import { useMemo, useState } from "react";
import { useReport } from "@/lib/api/hooks";
import type { Report } from "@/lib/api/types";
import { compact, toSlices } from "@/lib/chart-utils";
import { formatDate } from "@/lib/dates";
import { formatMoney, toMajor } from "@/lib/money";
import { DonutChart, GroupedBarChart } from "./charts";
import { MonthPicker } from "./month-picker";
import { Button, Card, Empty, ErrorNote, PageSkeleton, Segmented, cx } from "./ui";

const PALETTE = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)", "var(--c7)", "var(--c8)"];
const change = (now: number, before: number) => (before ? ((now - before) / Math.abs(before)) * 100 : null);

/** RFC 4180 CSV with spreadsheet-formula neutralising (a cell starting with = + - @ is prefixed with '). */
export function reportCsv(r: Report): string {
  // Plain numbers (including negatives like -5.00) stay numbers; any other text starting with a formula character is neutralised.
  const cell = (v: string | number) => { let s = String(v); if (typeof v === "string" && !/^-?\d+(\.\d+)?$/.test(s) && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const m = (minor: number) => toMajor(minor, r.baseCurrency).toFixed(2);
  const rows: (string | number)[][] = [
    ["MoneyMgr report", r.label], ["Period", `${r.from} to ${r.to}`], ["Currency", r.baseCurrency], [],
    ["", "This period", "Previous period"], ["Income", m(r.incomeMinor), m(r.previous.incomeMinor)], ["Expense", m(r.expenseMinor), m(r.previous.expenseMinor)], ["Net", m(r.netMinor), m(r.previous.netMinor)], [],
    ["Expense category", "Amount", "Share %", "Previous", "Change %"], ...r.expenseByCategory.map((c) => [c.name, m(c.totalMinor), c.pct.toFixed(1), m(c.previousMinor), c.changePct === null ? "" : c.changePct.toFixed(1)]), [],
    ["Income category", "Amount", "Share %", "Previous", "Change %"], ...r.incomeByCategory.map((c) => [c.name, m(c.totalMinor), c.pct.toFixed(1), m(c.previousMinor), c.changePct === null ? "" : c.changePct.toFixed(1)]), [],
    [r.period === "year" ? "Month" : "Day", "Income", "Expense"], ...r.series.map((s) => [s.from, m(s.incomeMinor), m(s.expenseMinor)]),
  ];
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

export function ReportsView() {
  const now = new Date();
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const report = useReport(period, year, month);
  const r = report.data;

  function download() {
    if (!r) return;
    const url = URL.createObjectURL(new Blob(["﻿", reportCsv(r)], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `moneymgr-report-${r.from.slice(0, period === "year" ? 4 : 7)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Segmented value={period} onChange={setPeriod} options={[{ value: "month", label: "Monthly" }, { value: "year", label: "Yearly" }]} />
          {period === "month" ? <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} /> : (
            <div className="inline-flex items-center gap-1">
              <Button variant="ghost" onClick={() => setYear((y) => y - 1)} aria-label="Previous year">‹</Button>
              <span className="min-w-16 text-center text-sm font-semibold tabular-nums">{year}</span>
              <Button variant="ghost" onClick={() => setYear((y) => y + 1)} aria-label="Next year">›</Button>
            </div>
          )}
          <Button variant="ghost" onClick={download} disabled={!r}><DownloadRounded fontSize="small" />CSV</Button>
          <Button variant="ghost" onClick={() => window.print()} disabled={!r}><PrintRounded fontSize="small" />Print / PDF</Button>
        </div>
      </div>
      {report.isPending ? <PageSkeleton /> : report.error ? <ErrorNote error={report.error} retry={() => report.refetch()} /> : r && <div className={cx("transition-opacity", report.isPlaceholderData && "refreshing")}><ReportBody r={r} /></div>}
    </div>
  );
}

function Delta({ now, before, goodWhenUp }: { now: number; before: number; goodWhenUp: boolean }) {
  const d = change(now, before);
  if (d === null || Math.abs(d) < 0.5) return <span className="text-xs text-muted">no change</span>;
  const good = goodWhenUp ? d > 0 : d < 0;
  return <span className={cx("text-xs tabular-nums", good ? "text-income" : "text-expense")}>{d > 0 ? "▲" : "▼"} {Math.abs(d).toFixed(0)}% vs previous</span>;
}

function ReportBody({ r }: { r: Report }) {
  const fmt = (v: number) => formatMoney(v, r.baseCurrency);
  const axis = (v: number) => compact(toMajor(v, r.baseCurrency));
  const slices = useMemo(() => toSlices(r.expenseByCategory.map((c) => ({ label: c.name, value: c.totalMinor })), PALETTE), [r]);
  if (r.transactionCount === 0 && r.previous.incomeMinor === 0 && r.previous.expenseMinor === 0) return <Empty>No income or expenses in {r.label}.</Empty>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{r.label} · {formatDate(r.from)} – {formatDate(r.to)} · {r.transactionCount} transactions · compared with {formatDate(r.previousFrom)} – {formatDate(r.previousTo)}</p>
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card className="p-3"><div className="text-xs text-muted">Income</div><div className="truncate text-xl font-semibold tabular-nums text-income">{fmt(r.incomeMinor)}</div><Delta now={r.incomeMinor} before={r.previous.incomeMinor} goodWhenUp /></Card>
        <Card className="p-3"><div className="text-xs text-muted">Expense</div><div className="truncate text-xl font-semibold tabular-nums text-expense">{fmt(r.expenseMinor)}</div><Delta now={r.expenseMinor} before={r.previous.expenseMinor} goodWhenUp={false} /></Card>
        <Card className="p-3"><div className="text-xs text-muted">Net</div><div className={cx("truncate text-xl font-semibold tabular-nums", r.netMinor < 0 ? "text-expense" : "text-income")}>{formatMoney(r.netMinor, r.baseCurrency, { sign: true })}</div><Delta now={r.netMinor} before={r.previous.netMinor} goodWhenUp /></Card>
        <Card className="p-3"><div className="text-xs text-muted">Savings rate · avg spend/day</div><div className="text-xl font-semibold tabular-nums">{r.savingsRatePct === null ? "—" : `${r.savingsRatePct.toFixed(0)}%`}</div><div className="text-xs text-muted tabular-nums">{fmt(r.avgDailyExpenseMinor)} per day</div></Card>
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="min-w-0"><h2 className="mb-2 text-sm font-semibold">{r.period === "year" ? "Month by month" : "Day by day"}</h2>
          <GroupedBarChart labels={r.series.map((s) => s.label)} ariaLabel={`Income and expense for ${r.label}`} format={fmt} axis={axis}
            series={[{ name: "Income", values: r.series.map((s) => s.incomeMinor), className: "fill-income" }, { name: "Expense", values: r.series.map((s) => s.expenseMinor), className: "fill-expense" }]} />
        </Card>
        <Card className="min-w-0"><h2 className="mb-2 text-sm font-semibold">Spending by category</h2>
          <DonutChart slices={slices} centerLabel="Expenses" centerValue={fmt(r.expenseMinor)} format={fmt} ariaLabel={`Expenses by category for ${r.label}`} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryTable title="Expenses by category" rows={r.expenseByCategory} fmt={fmt} upIsBad />
        <CategoryTable title="Income by category" rows={r.incomeByCategory} fmt={fmt} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0"><h2 className="mb-2 text-sm font-semibold">Biggest expenses</h2>
          {r.topExpenses.length === 0 ? <Empty>No expenses.</Empty> : (
            <ol className="divide-y divide-border text-sm">
              {r.topExpenses.map((t, i) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0"><span className="mr-2 text-xs text-muted">{i + 1}.</span><span className="font-medium">{t.categoryName ?? "Uncategorised"}</span>
                    <span className="block truncate text-xs text-muted">{[formatDate(t.occurredOn), t.note, t.accountName].filter(Boolean).join(" · ")}</span></span>
                  <span className="shrink-0 text-right font-semibold tabular-nums text-expense">{formatMoney(t.amountMinor, t.currency)}{t.currency !== r.baseCurrency && <span className="block text-xs font-normal text-muted">≈ {fmt(t.baseAmountMinor)}</span>}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <div className="space-y-4">
          <Card className="min-w-0"><h2 className="mb-2 text-sm font-semibold">By account</h2>
            {r.byAccount.length === 0 ? <Empty>No activity.</Empty> : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-medium">Account</th><th className="py-1 text-right font-medium">In</th><th className="py-1 text-right font-medium">Out</th></tr></thead>
                <tbody className="divide-y divide-border">{r.byAccount.map((a) => <tr key={a.accountId}><td className="py-1.5">{a.name}</td><td className="py-1.5 text-right tabular-nums text-income">{formatMoney(a.incomeMinor, a.currency)}</td><td className="py-1.5 text-right tabular-nums text-expense">{formatMoney(a.expenseMinor, a.currency)}</td></tr>)}</tbody>
              </table></div>
            )}
          </Card>
          <Card className="min-w-0"><h2 className="mb-2 text-sm font-semibold">Budgets</h2>
            {r.budgets.length === 0 ? <p className="text-sm text-muted">No budgets were active.</p> : (
              <ul className="space-y-2">{r.budgets.map((b) => (
                <li key={b.id}><div className="flex justify-between text-sm"><span>{b.categoryName ?? "All expenses"}</span><span className={cx("tabular-nums", b.state === "over" ? "text-expense" : b.state === "warning" ? "text-warn" : "text-muted")}>{fmt(b.spentMinor)} / {fmt(b.amountMinor)}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border"><div className={cx("bar-fill h-full rounded-full", b.state === "over" ? "bg-expense" : b.state === "warning" ? "bg-warn" : "bg-income")} style={{ width: `${Math.min(100, b.pct)}%` }} /></div></li>
              ))}</ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function CategoryTable({ title, rows, fmt, upIsBad }: { title: string; rows: Report["expenseByCategory"]; fmt: (v: number) => string; upIsBad?: boolean }) {
  return (
    <Card className="min-w-0"><h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? <Empty>Nothing here.</Empty> : (
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-medium">Category</th><th className="py-1 text-right font-medium">Amount</th><th className="py-1 text-right font-medium">Share</th><th className="py-1 text-right font-medium">vs previous</th></tr></thead>
          <tbody className="divide-y divide-border">
            {rows.map((c) => (
              <tr key={c.categoryId ?? c.name}>
                <td className="max-w-40 truncate py-1.5">{c.name}</td>
                <td className="py-1.5 text-right tabular-nums">{fmt(c.totalMinor)}</td>
                <td className="py-1.5 text-right tabular-nums text-muted">{c.pct.toFixed(0)}%</td>
                <td className={cx("py-1.5 text-right tabular-nums", c.changePct === null ? "text-muted" : (c.changePct > 0) === !!upIsBad ? "text-expense" : "text-income")}>
                  {c.changePct === null ? (c.totalMinor > 0 ? "new" : "—") : `${c.changePct > 0 ? "+" : ""}${c.changePct.toFixed(0)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </Card>
  );
}
