import { describe, expect, it } from "vitest";
import type { Holding, Trade } from "@/lib/api/types";
import { exportFileName, investmentSheets } from "./invest-export";

const asset = (o: Partial<Holding["asset"]>) => ({ id: "a1", symbol: "NABIL", name: "Nabil Flexi Cap", class: "fund", currency: "NPR", tracking: "value", ...o }) as Holding["asset"];
const trade = (o: Partial<Trade>): Trade => ({ id: "t", userId: "u", assetId: "a1", type: "contribution", quantity: null, priceMinor: null, amountMinor: 100_000, feeMinor: 0, tradedOn: "2026-01-05", note: null, includeInAvg: true, clientId: null, createdAt: "2026-01-05T00:00:00Z", deletedAt: null, ...o });

describe("investmentSheets", () => {
  it("one sheet per type, oldest first, signed like the list on screen", () => {
    const assets = [asset({}), asset({ id: "a2", symbol: "ACME", name: "Acme", class: "stock", currency: "THB", tracking: "units" })];
    const trades = [
      trade({ id: "2", tradedOn: "2026-02-01", type: "withdrawal", amountMinor: 50_000, note: "fees" }),
      trade({ id: "1" }),
      trade({ id: "3", assetId: "a2", type: "buy", quantity: 10, priceMinor: 1_250, amountMinor: 12_500, feeMinor: 100, includeInAvg: false }),
    ];
    const [fund, stock] = investmentSheets(trades, assets, ["fund", "stock"]);
    expect(fund!.name).toBe("Fund - SIP");
    expect(fund!.rows.map((r) => [r.Date, r.Type, r.Amount, r["Signed amount"], r.Note])).toEqual([["2026-01-05", "Contribution", 1000, 1000, ""], ["2026-02-01", "Withdrawal", 500, -500, "fees"]]);
    expect(stock!.rows).toEqual([{ Date: "2026-01-05", Symbol: "ACME", Name: "Acme", Type: "Buy", Quantity: 10, Price: 12.5, Amount: 125, "Signed amount": 125, Fee: 1, Currency: "THB", "Use for average": "no", Note: "" }]);
  });
  it("names the file after the type", () => {
    expect(exportFileName("fixed_deposit", "2026-11-27")).toBe("moneymgr-investments-fixed-deposit-2026-11-27.xlsx");
    expect(exportFileName("all", "2026-11-27")).toBe("moneymgr-investments-all-2026-11-27.xlsx");
  });
});
