"use client";
import { useMemo, useState } from "react";
import { call, client } from "@/lib/api/client";
import { invalidateLedger, invalidateRecurring, useAccounts, useCategories, useRecurring, useMutate } from "@/lib/api/hooks";
import type { Body, Frequency, RecurringRule } from "@/lib/api/types";
import { formatMoney, pad, toMajor, toMinor } from "@/lib/money";
import { Button, Card, Empty, ErrorNote, Field, Input, Modal, Segmented, Select, Skeleton, cx } from "./ui";
import { useConfirm } from "./feedback";

const UNIT: Record<Frequency, string> = { daily: "day", weekly: "week", monthly: "month", yearly: "year" };
export const freqLabel = (f: Frequency, n: number) => (n === 1 ? `Every ${UNIT[f]}` : `Every ${n} ${UNIT[f]}s`);
const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const refresh = (qc: import("@tanstack/react-query").QueryClient) => Promise.all([invalidateRecurring(qc), invalidateLedger(qc)]);

export function RecurringView() {
  const confirm = useConfirm();
  const rules = useRecurring();
  const accounts = useAccounts();
  const categories = useCategories();
  const [dialog, setDialog] = useState<{ edit?: RecurringRule } | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const patch = useMutate(({ id, body }: { id: string; body: Body<"/recurring/{id}", "patch"> }) => call(client.PATCH("/recurring/{id}", { params: { path: { id } }, body })), refresh, "Rule updated");
  const remove = useMutate((id: string) => call(client.DELETE("/recurring/{id}", { params: { path: { id } } })), refresh, "Rule deleted");
  const runDue = useMutate(() => call(client.POST("/recurring/run-due")), refresh, "Due rules processed");

  const sorted = useMemo(() => [...(rules.data ?? [])].sort((a, b) => Number(b.active) - Number(a.active) || a.nextRunOn.localeCompare(b.nextRunOn)), [rules.data]);
  const act = async (fn: () => Promise<unknown>) => { setActionError(null); try { await fn(); } catch (e) { setActionError(e instanceof Error ? e.message : "Something went wrong"); } };

  async function runNow() {
    setReport(null);
    try {
      const r = (await runDue.mutateAsync(undefined as never)).data;
      setReport(r.posted > 0 ? `Posted ${r.posted} transaction${r.posted === 1 ? "" : "s"}.` : r.errors.length ? `${r.errors.length} rule(s) could not run — see the error on each rule.` : "Nothing is due right now.");
    } catch (e) { setReport(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Recurring</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={runNow} disabled={runDue.isPending}>{runDue.isPending ? "Running…" : "Run due now"}</Button>
          <Button onClick={() => setDialog({})}>+ Add rule</Button>
        </div>
      </div>
      <p className="text-sm text-muted">Rules post automatically every 15 minutes while the server is running. Missed dates are never duplicated.</p>
      {actionError && <ErrorNote error={new Error(actionError)} />}
      {report && <div role="status" className="rounded-xl border border-border bg-card p-3 text-sm">{report}</div>}

      {rules.isPending ? <Skeleton className="h-48" /> : rules.error ? <ErrorNote error={rules.error} retry={() => rules.refetch()} /> : sorted.length === 0 ? (
        <Empty>No recurring rules. Add rent, salary or subscriptions so they record themselves.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sorted.map((r) => {
            const cat = categories.data?.find((c) => c.id === r.categoryId);
            const acct = accounts.data?.find((a) => a.id === r.accountId);
            const cur = acct?.currency ?? "THB";
            return (
              <Card key={r.id} className={cx(!r.active && "opacity-70")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium"><span aria-hidden className="mr-1.5">{cat?.icon ?? "↻"}</span>{r.note || cat?.name || (r.kind === "income" ? "Income" : "Expense")}</div>
                    <div className="text-xs text-muted">{freqLabel(r.frequency, r.interval)} · {acct?.name ?? "Account"}</div>
                  </div>
                  <div className={cx("shrink-0 font-semibold tabular-nums", r.kind === "income" ? "text-income" : "text-expense")}>{r.kind === "income" ? "+" : "−"}{formatMoney(r.amountMinor, cur)}</div>
                </div>
                <div className="mt-2 text-xs text-muted">
                  {r.active ? (<>Next: <span className="text-fg">{r.nextDates.map(short).join(" · ") || short(r.nextRunOn)}</span></>) : "Paused or finished"}
                  {r.endOn && <> · ends {short(r.endOn)}</>}
                </div>
                {r.lastError && <p role="alert" className="mt-2 rounded-lg bg-expense/10 p-2 text-xs text-expense">Last run failed: {r.lastError}</p>}
                <div className="mt-3 flex gap-3 text-xs text-muted">
                  <button className="underline" onClick={() => act(() => patch.mutateAsync({ id: r.id, body: { active: !r.active } }))}>{r.active ? "Pause" : "Resume"}</button>
                  <button className="underline" onClick={() => setDialog({ edit: r })}>Edit</button>
                  <button className="underline hover:text-expense" onClick={async () => (await confirm({ message: "Delete this rule? Transactions it already posted are kept.", destructive: true })) && act(() => remove.mutateAsync(r.id))}>Delete</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <RuleDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

function RuleDialog({ state, onClose }: { state: { edit?: RecurringRule } | null; onClose: () => void }) {
  const open = state !== null;
  const edit = state?.edit;
  const accounts = useAccounts();
  const categories = useCategories();
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [accountId, setAccountId] = useState("");
  const [startOn, setStartOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
  const account = accounts.data?.find((a) => a.id === (edit?.accountId ?? accountId)) ?? accounts.data?.find((a) => !a.archived);
  const save = useMutate(({ id, body }: { id: string; body: Body<"/recurring/{id}", "patch"> } | { id?: undefined; body: Body<"/recurring", "post"> }) => (id ? call(client.PATCH("/recurring/{id}", { params: { path: { id } }, body: body as Body<"/recurring/{id}", "patch"> })) : call(client.POST("/recurring", { body: body as Body<"/recurring", "post"> }))), refresh, "Rule saved");
  const pastStart = !edit && !!startOn && startOn < today;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const cur = account?.currency ?? "THB";
    const amountMinor = toMinor(Number(f.get("amount")), cur);
    if (!(amountMinor > 0)) return setError("Enter an amount greater than 0");
    const common = { amountMinor, categoryId: String(f.get("category") || "") || undefined, note: String(f.get("note") || "").trim() || undefined, frequency: String(f.get("frequency")) as Frequency, interval: Number(f.get("interval") || 1) };
    try {
      if (edit) await save.mutateAsync({ id: edit.id, body: { ...common, categoryId: common.categoryId ?? null, note: common.note ?? null, endOn: String(f.get("endOn") || "") || null } });
      else if (!account) return setError("Choose an account");
      else await save.mutateAsync({ body: { ...common, accountId: account.id, kind, startOn: String(f.get("startOn")), endOn: String(f.get("endOn") || "") || undefined, backfill: f.get("backfill") === "on" } });
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }

  const k = edit?.kind ?? kind;
  return (
    <Modal open={open} onClose={onClose} title={edit ? "Edit rule" : "Add recurring rule"}>
      {open && (
        <form key={edit?.id ?? "new"} onSubmit={submit} className="space-y-3">
          {!edit && <Segmented value={kind} onChange={setKind} options={[{ value: "expense", label: "Expense", tone: "expense" }, { value: "income", label: "Income", tone: "income" }]} />}
          {!edit && <Field label="Account"><Select value={account?.id ?? ""} onChange={(e) => setAccountId(e.target.value)}>{accounts.data?.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</Select></Field>}
          <Field label={`Amount (${account?.currency ?? "THB"})`}><Input name="amount" type="number" step="0.01" min="0" required defaultValue={edit ? toMajor(edit.amountMinor, account?.currency ?? "THB") : ""} autoFocus /></Field>
          <Field label="Category"><Select name="category" defaultValue={edit?.categoryId ?? ""}><option value="">Uncategorised</option>{categories.data?.filter((c) => c.kind === k && !c.archived).map((c) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}</Select></Field>
          <Field label="Note"><Input name="note" maxLength={500} defaultValue={edit?.note ?? ""} placeholder="e.g. Rent, Netflix" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Repeats"><Select name="frequency" defaultValue={edit?.frequency ?? "monthly"}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></Select></Field>
            <Field label="Every" hint="1 = every period"><Input name="interval" type="number" min="1" max="365" defaultValue={edit?.interval ?? 1} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!edit && <Field label="Start date"><Input name="startOn" type="date" required defaultValue={today} onChange={(e) => setStartOn(e.target.value)} /></Field>}
            <Field label="End date" hint="Optional"><Input name="endOn" type="date" defaultValue={edit?.endOn ?? ""} /></Field>
          </div>
          {pastStart && <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="backfill" className="mt-1" /><span>Also record the missed dates since the start date<span className="block text-xs text-muted">Otherwise it starts from the next upcoming date.</span></span></label>}
          {error && <ErrorNote error={new Error(error)} />}
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></div>
        </form>
      )}
    </Modal>
  );
}
