"use client";
import { useState } from "react";
import { call, client } from "@/lib/api/client";
import { invalidateDebts, useCurrencies, useDebt, useDebtSummary, useDebts, useMe, useMutate } from "@/lib/api/hooks";
import type { Debt } from "@/lib/api/types";
import { formatDate, todayIso } from "@/lib/dates";
import { formatMoney, minorUnit, toMajor, toMinor } from "@/lib/money";
import { useConfirm } from "./feedback";
import { RowActions } from "./row-actions";
import { Button, Card, CardsSkeleton, Empty, ErrorNote, Field, Input, Modal, Segmented, Select, Skeleton, cx } from "./ui";

const step = (c: string) => (minorUnit(c) === 0 ? "1" : "0.01");

export function DebtsView() {
  const [status, setStatus] = useState<"open" | "settled" | "all">("open");
  const debts = useDebts(status);
  const summary = useDebtSummary();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Debt | "new" | null>(null);
  const [paying, setPaying] = useState<Debt | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const remove = useMutate((id: string) => call(client.DELETE("/debts/{id}", { params: { path: { id } } })), invalidateDebts, "Debt deleted");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Debts</h1>
        <Button onClick={() => setEditing("new")}>+ Record debt</Button>
      </div>

      <section aria-label="Debt summary" className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {summary.isPending ? <Skeleton className="h-24" /> : summary.error ? <ErrorNote error={summary.error} retry={() => summary.refetch()} />
          : summary.data.totals.length === 0 ? <Card className="sm:col-span-2 xl:col-span-3"><p className="text-sm text-muted">Nothing outstanding — nobody owes you and you owe nobody. 🎉</p></Card>
            : summary.data.totals.map((t) => (
              <Card key={t.currency} className="grid grid-cols-2 gap-2">
                <div><div className="text-xs text-muted">Owed to you</div><div className="truncate text-lg font-semibold tabular-nums text-income">{formatMoney(t.owedToMeMinor, t.currency)}</div></div>
                <div><div className="text-xs text-muted">You owe</div><div className="truncate text-lg font-semibold tabular-nums text-expense">{formatMoney(t.iOweMinor, t.currency)}</div></div>
                <div className="col-span-2 border-t border-border pt-1.5 text-xs text-muted">Net <span className={cx("font-semibold tabular-nums", t.netMinor >= 0 ? "text-income" : "text-expense")}>{formatMoney(t.netMinor, t.currency, { sign: true })}</span>
                  {summary.data.overdueCount > 0 && <span className="ml-2 text-expense">· {summary.data.overdueCount} overdue</span>}</div>
              </Card>
            ))}
      </section>

      <Segmented value={status} onChange={setStatus} options={[{ value: "open", label: "Open" }, { value: "settled", label: "Settled" }, { value: "all", label: "All" }]} />

      {debts.isPending ? <CardsSkeleton count={3} /> : debts.error ? <ErrorNote error={debts.error} retry={() => debts.refetch()} /> : debts.data.length === 0 ? (
        <Empty>{status === "settled" ? "No settled debts yet." : "No open debts. Lent money to a friend or borrowed some? Record it to keep track of repayments."}</Empty>
      ) : (
        <Card className="p-2">
          <ul className="stagger divide-y divide-border">
            {debts.data.map((d) => {
              const paidPct = Math.min(100, (d.paidMinor / d.principalMinor) * 100);
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-3">
                  <button type="button" onClick={() => setDetail(d.id)} className="min-w-0 flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{d.counterparty}</span>
                      <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold", d.direction === "lent" ? "bg-income/15 text-income" : "bg-expense/15 text-expense")}>{d.direction === "lent" ? "Owes you" : "You owe"}</span>
                      {d.status === "overdue" && <span className="rounded-full bg-expense/15 px-2 py-0.5 text-[11px] font-semibold text-expense">Overdue</span>}
                      {d.status === "settled" && <span className="rounded-full bg-border/60 px-2 py-0.5 text-[11px] font-semibold text-muted">Settled</span>}
                    </div>
                    <div className="mt-1 h-1.5 max-w-xs overflow-hidden rounded-full bg-border"><div className="bar-fill h-full rounded-full bg-primary" style={{ width: `${paidPct}%` }} /></div>
                    <div className="mt-1 text-xs text-muted">{formatMoney(d.paidMinor, d.currency)} of {formatMoney(d.principalMinor, d.currency)} repaid · since {formatDate(d.startedOn)}{d.dueOn ? ` · due ${formatDate(d.dueOn)}` : ""}</div>
                  </button>
                  <div className="text-right">
                    <div className="text-xs text-muted">Outstanding</div>
                    <div className="font-semibold tabular-nums">{formatMoney(d.outstandingMinor, d.currency)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {d.status !== "settled" && <Button variant="ghost" onClick={() => setPaying(d)}>Repayment</Button>}
                    <RowActions label={`debt with ${d.counterparty}`} onEdit={() => setEditing(d)}
                      onDelete={async () => { if (await confirm({ title: "Delete debt?", message: `Delete the debt with ${d.counterparty} and its repayment history?`, destructive: true })) remove.mutate(d.id); }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <DebtDialog state={editing} onClose={() => setEditing(null)} />
      <PaymentDialog debt={paying} onClose={() => setPaying(null)} />
      <DebtDetail id={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function DebtDialog({ state, onClose }: { state: Debt | "new" | null; onClose: () => void }) {
  const { data: me } = useMe();
  const currencies = useCurrencies();
  const edit = state && state !== "new" ? state : null;
  const [direction, setDirection] = useState<"lent" | "borrowed">("lent");
  const [currency, setCurrency] = useState("");
  const [error, setError] = useState<string | null>(null);
  const cur = edit?.currency ?? (currency || me?.baseCurrency || "THB");
  const save = useMutate(async (f: FormData) => {
    const principalMinor = toMinor(Number(f.get("amount")), cur);
    if (!(principalMinor > 0)) throw new Error("Enter an amount greater than 0");
    const dueOn = String(f.get("due") || "") || undefined;
    const note = String(f.get("note") || "").trim() || undefined;
    const counterparty = String(f.get("who")).trim();
    if (edit) return call(client.PATCH("/debts/{id}", { params: { path: { id: edit.id } }, body: { counterparty, principalMinor, dueOn: dueOn ?? null, note: note ?? null } }));
    return call(client.POST("/debts", { body: { direction, counterparty, principalMinor, currency: cur, startedOn: String(f.get("start") || "") || undefined, dueOn, note } }));
  }, invalidateDebts, edit ? "Debt updated" : "Debt recorded");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    try { await save.mutateAsync(new FormData(e.currentTarget)); onClose(); } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  return (
    <Modal open={state !== null} onClose={onClose} title={edit ? "Edit debt" : "Record a debt"}>
      <form key={edit?.id ?? "new"} onSubmit={submit} className="space-y-3">
        {!edit && <Segmented value={direction} onChange={setDirection} options={[{ value: "lent", label: "I lent money", tone: "income" }, { value: "borrowed", label: "I borrowed money", tone: "expense" }]} />}
        <Field label={edit ? "Person or organisation" : direction === "lent" ? "Who owes you?" : "Who do you owe?"}><Input name="who" required maxLength={60} defaultValue={edit?.counterparty} autoFocus /></Field>
        <div className="grid grid-cols-[1fr_6.5rem] gap-3">
          <Field label="Amount"><Input name="amount" type="number" min="0" step={step(cur)} required defaultValue={edit ? toMajor(edit.principalMinor, edit.currency) : ""} /></Field>
          <Field label="Currency">
            <Select value={cur} disabled={!!edit} onChange={(e) => setCurrency(e.target.value)}>
              {(currencies.data ?? [{ code: cur }]).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {!edit && <Field label="Since"><Input name="start" type="date" defaultValue={todayIso()} /></Field>}
          <Field label="Due" hint="Optional"><Input name="due" type="date" defaultValue={edit?.dueOn ?? ""} /></Field>
        </div>
        <Field label="Note"><Input name="note" maxLength={1000} defaultValue={edit?.note ?? ""} placeholder="Optional" /></Field>
        {error && <ErrorNote error={new Error(error)} />}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={save.isPending}>Save</Button></div>
      </form>
    </Modal>
  );
}

function PaymentDialog({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const save = useMutate((f: FormData) => {
    const amountMinor = toMinor(Number(f.get("amount")), debt!.currency);
    if (!(amountMinor > 0)) throw new Error("Enter an amount greater than 0");
    return call(client.POST("/debts/{id}/payments", { params: { path: { id: debt!.id } }, body: { amountMinor, paidOn: String(f.get("date")) || undefined, note: String(f.get("note") || "").trim() || undefined } }));
  }, invalidateDebts, "Repayment recorded");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    try { await save.mutateAsync(new FormData(e.currentTarget)); onClose(); } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  return (
    <Modal open={!!debt} onClose={onClose} title={debt ? `Repayment · ${debt.counterparty}` : ""}>
      {debt && (
        <form key={debt.id} onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted">Outstanding: <strong className="text-fg">{formatMoney(debt.outstandingMinor, debt.currency)}</strong></p>
          <Field label={`Amount (${debt.currency})`}><Input name="amount" type="number" min="0" max={toMajor(debt.outstandingMinor, debt.currency)} step={step(debt.currency)} required defaultValue={toMajor(debt.outstandingMinor, debt.currency)} autoFocus /></Field>
          <Field label="Date"><Input name="date" type="date" defaultValue={todayIso()} /></Field>
          <Field label="Note"><Input name="note" maxLength={300} placeholder="Optional" /></Field>
          {error && <ErrorNote error={new Error(error)} />}
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={save.isPending}>Save</Button></div>
        </form>
      )}
    </Modal>
  );
}

function DebtDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useDebt(id);
  const confirm = useConfirm();
  const del = useMutate((pid: string) => call(client.DELETE("/debts/{id}/payments/{paymentId}", { params: { path: { id: id!, paymentId: pid } } })), invalidateDebts, "Repayment deleted");
  const d = q.data?.debt;
  return (
    <Modal open={!!id} onClose={onClose} title={d ? d.counterparty : "Debt"}>
      {q.isPending ? <Skeleton className="h-32" /> : q.error ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : d && (
        <div className="space-y-3">
          <p className="text-sm">{d.direction === "lent" ? "Owes you" : "You owe"} {formatMoney(d.outstandingMinor, d.currency)} of {formatMoney(d.principalMinor, d.currency)}{d.note ? ` · ${d.note}` : ""}</p>
          {q.data.payments.length === 0 ? <Empty>No repayments yet.</Empty> : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {q.data.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0"><span className="block">{formatDate(p.paidOn)}</span>{p.note && <span className="block truncate text-xs text-muted">{p.note}</span>}</span>
                  <span className="flex items-center gap-1"><span className="font-semibold tabular-nums">{formatMoney(p.amountMinor, d.currency)}</span>
                    <RowActions label="repayment" onDelete={async () => { if (await confirm({ message: "Delete this repayment?", destructive: true })) del.mutate(p.id); }} /></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
