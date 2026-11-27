import type { AssetClass, Holding, Trade } from "@/lib/api/types";
import { CLASS_LABEL, entryLabel, entrySign } from "@/lib/investments";
import { toMajor } from "@/lib/money";

type Asset = Holding["asset"];
export interface ExportSheet { name: string; rows: Record<string, string | number | null>[] }

/**
 * One sheet per investment type, oldest entry first, amounts in major units of each asset's own currency.
 * "Signed amount" follows the list on screen: + for money put in or earned, − for money taken out.
 */
export function investmentSheets(trades: Trade[], assets: Asset[], classes: AssetClass[]): ExportSheet[] {
  const byId = new Map(assets.map((a) => [a.id, a]));
  return classes.map((cls) => ({
    name: CLASS_LABEL[cls].replace(/[\\/?*[\]:]/g, "-").slice(0, 31), // Excel sheet names: ≤31 chars, none of \ / ? * [ ] :
    rows: trades
      .filter((t) => byId.get(t.assetId)?.class === cls)
      .sort((x, y) => x.tradedOn.localeCompare(y.tradedOn) || x.createdAt.localeCompare(y.createdAt))
      .map((t) => {
        const a = byId.get(t.assetId)!;
        const amount = toMajor(t.amountMinor, a.currency);
        return {
          Date: t.tradedOn,
          Symbol: a.symbol,
          Name: a.name,
          Type: entryLabel(t.type, a),
          Quantity: t.quantity,
          Price: t.priceMinor === null ? null : toMajor(t.priceMinor, a.currency),
          Amount: amount,
          "Signed amount": entrySign(t.type) * amount,
          Fee: toMajor(t.feeMinor, a.currency),
          Currency: a.currency,
          "Use for average": t.type === "buy" ? (t.includeInAvg ? "yes" : "no") : null,
          Note: t.note ?? "",
        };
      }),
  }));
}

/** File name for the download: `moneymgr-investments-<type|all>-<yyyy-mm-dd>.xlsx`. */
export const exportFileName = (cls: AssetClass | "all", today: string) => `moneymgr-investments-${cls === "all" ? "all" : cls.replace(/_/g, "-")}-${today}.xlsx`;
