"use client";
import { useState } from "react";
import { call, client } from "@/lib/api/client";
import { invalidateBudgets, useBudgetStatus, useCategories, useMe, useMutate } from "@/lib/api/hooks";
import type { Body, BudgetPeriod, BudgetStatusItem } from "@/lib/api/types";
import { budgetDate, formatMoney, pad, toMajor, toMinor } from "@/lib/money";
import { MonthPicker } from "./month-picker";
import { Button, Card, Empty, ErrorNote, Field, Input, Modal, Select, Skeleton, cx } from "./ui";

const PERIOD: Record<BudgetPeriod, string> = { month: "Monthly", week: "Weekly", custom: "Custom range" };
const stateStyle = { ok: "bg-income", warning: "bg-warn", over: "bg-expense" } as const;
const stateText = { ok: "On track", warning: "Close to limit", over: "Over budget" } as const;
const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" });

export function BudgetsView() {
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const status = useBudgetStatus(budgetDate(ym.year, ym.month, now));
  const [dialog, setDialog] = useState<{ edit?: BudgetStatusItem } | null>(null);
  const base = status.data?.baseCurrency ?? "THB";
  const remove = useMutate((id: string) => call(client.DELETE("/budgets/{id}", { params: { path: { id } } })), invalidateBudgets);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Budgets</h1>
        <div className="flex items-center gap-2">
          <MonthPicker year={ym.year} month={ym.month} onChange={(year, month) => setYm({ year, month })} />
          <Button onClick={() => setDialog({})}>+ Add budget</Button>
        </div>
      </div>

      {status.isPending ? <Skeleton className="h-48" /> : status.error ? <ErrorNote error={status.error} retry={() => status.refetch()} /> : status.data.items.length === 0 ? (
        <Empty>No budgets active in this month. Add one to track your spending against a limit.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {status.data.items.map((b) => (
            <Card key={b.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{b.categoryName ?? "All expenses"}</div>
                  <div className="text-xs text-muted">{PERIOD[b.period]} · {short(b.window.from)} – {short(b.window.to)}</div>
                </div>
                <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", b.state === "ok" ? "bg-income/15 text-income" : b.state === "warning" ? "bg-warn/15 text-warn" : "bg-expense/15 text-expense")}>{stateText[b.state]}</span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(b.pct))} aria-label={`${b.categoryName ?? "All expenses"} budget used`}>
                <div className={cx("h-full rounded-full", stateStyle[b.state])} style={{ width: `${Math.min(100, b.pct)}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-sm tabular-nums">
                <span>{formatMoney(b.spentMinor, base)} <span className="text-muted">of {formatMoney(b.amountMinor, base)}</span></span>
                <span className={cx(b.remainingMinor < 0 ? "text-expense" : "text-muted")}>{b.remainingMinor < 0 ? `${formatMoney(-b.remainingMinor, base)} over` : `${formatMoney(b.remainingMinor, base)} left`} · {b.pct.toFixed(0)}%</span>
              </div>
              <div className="mt-3 flex gap-3 text-xs text-muted">
                <button className="underline" onClick={() => setDialog({ edit: b })}>Edit</button>
                <button className="underline hover:text-expense" onClick={() => confirm(`Delete the ${b.categoryName ?? "overall"} budget?`) && remove.mutate(b.id)}>Delete</button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <BudgetDialog state={dialog} base={base} onClose={() => setDialog(null)} />
    </div>
  );
}

function BudgetDialog({ state, base, onClose }: { state: { edit?: BudgetStatusItem } | null; base: string; onClose: () => void }) {
  const open = state !== null;
  const edit = state?.edit;
  const categories = useCategories();
  const [period, setPeriod] = useState<BudgetPeriod>("month");
  const [error, setError] = useState<string | null>(null);
  const save = useMutate(({ id, body }: { id: string; body: Body<"/budgets/{id}", "patch"> } | { id?: undefined; body: Body<"/budgets", "post"> }) => (id ? call(client.PATCH("/budgets/{id}", { params: { path: { id } }, body: body as Body<"/budgets/{id}", "patch"> })) : call(client.POST("/budgets", { body: body as Body<"/budgets", "post"> }))), invalidateBudgets);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const amountMinor = toMinor(Number(f.get("amount")), base);
    const alertThresholdPct = Number(f.get("threshold") || 80);
    if (!(amountMinor > 0)) return setError("Enter an amount greater than 0");
    try {
      if (edit) await save.mutateAsync({ id: edit.id, body: { amountMinor, alertThresholdPct } });
      else {
        const p = (f.get("period") as BudgetPeriod) ?? period;
        await save.mutateAsync({ body: { categoryId: String(f.get("category") || "") || undefined, period: p, amountMinor, alertThresholdPct, startOn: String(f.get("startOn") || "") || undefined, endOn: String(f.get("endOn") || "") || undefined } });
      }
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  return (
    <Modal open={open} onClose={onClose} title={edit ? "Edit budget" : "Add budget"}>
      {open && (
        <form key={edit?.id ?? "new"} onSubmit={submit} className="space-y-3">
          {!edit && (
            <>
              <Field label="Category"><Select name="category" defaultValue=""><option value="">All expenses</option>{categories.data?.filter((c) => c.kind === "expense" && !c.archived).map((c) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}</Select></Field>
              <Field label="Period"><Select name="period" value={period} onChange={(e) => setPeriod(e.target.value as BudgetPeriod)}>{(Object.keys(PERIOD) as BudgetPeriod[]).map((p) => <option key={p} value={p}>{PERIOD[p]}</option>)}</Select></Field>
              {period === "custom" ? (
                <div className="grid grid-cols-2 gap-3"><Field label="From"><Input name="startOn" type="date" required defaultValue={todayStr} /></Field><Field label="To"><Input name="endOn" type="date" required /></Field></div>
              ) : <Field label="Starts" hint="Defaults to today"><Input name="startOn" type="date" /></Field>}
            </>
          )}
          <Field label={`Limit (${base})`}><Input name="amount" type="number" step="0.01" min="0" required defaultValue={edit ? toMajor(edit.amountMinor, base) : ""} autoFocus /></Field>
          <Field label="Warn me at (% used)"><Input name="threshold" type="number" min="1" max="100" defaultValue={edit?.alertThresholdPct ?? 80} /></Field>
          {error && <ErrorNote error={new Error(error)} />}
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></div>
        </form>
      )}
    </Modal>
  );
}
