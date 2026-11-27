"use client";
import ExpandMore from "@mui/icons-material/ExpandMore";
import { useState } from "react";
import { call, client } from "@/lib/api/client";
import { invalidateDebts, useDebt, useDebtSummary, useDebts, useMe, useMutate } from "@/lib/api/hooks";
import type { Debt, DebtPayment } from "@/lib/api/types";
import { formatDate, todayIso } from "@/lib/dates";
import { formatMoney, minorUnit, toMajor, toMinor } from "@/lib/money";
import { useConfirm } from "./feedback";
import { RowActions } from "./row-actions";
import { Button, Card, CardsSkeleton, Empty, ErrorNote, Field, Input, Modal, Segmented, Skeleton, cx, SCROLL_LIST } from "./ui";
import { CurrencySelect } from "./currency-options";

const step = (c: string) => (minorUnit(c) === 0 ? "1" : "0.01");

export function DebtsView() {
  const [status, setStatus] = useState<"open" | "settled" | "all">("open");
  const debts = useDebts(status);
  const summary = useDebtSummary();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Debt | "new" | null>(null);
  const [paying, setPaying] = useState<{ debt: Debt; payment?: DebtPayment } | null>(null);
  const [open, setOpen] = useState<string | null>(null); // the debt whose repayments are expanded
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
          <ul className={cx("stagger divide-y divide-border", SCROLL_LIST)}>
            {debts.data.map((d) => {
              const paidPct = Math.min(100, (d.paidMinor / d.principalMinor) * 100);
              return (
                <li key={d.id} className="px-2 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{d.counterparty}</span>
                      <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold", d.direction === "lent" ? "bg-income/15 text-income" : "bg-expense/15 text-expense")}>{d.direction === "lent" ? "Owes you" : "You owe"}</span>
                      {d.status === "overdue" && <span className="rounded-full bg-expense/15 px-2 py-0.5 text-[11px] font-semibold text-expense">Overdue</span>}
                      {d.status === "settled" && <span className="rounded-full bg-border/60 px-2 py-0.5 text-[11px] font-semibold text-muted">Settled</span>}
                    </div>
                    <div className="mt-1 h-1.5 max-w-xs overflow-hidden rounded-full bg-border"><div className="bar-fill h-full rounded-full bg-primary" style={{ width: `${paidPct}%` }} /></div>
                    <div className="mt-1 text-xs text-muted">{formatMoney(d.paidMinor, d.currency)} of {formatMoney(d.principalMinor, d.currency)} repaid · since {formatDate(d.startedOn)}{d.dueOn ? ` · due ${formatDate(d.dueOn)}` : ""}{d.note ? ` · ${d.note}` : ""}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted">Outstanding</div>
                    <div className="font-semibold tabular-nums">{formatMoney(d.outstandingMinor, d.currency)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {d.status !== "settled" && <Button variant="ghost" onClick={() => setPaying({ debt: d })}>Repayment</Button>}
                    <RowActions label={`debt with ${d.counterparty}`} onEdit={() => setEditing(d)}
                      onDelete={async () => { if (await confirm({ title: "Delete debt?", message: `Delete the debt with ${d.counterparty} and its repayment history?`, destructive: true })) remove.mutate(d.id); }} />
                  </div>
                  </div>
                  {d.paidMinor > 0 && <Repayments debt={d} open={open === d.id} onToggle={() => setOpen(open === d.id ? null : d.id)} onEdit={(payment) => setPaying({ debt: d, payment })} />}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <DebtDialog state={editing} onClose={() => setEditing(null)} />
      <PaymentDialog state={paying} onClose={() => setPaying(null)} />
    </div>
  );
}

function DebtDialog({ state, onClose }: { state: Debt | "new" | null; onClose: () => void }) {
  const { data: me } = useMe();
  const edit = state && state !== "new" ? state : null;
  const [direction, setDirection] = useState<"lent" | "borrowed">("lent");
  const [currency, setCurrency] = useState("");
  const [error, setError] = useState<string | null>(null);
  const cur = currency || edit?.currency || me?.baseCurrency || "THB";
  const relabel = !!edit && cur !== edit.currency;
  const save = useMutate(async (f: FormData) => {
    const principalMinor = toMinor(Number(f.get("amount")), cur);
    if (!(principalMinor > 0)) throw new Error("Enter an amount greater than 0");
    const dueOn = String(f.get("due") || "") || undefined;
    const note = String(f.get("note") || "").trim() || undefined;
    const counterparty = String(f.get("who")).trim();
    if (edit) return call(client.PATCH("/debts/{id}", { params: { path: { id: edit.id } }, body: { counterparty, principalMinor, ...(relabel ? { currency: cur } : {}), dueOn: dueOn ?? null, note: note ?? null } }));
    return call(client.POST("/debts", { body: { direction, counterparty, principalMinor, currency: cur, startedOn: String(f.get("start") || "") || undefined, dueOn, note } }));
  }, async (qc) => { await invalidateDebts(qc); await qc.invalidateQueries({ queryKey: ["me"] }); }, edit ? "Debt updated" : "Debt recorded");
  const close = () => { onClose(); setCurrency(""); setError(null); };
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    try { await save.mutateAsync(new FormData(e.currentTarget)); close(); } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  return (
    <Modal open={state !== null} onClose={close} title={edit ? "Edit debt" : "Record a debt"}>
      <form key={edit?.id ?? "new"} onSubmit={submit} className="space-y-3">
        {!edit && <Segmented value={direction} onChange={setDirection} options={[{ value: "lent", label: "I lent money", tone: "income" }, { value: "borrowed", label: "I borrowed money", tone: "expense" }]} />}
        <Field label={edit ? "Person or organisation" : direction === "lent" ? "Who owes you?" : "Who do you owe?"}><Input name="who" required maxLength={60} defaultValue={edit?.counterparty} autoFocus /></Field>
        <div className="grid grid-cols-[1fr_6.5rem] gap-3">
          <Field label="Amount"><Input name="amount" type="number" min="0" step={step(cur)} required defaultValue={edit ? toMajor(edit.principalMinor, edit.currency) : ""} /></Field>
          <Field label="Currency">
            <CurrencySelect value={cur} onChange={(e) => setCurrency(e.target.value)} current={cur} />
          </Field>
        </div>
        {relabel && <p className="text-xs text-muted">The amounts stay as typed, now in {cur}{edit!.paidMinor > 0 ? " — repayments too" : ""}. No exchange rate is applied.</p>}
        <div className="grid grid-cols-2 gap-3">
          {!edit && <Field label="Since"><Input name="start" type="date" defaultValue={todayIso()} /></Field>}
          <Field label="Due" hint="Optional"><Input name="due" type="date" defaultValue={edit?.dueOn ?? ""} /></Field>
        </div>
        <Field label="Note"><Input name="note" maxLength={1000} defaultValue={edit?.note ?? ""} placeholder="Optional" /></Field>
        {error && <ErrorNote error={new Error(error)} />}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button type="submit" loading={save.isPending}>Save</Button></div>
      </form>
    </Modal>
  );
}

function PaymentDialog({ state, onClose }: { state: { debt: Debt; payment?: DebtPayment } | null; onClose: () => void }) {
  const debt = state?.debt ?? null;
  const payment = state?.payment;
  const [error, setError] = useState<string | null>(null);
  // an edited repayment may grow up to what is still owed plus its own current amount
  const maxMinor = debt ? debt.outstandingMinor + (payment?.amountMinor ?? 0) : 0;
  const save = useMutate((f: FormData) => {
    const amountMinor = toMinor(Number(f.get("amount")), debt!.currency);
    if (!(amountMinor > 0)) throw new Error("Enter an amount greater than 0");
    const note = String(f.get("note") || "").trim();
    const date = String(f.get("date") || "");
    if (payment) return call(client.PATCH("/debts/{id}/payments/{paymentId}", { params: { path: { id: debt!.id, paymentId: payment.id } }, body: { amountMinor, note: note || null, ...(date ? { paidOn: date } : {}) } }));
    return call(client.POST("/debts/{id}/payments", { params: { path: { id: debt!.id } }, body: { amountMinor, paidOn: date || undefined, note: note || undefined } }));
  }, invalidateDebts, payment ? "Repayment updated" : "Repayment recorded");
  const close = () => { onClose(); setError(null); };
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    try { await save.mutateAsync(new FormData(e.currentTarget)); close(); } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  return (
    <Modal open={!!debt} onClose={close} title={debt ? `${payment ? "Edit repayment" : "Repayment"} · ${debt.counterparty}` : ""}>
      {debt && (
        <form key={payment?.id ?? debt.id} onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted">Outstanding: <strong className="text-fg">{formatMoney(debt.outstandingMinor, debt.currency)}</strong></p>
          <Field label={`Amount (${debt.currency})`}><Input name="amount" type="number" min="0" max={toMajor(maxMinor, debt.currency)} step={step(debt.currency)} required defaultValue={toMajor(payment?.amountMinor ?? debt.outstandingMinor, debt.currency)} autoFocus /></Field>
          <Field label="Date"><Input name="date" type="date" defaultValue={payment?.paidOn ?? todayIso()} /></Field>
          <Field label="Note"><Input name="note" maxLength={300} placeholder="Optional" defaultValue={payment?.note ?? ""} /></Field>
          {error && <ErrorNote error={new Error(error)} />}
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button type="submit" loading={save.isPending}>Save</Button></div>
        </form>
      )}
    </Modal>
  );
}

/** A debt's repayments, folded under its row; each one can be edited or deleted in place. */
function Repayments({ debt, open, onToggle, onEdit }: { debt: Debt; open: boolean; onToggle: () => void; onEdit: (p: DebtPayment) => void }) {
  const q = useDebt(open ? debt.id : null);
  const confirm = useConfirm();
  const debtId = debt.id; // from the row, never from dialog state that may have closed
  const del = useMutate((pid: string) => call(client.DELETE("/debts/{id}/payments/{paymentId}", { params: { path: { id: debtId, paymentId: pid } } })), invalidateDebts, "Repayment deleted");
  const panel = `debt-payments-${debt.id}`;
  return (
    <div className="mt-2">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panel} className="flex items-center gap-1 rounded-md py-0.5 text-xs font-medium text-muted hover:text-fg">
        <span>Repayments{q.data ? ` (${q.data.payments.length})` : ""}</span>
        <ExpandMore fontSize="small" className={cx("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div id={panel} className="mt-1 rounded-lg border border-border px-3">
          {q.isPending ? <Skeleton className="my-2 h-12" /> : q.error ? <ErrorNote error={q.error} retry={() => q.refetch()} />
            : q.data.payments.length === 0 ? <p className="py-2 text-xs text-muted">No repayments yet.</p> : (
              <ul className="max-h-72 divide-y divide-border overflow-y-auto">
                {q.data.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span className="min-w-0"><span className="block">{formatDate(p.paidOn)}</span>{p.note && <span className="block truncate text-xs text-muted">{p.note}</span>}</span>
                    <span className="flex items-center gap-1"><span className="font-semibold tabular-nums">{formatMoney(p.amountMinor, debt.currency)}</span>
                      <RowActions label={`repayment of ${formatDate(p.paidOn)}`} onEdit={() => onEdit(p)}
                        onDelete={async () => { if (await confirm({ title: "Delete repayment?", message: `Delete the ${formatMoney(p.amountMinor, debt.currency)} repayment of ${formatDate(p.paidOn)}?`, destructive: true })) del.mutate(p.id); }} /></span>
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}
    </div>
  );
}
