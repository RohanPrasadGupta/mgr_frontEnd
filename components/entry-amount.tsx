import ArrowDownward from "@mui/icons-material/ArrowDownward";
import ArrowUpward from "@mui/icons-material/ArrowUpward";
import type { TradeType } from "@/lib/api/types";
import { entrySign } from "@/lib/investments";
import { formatMoney } from "@/lib/money";
import { cx } from "./ui";

/** Green ↑ for money going in (or earned), red ↓ for money coming out; a bonus is grey. */
export function EntryIcon({ type, className }: { type: TradeType; className?: string }) {
  const s = entrySign(type);
  return (
    <span aria-hidden className={cx("grid size-7 shrink-0 place-items-center rounded-full", s > 0 ? "bg-income/15 text-income" : s < 0 ? "bg-expense/15 text-expense" : "bg-border/60 text-muted", className)}>
      {s < 0 ? <ArrowDownward sx={{ fontSize: 16 }} /> : <ArrowUpward sx={{ fontSize: 16 }} />}
    </span>
  );
}

/** "+NPR 1,000.00" in green or "−NPR 1,000.00" in red; a bonus reads "free". */
export function EntryAmount({ type, amountMinor, currency, className }: { type: TradeType; amountMinor: number; currency: string; className?: string }) {
  const s = entrySign(type);
  return (
    <span className={cx("text-sm font-semibold tabular-nums", s > 0 ? "text-income" : s < 0 ? "text-expense" : "text-muted", className)}>
      {s === 0 ? "free" : `${s > 0 ? "+" : "−"}${formatMoney(amountMinor, currency)}`}
    </span>
  );
}
