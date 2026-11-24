"use client";
import { useEffect, useMemo, useState } from "react";
import { useAccounts, useCategories, useMe, useTransactions } from "@/lib/api/hooks";
import type { Transaction } from "@/lib/api/types";
import { formatMoney, monthRange } from "@/lib/money";
import { MonthPicker } from "./month-picker";
import { TransactionForm } from "./transaction-form";
import { TransactionRow } from "./transaction-row";
import { Button, Card, Empty, ErrorNote, Input, Segmented, Select, Skeleton } from "./ui";

const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function TransactionsView() {
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [kind, setKind] = useState<"" | "income" | "expense">("");
  const [accountId, setAccountId] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(t); }, [search]);

  const { from, to } = monthRange(ym.year, ym.month);
  const { data: me } = useMe();
  const accounts = useAccounts();
  const categories = useCategories();
  const list = useTransactions({ from, to, kind, accountId, q });
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
        <div className="flex items-center gap-2">
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
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search note or category" aria-label="Search" className="min-w-48 flex-1" />
      </div>

      {list.isPending ? <Skeleton className="h-64" /> : list.error ? <ErrorNote error={list.error} retry={() => list.refetch()} /> : days.length === 0 ? (
        <Empty>{q || kind || accountId ? "No transactions match these filters." : "No transactions this month."}</Empty>
      ) : (
        <div className="space-y-3">
          {days.map((d) => (
            <Card key={d.day} className="p-3">
              <div className="mb-1 flex items-center justify-between px-2 text-xs text-muted">
                <span className="font-medium">{dayLabel(d.day)}</span>
                <span className="tabular-nums">{d.income > 0 && <span className="text-income">+{formatMoney(d.income, base)} </span>}{d.expense > 0 && <span className="text-expense">−{formatMoney(d.expense, base)}</span>}</span>
              </div>
              <ul className="divide-y divide-border">
                {d.items.map((t) => <TransactionRow key={t.id} tx={t} categories={categories.data} accounts={accounts.data} baseCurrency={base} onClick={() => setEditing(t)} />)}
              </ul>
            </Card>
          ))}
          {list.hasNextPage && <div className="text-center"><Button variant="ghost" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>{list.isFetchingNextPage ? "Loading…" : "Load more"}</Button></div>}
        </div>
      )}

      <TransactionForm open={adding} onClose={() => setAdding(false)} />
      <TransactionForm open={!!editing} tx={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
