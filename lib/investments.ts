import type { AssetClass, TradeType } from "./api/types";

export const CLASS_LABEL: Record<AssetClass, string> = { stock: "Stock", crypto: "Crypto", fund: "Fund / SIP", retirement: "Retirement", gold: "Gold", fixed_deposit: "Fixed deposit", other: "Other" };
/** One colour per asset class, used for its tab, dots, bars and chart series (chart tokens work in light and dark). */
export const CLASS_DOT: Record<AssetClass, string> = { stock: "bg-chart-1", crypto: "bg-chart-3", fund: "bg-chart-5", retirement: "bg-chart-4", gold: "bg-chart-7", fixed_deposit: "bg-chart-2", other: "bg-chart-6" };
export const CLASS_TEXT: Record<AssetClass, string> = { stock: "text-chart-1", crypto: "text-chart-3", fund: "text-chart-5", retirement: "text-chart-4", gold: "text-chart-7", fixed_deposit: "text-chart-2", other: "text-chart-6" };
export const CLASS_BORDER: Record<AssetClass, string> = { stock: "border-chart-1", crypto: "border-chart-3", fund: "border-chart-5", retirement: "border-chart-4", gold: "border-chart-7", fixed_deposit: "border-chart-2", other: "border-chart-6" };
export const CLASS_FILL: Record<AssetClass, string> = { stock: "fill-chart-1", crypto: "fill-chart-3", fund: "fill-chart-5", retirement: "fill-chart-4", gold: "fill-chart-7", fixed_deposit: "fill-chart-2", other: "fill-chart-6" };
export const CLASS_STROKE: Record<AssetClass, string> = { stock: "stroke-chart-1", crypto: "stroke-chart-3", fund: "stroke-chart-5", retirement: "stroke-chart-4", gold: "stroke-chart-7", fixed_deposit: "stroke-chart-2", other: "stroke-chart-6" };
export const CLASS_VAR: Record<AssetClass, string> = { stock: "var(--c1)", crypto: "var(--c3)", fund: "var(--c5)", retirement: "var(--c4)", gold: "var(--c7)", fixed_deposit: "var(--c2)", other: "var(--c6)" };
/** Tab order on the investments board. */
export const CLASS_ORDER: AssetClass[] = ["stock", "crypto", "fund", "retirement", "gold", "fixed_deposit", "other"];
export const defaultTracking = (c: AssetClass): "units" | "value" => (c === "stock" || c === "crypto" || c === "gold" ? "units" : "value");

export const TYPES_FOR: Record<"units" | "value", { value: TradeType; label: string }[]> = {
  units: [{ value: "buy", label: "Buy" }, { value: "sell", label: "Sell" }, { value: "bonus", label: "Bonus shares" }, { value: "dividend", label: "Dividend" }, { value: "fee", label: "Fee" }],
  value: [{ value: "contribution", label: "Contribution" }, { value: "withdrawal", label: "Withdrawal" }, { value: "dividend", label: "Dividend / interest" }, { value: "fee", label: "Fee" }],
};
export const TYPE_LABEL: Record<TradeType, string> = { buy: "Buy", sell: "Sell", bonus: "Bonus", dividend: "Dividend", fee: "Fee", contribution: "Contribution", withdrawal: "Withdrawal" };
/** Things you buy and sell. Recorded by amount only (tracking "value"), their entries still read Buy / Sell. */
const TRADED: AssetClass[] = ["stock", "crypto", "gold"];
/** Types where the add-asset form asks how entries are recorded; the first option is the default. */
export const RECORD_CHOICE: Partial<Record<AssetClass, ("value" | "units")[]>> = { crypto: ["value", "units"] };
type AssetLike = { class: AssetClass; tracking: "units" | "value" };
export const amountOnlyTrade = (a: AssetLike) => a.tracking === "value" && TRADED.includes(a.class);
/** The entry types offered for an asset, labelled the way that asset talks (a crypto "contribution" is a Buy). */
export function typesFor(a: AssetLike): { value: TradeType; label: string }[] {
  if (!amountOnlyTrade(a)) return TYPES_FOR[a.tracking];
  return [{ value: "contribution", label: "Buy" }, { value: "withdrawal", label: "Sell" }, { value: "dividend", label: "Dividend" }, { value: "fee", label: "Fee" }];
}
export const entryLabel = (type: TradeType, a: AssetLike) => (amountOnlyTrade(a) && type === "contribution" ? "Buy" : amountOnlyTrade(a) && type === "withdrawal" ? "Sell" : TYPE_LABEL[type]);
/** Money flowing back to the investor is shown positive. */
export const isInflow = (t: TradeType) => t === "sell" || t === "dividend" || t === "withdrawal";
