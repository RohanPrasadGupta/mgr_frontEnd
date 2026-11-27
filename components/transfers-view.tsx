"use client";
import { useState } from "react";
import { useAccounts, useTransfers, type TransferPair } from "@/lib/api/hooks";
import type { Transaction } from "@/lib/api/types";
import { formatMoney, monthRange } from "@/lib/money";
import { MonthPicker } from "./month-picker";
import { TransactionForm } from "./transaction-form";
import { TransferDialog } from "./transfer-dialog";
import { Button, Card, Empty, ErrorNote, ListSkeleton, cx, SCROLL_LIST } from "./ui";

const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function TransfersView() {
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const { from, to } = monthRange(ym.year, ym.month);
  const transfers = useTransfers(from, to);
  const accounts = useAccounts();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const name = (id: string) => accounts.data?.find((a) => a.id === id)?.name ?? "Account";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Transfers</h1>
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker year={ym.year} month={ym.month} onChange={(year, month) => setYm({ year, month })} />
          <Button onClick={() => setAdding(true)}>+ New transfer</Button>
        </div>
      </div>
      <p className="text-sm text-muted">Moving money between your own accounts. Transfers change balances but never count as income or expense.</p>

      {transfers.isPending ? <ListSkeleton rows={5} /> : transfers.error ? <ErrorNote error={transfers.error} retry={() => transfers.refetch()} /> : transfers.data.length === 0 ? (
        <Empty>No transfers this month.</Empty>
      ) : (
        <Card className={cx("p-2", transfers.isPlaceholderData && "refreshing")}>
          <ul className={cx("stagger divide-y divide-border", SCROLL_LIST)}>
            {transfers.data.map((p: TransferPair) => (
              <li key={p.groupId}>
                <button onClick={() => setEditing(p.out)} className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-border/40">
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-border/60">⇄</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{name(p.out.accountId)} <span className="text-muted">→</span> {p.in ? name(p.in.accountId) : "?"}</span>
                    <span className="block truncate text-xs text-muted">{dayLabel(p.out.occurredOn)}{p.out.note && ` · ${p.out.note}`}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-semibold tabular-nums">{formatMoney(p.out.amountMinor, p.out.currency)}</span>
                    {p.in && p.in.currency !== p.out.currency && <span className="block text-xs text-muted tabular-nums">→ {formatMoney(p.in.amountMinor, p.in.currency)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <TransferDialog open={adding} onClose={() => setAdding(false)} />
      <TransactionForm open={!!editing} tx={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
