"use client";
import { useEffect, useMemo, useState } from "react";
import { call, client } from "@/lib/api/client";
import { invalidateLedger, useAccounts, useCategories, useMe, useMutate, useTags, useTransactions } from "@/lib/api/hooks";
import type { Transaction } from "@/lib/api/types";
import { formatMoney, monthRange } from "@/lib/money";
import { toast } from "@/lib/toast";
import { useConfirm } from "./feedback";
import { MonthPicker } from "./month-picker";
import { TransactionForm } from "./transaction-form";
import { TransactionRow } from "./transaction-row";
import { Button, Card, Empty, ErrorNote, Input, ListSkeleton, Segmented, Select, cx } from "./ui";

const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function TransactionsView() {
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [kind, setKind] = useState<"" | "income" | "expense">("");
  const [accountId, setAccountId] = useState("");
  const [tagId, setTagId] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [adding, setAdding] = useState(false);
  const confirm = useConfirm();
  const del = useMutate((t: Transaction) => call(client.DELETE("/transactions/{id}", { params: { path: { id: t.id } } })), invalidateLedger);
  async function remove(t: Transaction) {
    const transfer = t.kind === "transfer_in" || t.kind === "transfer_out";
    if (!(await confirm({ title: transfer ? "Delete transfer?" : "Delete transaction?", message: transfer ? "Both sides of this transfer will be removed and balances restored." : "This removes the transaction and updates your balances and reports.", destructive: true }))) return;
    try { await del.mutateAsync(t); toast.success(transfer ? "Transfer deleted" : "Transaction deleted"); } catch { /* the failure toast is raised centrally */ }
  }

  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(t); }, [search]);

  const { from, to } = monthRange(ym.year, ym.month);
  const { data: me } = useMe();
  const accounts = useAccounts();
  const categories = useCategories();
  const tags = useTags();
  const list = useTransactions({ from, to, kind, accountId, q, tagId });
  const base = me?.baseCurrency ?? "THB";

  const txs = useMemo(() => list.data?.pages.flatMap((p) => p.data) ?? [], [list.data]);
  const days = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of txs) (m.get(t.occurredOn) ?? m.set(t.occurredOn, []).get(t.occurredOn)!).push(t);
    return [...m].map(([day, items]) => ({
      day, items,
      income: items.filter((t) => t.kind === "income").reduce((s, t) => s + t.baseAmountMinor, 0),
      expense: items.filter((t) => t.kind === "expense").reduce((s, t) => s + t.baseAmountMinor, 0),
    }));
  }, [txs]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker year={ym.year} month={ym.month} onChange={(year, month) => setYm({ year, month })} />
          <Button onClick={() => setAdding(true)}>+ Add</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={kind} onChange={setKind} options={[{ value: "", label: "All" }, { value: "income", label: "Income", tone: "income" }, { value: "expense", label: "Expense", tone: "expense" }]} />
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-auto" aria-label="Account">
          <option value="">All accounts</option>
          {accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        {(tags.data?.length ?? 0) > 0 && (
          <Select value={tagId} onChange={(e) => setTagId(e.target.value)} className="w-auto" aria-label="Tag">
            <option value="">All tags</option>
            {tags.data!.map((t) => <option key={t.id} value={t.id}>#{t.name}</option>)}
          </Select>
        )}
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search note or category" aria-label="Search" className="min-w-48 flex-1" />
      </div>

      {list.isPending ? <ListSkeleton rows={8} /> : list.error ? <ErrorNote error={list.error} retry={() => list.refetch()} /> : days.length === 0 ? (
        <Empty>{q || kind || accountId || tagId ? "No transactions match these filters." : "No transactions this month."}</Empty>
      ) : (
        <div className={cx("space-y-3 transition-opacity", list.isPlaceholderData && "refreshing")} aria-busy={list.isPlaceholderData || undefined}>
          {days.map((d) => (
            <Card key={d.day} className="anim-rise p-3">
              <div className="mb-1 flex items-center justify-between px-2 text-xs text-muted">
                <span className="font-medium">{dayLabel(d.day)}</span>
                <span className="tabular-nums">{d.income > 0 && <span className="text-income">+{formatMoney(d.income, base)} </span>}{d.expense > 0 && <span className="text-expense">−{formatMoney(d.expense, base)}</span>}</span>
              </div>
              <ul className="stagger divide-y divide-border">
                {d.items.map((t) => <TransactionRow key={t.id} tx={t} categories={categories.data} accounts={accounts.data} tags={tags.data} baseCurrency={base} onEdit={() => setEditing(t)} onDelete={() => void remove(t)} busy={del.isPending && del.variables?.id === t.id} />)}
              </ul>
            </Card>
          ))}
          {list.hasNextPage && <div className="text-center"><Button variant="ghost" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>{list.isFetchingNextPage ? "Loading…" : "Load more"}</Button></div>}
        </div>
      )}

      <TransactionForm open={adding} onClose={() => setAdding(false)} />
      <TransactionForm open={!!editing} tx={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
