"use client";
import type { Account, Category, Transaction } from "@/lib/api/types";
import { formatMoney } from "@/lib/money";
import { RowActions } from "./row-actions";
import { cx } from "./ui";

export function TransactionRow({ tx, categories, accounts, baseCurrency, onEdit, onDelete, busy }: { tx: Transaction; categories?: Category[]; accounts?: Account[]; baseCurrency: string; onEdit?: () => void; onDelete?: () => void; busy?: boolean }) {
  const cat = categories?.find((c) => c.id === tx.categoryId);
  const acct = accounts?.find((a) => a.id === tx.accountId);
  const transfer = tx.kind === "transfer_in" || tx.kind === "transfer_out";
  const positive = tx.kind === "income" || tx.kind === "transfer_in";
  const title = transfer ? (tx.kind === "transfer_out" ? "Transfer out" : "Transfer in") : (cat?.name ?? "Uncategorised");
  const body = (
    <>
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-border/60 text-base">{transfer ? "⇄" : (cat?.icon ?? "•")}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted">{[tx.note, acct?.name].filter(Boolean).join(" · ")}</span>
      </span>
      <span className="text-right">
        <span className={cx("block text-sm font-semibold tabular-nums", transfer ? "text-fg" : positive ? "text-income" : "text-expense")}>{positive ? "+" : "−"}{formatMoney(tx.amountMinor, tx.currency)}</span>
        {tx.currency !== baseCurrency && <span className="block text-xs text-muted">≈ {formatMoney(tx.baseAmountMinor, baseCurrency)}</span>}
      </span>
    </>
  );
  return (
    <li className={cx("flex items-center gap-1", (onEdit || onDelete) && "rounded-lg px-1 hover:bg-border/30")}>
      {onEdit ? <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-2.5 text-left">{body}</button> : <div className="flex min-w-0 flex-1 items-center gap-3 py-2.5">{body}</div>}
      {(onEdit || onDelete) && <RowActions label={title} onEdit={onEdit} onDelete={onDelete} disabled={busy} />}
    </li>
  );
}
