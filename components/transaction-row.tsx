"use client";
import type { Account, Category, Transaction } from "@/lib/api/types";
import { formatMoney } from "@/lib/money";
import { cx } from "./ui";

export function TransactionRow({ tx, categories, accounts, baseCurrency, onClick }: { tx: Transaction; categories?: Category[]; accounts?: Account[]; baseCurrency: string; onClick?: () => void }) {
  const cat = categories?.find((c) => c.id === tx.categoryId);
  const acct = accounts?.find((a) => a.id === tx.accountId);
  const transfer = tx.kind === "transfer_in" || tx.kind === "transfer_out";
  const positive = tx.kind === "income" || tx.kind === "transfer_in";
  const title = transfer ? (tx.kind === "transfer_out" ? "Transfer out" : "Transfer in") : (cat?.name ?? "Uncategorised");
  const Tag = onClick ? "button" : "div";
  return (
    <li>
      <Tag onClick={onClick} className={cx("flex w-full items-center gap-3 py-2.5 text-left", onClick && "rounded-lg px-2 hover:bg-border/40")}>
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-border/60 text-base">{transfer ? "⇄" : (cat?.icon ?? "•")}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-muted">{[tx.note, acct?.name].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="text-right">
          <span className={cx("block text-sm font-semibold tabular-nums", transfer ? "text-fg" : positive ? "text-income" : "text-expense")}>{positive ? "+" : "−"}{formatMoney(tx.amountMinor, tx.currency)}</span>
          {tx.currency !== baseCurrency && <span className="block text-xs text-muted">≈ {formatMoney(tx.baseAmountMinor, baseCurrency)}</span>}
        </span>
      </Tag>
    </li>
  );
}
