import type { AssetClass, TradeType } from "./api/types";

export const CLASS_LABEL: Record<AssetClass, string> = { stock: "Stock", crypto: "Crypto", fund: "Fund / SIP", retirement: "Retirement", gold: "Gold", fixed_deposit: "Fixed deposit", other: "Other" };
export const CLASS_DOT: Record<AssetClass, string> = { stock: "bg-primary", crypto: "bg-warn", fund: "bg-income", retirement: "bg-expense", gold: "bg-warn", fixed_deposit: "bg-muted", other: "bg-muted" };
export const defaultTracking = (c: AssetClass): "units" | "value" => (c === "stock" || c === "crypto" || c === "gold" ? "units" : "value");

export const TYPES_FOR: Record<"units" | "value", { value: TradeType; label: string }[]> = {
  units: [{ value: "buy", label: "Buy" }, { value: "sell", label: "Sell" }, { value: "bonus", label: "Bonus shares" }, { value: "dividend", label: "Dividend" }, { value: "fee", label: "Fee" }],
  value: [{ value: "contribution", label: "Contribution" }, { value: "withdrawal", label: "Withdrawal" }, { value: "dividend", label: "Dividend / interest" }, { value: "fee", label: "Fee" }],
};
export const TYPE_LABEL: Record<TradeType, string> = { buy: "Buy", sell: "Sell", bonus: "Bonus", dividend: "Dividend", fee: "Fee", contribution: "Contribution", withdrawal: "Withdrawal" };
/** Money flowing back to the investor is shown positive. */
export const isInflow = (t: TradeType) => t === "sell" || t === "dividend" || t === "withdrawal";
