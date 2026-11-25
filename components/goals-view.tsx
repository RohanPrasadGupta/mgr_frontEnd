"use client";
import { useState } from "react";
import { call, client } from "@/lib/api/client";
import { invalidateGoals, useAccounts, useGoal, useGoals, useMe, useMutate } from "@/lib/api/hooks";
import type { Goal } from "@/lib/api/types";
import { formatDate, todayIso } from "@/lib/dates";
import { formatMoney, minorUnit, toMajor, toMinor } from "@/lib/money";
import { useConfirm } from "./feedback";
import { RowActions } from "./row-actions";
import { Button, Card, CardsSkeleton, Empty, ErrorNote, Field, Input, Modal, Segmented, Select, Skeleton, cx } from "./ui";

const STATUS: Record<Goal["status"], { label: string; cls: string }> = {
  reached: { label: "Reached", cls: "bg-income/15 text-income" },
  on_track: { label: "On track", cls: "bg-income/15 text-income" },
  behind: { label: "Behind", cls: "bg-warn/15 text-warn" },
  overdue: { label: "Past target date", cls: "bg-expense/15 text-expense" },
  no_deadline: { label: "No deadline", cls: "bg-border/60 text-muted" },
};
const step = (c: string) => (minorUnit(c) === 0 ? "1" : "0.01");

export function GoalsView() {
  const [archived, setArchived] = useState<"active" | "archived">("active");
  const goals = useGoals(archived === "archived");
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const [adding, setAdding] = useState<Goal | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const patch = useMutate(({ id, archived: a }: { id: string; archived: boolean }) => call(client.PATCH("/goals/{id}", { params: { path: { id } }, body: { archived: a } })), invalidateGoals, archived === "active" ? "Goal archived" : "Goal restored");
  const remove = useMutate((id: string) => call(client.DELETE("/goals/{id}", { params: { path: { id } } })), invalidateGoals, "Goal deleted");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Goals</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={archived} onChange={setArchived} options={[{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }]} />
          <Button onClick={() => setEditing("new")}>+ New goal</Button>
        </div>
      </div>
      {goals.isPending ? <CardsSkeleton count={3} /> : goals.error ? <ErrorNote error={goals.error} retry={() => goals.refetch()} /> : goals.data.length === 0 ? (
        <Empty>{archived === "active" ? "No goals yet. Saving for a trip, a laptop or an emergency fund? Add a goal and track it here." : "No archived goals."}</Empty>
      ) : (
        <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.data.map((g) => {
            const pct = Math.min(100, g.pct);
            return (
              <Card key={g.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => setDetail(g.id)} className="min-w-0 text-left">
                    <div className="truncate text-base font-semibold">{g.icon ? `${g.icon} ` : ""}{g.name}</div>
                    <div className="text-xs text-muted">{g.targetDate ? `By ${formatDate(g.targetDate)}` : "No target date"} · {g.source === "account" ? "tracks an account" : "manual savings"}</div>
                  </button>
                  <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS[g.status].cls)}>{STATUS[g.status].label}</span>
                </div>
                <div>
                  <div className="flex justify-between text-sm tabular-nums"><span className="font-semibold">{formatMoney(g.savedMinor, g.currency)}</span><span className="text-muted">of {formatMoney(g.targetMinor, g.currency)}</span></div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${g.name} progress`}>
                    <div className={cx("bar-fill h-full rounded-full", g.status === "reached" ? "bg-income" : g.status === "behind" || g.status === "overdue" ? "bg-warn" : "bg-primary")} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-muted tabular-nums"><span>{g.pct.toFixed(0)}%</span><span>{g.remainingMinor > 0 ? `${formatMoney(g.remainingMinor, g.currency)} to go` : "Done 🎉"}</span></div>
                </div>
                {g.monthlyNeededMinor !== null && <p className="text-xs text-muted">Save about <strong className="text-fg">{formatMoney(g.monthlyNeededMinor, g.currency)}</strong> a month to make it on time.</p>}
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2">
                  {g.source === "contributions" && !g.archived ? <Button variant="ghost" onClick={() => setAdding(g)}>+ Add money</Button> : <span className="text-xs text-muted">{g.archived ? "Archived" : "Updates with the account balance"}</span>}
                  <span className="flex items-center">
                    <button type="button" onClick={() => patch.mutate({ id: g.id, archived: !g.archived })} className="px-1 text-xs text-muted underline hover:text-fg">{g.archived ? "Restore" : "Archive"}</button>
                    <RowActions label={`goal ${g.name}`} onEdit={() => setEditing(g)}
                      onDelete={async () => { if (await confirm({ title: "Delete goal?", message: `Delete "${g.name}" and its saved-money history? Linked accounts are not affected.`, destructive: true })) remove.mutate(g.id); }} />
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <GoalDialog state={editing} onClose={() => setEditing(null)} />
      <ContributionDialog goal={adding} onClose={() => setAdding(null)} />
      <GoalDetail id={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function GoalDialog({ state, onClose }: { state: Goal | "new" | null; onClose: () => void }) {
  const { data: me } = useMe();
  const accounts = useAccounts();
  const edit = state && state !== "new" ? state : null;
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const key = state === "new" ? "new" : edit?.id;
  const acct = accounts.data?.find((a) => a.id === (edit ? edit.accountId ?? "" : accountId));
  const currency = edit?.currency ?? acct?.currency ?? me?.baseCurrency ?? "THB";
  const save = useMutate(async (f: FormData) => {
    const targetMinor = toMinor(Number(f.get("target")), currency);
    if (!(targetMinor > 0)) throw new Error("Enter a target greater than 0");
    const targetDate = String(f.get("date") || "") || undefined;
    const base = { name: String(f.get("name")).trim(), targetMinor, icon: String(f.get("icon") || "").trim() || undefined, note: String(f.get("note") || "").trim() || undefined };
    if (edit) return call(client.PATCH("/goals/{id}", { params: { path: { id: edit.id } }, body: { ...base, targetDate: targetDate ?? null, icon: base.icon ?? null, note: base.note ?? null } }));
    return call(client.POST("/goals", { body: { ...base, targetDate, accountId: accountId || undefined } }));
  }, invalidateGoals, edit ? "Goal updated" : "Goal created");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    try { await save.mutateAsync(new FormData(e.currentTarget)); onClose(); setAccountId(""); } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  return (
    <Modal open={state !== null} onClose={onClose} title={edit ? "Edit goal" : "New goal"}>
      <form key={key} onSubmit={submit} className="space-y-3">
        <Field label="Name"><Input name="name" required maxLength={60} defaultValue={edit?.name} placeholder="e.g. Emergency fund" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Target (${currency})`}><Input name="target" type="number" min="0" step={step(currency)} required defaultValue={edit ? toMajor(edit.targetMinor, edit.currency) : ""} /></Field>
          <Field label="Target date" hint="Optional"><Input name="date" type="date" min={edit ? undefined : todayIso()} defaultValue={edit?.targetDate ?? ""} /></Field>
        </div>
        {!edit && (
          <Field label="Track an account (optional)" hint="Progress follows that account's balance instead of money you add by hand.">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">No — I&apos;ll add money manually</option>
              {accounts.data?.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-[6rem_1fr] gap-3">
          <Field label="Icon"><Input name="icon" maxLength={8} defaultValue={edit?.icon ?? ""} placeholder="🎯" /></Field>
          <Field label="Note"><Input name="note" maxLength={1000} defaultValue={edit?.note ?? ""} placeholder="Optional" /></Field>
        </div>
        {error && <ErrorNote error={new Error(error)} />}
        <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></div>
      </form>
    </Modal>
  );
}

function ContributionDialog({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const [dir, setDir] = useState<"add" | "withdraw">("add");
  const [error, setError] = useState<string | null>(null);
  const save = useMutate((f: FormData) => {
    const minor = toMinor(Number(f.get("amount")), goal!.currency);
    if (!(minor > 0)) throw new Error("Enter an amount greater than 0");
    return call(client.POST("/goals/{id}/contributions", { params: { path: { id: goal!.id } }, body: { amountMinor: dir === "add" ? minor : -minor, occurredOn: String(f.get("date")) || undefined, note: String(f.get("note") || "").trim() || undefined } }));
  }, invalidateGoals, dir === "add" ? "Saved toward your goal" : "Withdrawal recorded");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    try { await save.mutateAsync(new FormData(e.currentTarget)); onClose(); setDir("add"); } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  return (
    <Modal open={!!goal} onClose={onClose} title={goal ? `Money for ${goal.name}` : ""}>
      {goal && (
        <form key={goal.id} onSubmit={submit} className="space-y-3">
          <Segmented value={dir} onChange={setDir} options={[{ value: "add", label: "Add", tone: "income" }, { value: "withdraw", label: "Take out", tone: "expense" }]} />
          <Field label={`Amount (${goal.currency})`}><Input name="amount" type="number" min="0" step={step(goal.currency)} required autoFocus /></Field>
          <Field label="Date"><Input name="date" type="date" defaultValue={todayIso()} /></Field>
          <Field label="Note"><Input name="note" maxLength={300} placeholder="Optional" /></Field>
          {error && <ErrorNote error={new Error(error)} />}
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={save.isPending}>Save</Button></div>
        </form>
      )}
    </Modal>
  );
}

function GoalDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const goal = useGoal(id);
  const confirm = useConfirm();
  const del = useMutate((cid: string) => call(client.DELETE("/goals/{id}/contributions/{contributionId}", { params: { path: { id: id!, contributionId: cid } } })), invalidateGoals, "Entry deleted");
  const g = goal.data?.goal;
  return (
    <Modal open={!!id} onClose={onClose} title={g?.name ?? "Goal"}>
      {goal.isPending ? <Skeleton className="h-32" /> : goal.error ? <ErrorNote error={goal.error} retry={() => goal.refetch()} /> : g && (
        <div className="space-y-3">
          <p className="text-sm">{formatMoney(g.savedMinor, g.currency)} of {formatMoney(g.targetMinor, g.currency)} · {g.pct.toFixed(0)}%{g.note ? ` · ${g.note}` : ""}</p>
          {g.source === "account" ? <p className="text-sm text-muted">This goal follows an account&apos;s balance, so there is no manual history.</p>
            : goal.data.contributions.length === 0 ? <Empty>No money added yet.</Empty> : (
              <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                {goal.data.contributions.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0"><span className="block">{formatDate(c.occurredOn)}</span>{c.note && <span className="block truncate text-xs text-muted">{c.note}</span>}</span>
                    <span className="flex items-center gap-1">
                      <span className={cx("font-semibold tabular-nums", c.amountMinor < 0 ? "text-expense" : "text-income")}>{c.amountMinor > 0 ? "+" : "−"}{formatMoney(Math.abs(c.amountMinor), g.currency)}</span>
                      <RowActions label="entry" onDelete={async () => { if (await confirm({ message: "Delete this entry?", destructive: true })) del.mutate(c.id); }} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}
    </Modal>
  );
}
