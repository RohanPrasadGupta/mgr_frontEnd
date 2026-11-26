import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { chunks, currencyCheck, readRestoreWorkbook } from "./restore";

/** A workbook laid out exactly like the old app's "Download Excel backup" (moneyMgr: exportPage/backupWorkbook.js). */
function oldAppBackup() {
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: unknown[][]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  add("Transactions", [["Date", "Account", "Category", "Note", "Currency", "Amount", "Income/Expense"], ["2025-08-26 09:15:00", "Cash", "🍜 Food", "lunch", "THB", 120, "Expense"]]);
  add("Notes", [["Date", "Title", "Content"], ["2025-03-01 09:30:00", "Tax", "keep receipts"]]);
  add("Categories", [["Name", "Type", "Currency"], ["🍜 Food", "Expense", "THB"], ["💰 Salary", "Income", "THB"]]);
  add("Currencies", [["Code", "Name", "Symbol", "Default"], ["NPR", "Nepalese Rupee", "₨", "FALSE"], ["thb", "Thai Baht", "฿", "TRUE"]]);
  add("Stock trades", [["ID", "Date", "Symbol", "Name", "Type", "Price", "Quantity", "Total", "Currency", "Use for avg price"], ["a1", "2024-05-02", "NABIL", "Nabil Bank", "BUY", 500, 10, 5000, "NPR", "TRUE"]]);
  add("Stock capital", [["ID", "Date", "Type", "Amount", "Currency"]]);
  add("Coin capital", [["ID", "Date", "Type", "Amount", "Charge", "Total", "Currency"], ["c1", "2024-01-20", "BUY", 30000, 300, 30300, "THB"]]);
  add("SIP capital", [["ID", "Date", "Name", "Amount", "Currency"], ["s1", "2024-02-01", "NIBL Sahabhagita", 1000, "NPR"]]);
  add("SSF capital", [["ID", "Date added", "Paid date", "Amount", "Months paid", "Total", "Currency", "Notes"], ["f1", "2024-03-01", "2024-03-05", 500, 3, 1500, "NPR", ""]]);
  // round-trip through real .xlsx bytes, as the browser would read the downloaded file
  return XLSX.read(XLSX.write(wb, { type: "array", bookType: "xlsx" }), { type: "array" });
}

describe("readRestoreWorkbook", () => {
  it("turns every sheet of the old app's backup into import rows", () => {
    const r = readRestoreWorkbook(XLSX as never, oldAppBackup(), "THB");
    expect(r.transactions).toEqual([{ date: "2025-08-26 09:15:00", account: "Cash", category: "🍜 Food", note: "lunch", currency: "THB", amount: 120, type: "Expense" }]);
    expect(r.categories).toEqual([{ name: "🍜 Food", type: "Expense" }, { name: "💰 Salary", type: "Income" }]);
    expect(r.currencies).toEqual([{ code: "NPR", name: "Nepalese Rupee", symbol: "₨", isDefault: false }, { code: "THB", name: "Thai Baht", symbol: "฿", isDefault: true }]);
    expect(r.notes).toEqual([{ title: "Tax", body: "keep receipts", date: "2025-03-01 09:30:00" }]);
    expect(r.investments["stock-transactions"]).toEqual([{ _id: "a1", investedDate: "2024-05-02T12:00:00.000Z", stockSymbol: "NABIL", stockName: "Nabil Bank", type: "BUY", price: 500, quantity: 10, totalAmount: 5000, currency: "NPR", useForAvgPrice: true }]);
    expect(r.investments["stock-capital"]).toEqual([]);
    expect(r.investments["coin-capital"][0]).toMatchObject({ _id: "c1", date: "2024-01-20T12:00:00.000Z", amount: 30000, transactionCharge: 300 });
    expect(r.investments["sip-capital"][0]).toMatchObject({ name: "NIBL Sahabhagita", amount: 1000 });
    expect(r.investments["ssf-capital"][0]).toEqual({ _id: "f1", dateAdded: "2024-03-01T12:00:00.000Z", paidDate: "2024-03-05T12:00:00.000Z", amount: 500, monthsPaid: 3, totalAmount: 1500, currency: "NPR" });
  });

  it("still reads dates Excel turned into real date cells after the file was edited", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([["ID", "Date", "Type", "Amount", "Currency"], ["x", new Date(2024, 0, 20), "BUY", 10, "NPR"]], { cellDates: false });
    XLSX.utils.book_append_sheet(wb, ws, "Stock capital");
    const r = readRestoreWorkbook(XLSX as never, wb, "THB");
    expect(r.investments["stock-capital"][0]!["date"]).toBe("2024-01-20T12:00:00.000Z");
  });

  it("refuses a spreadsheet that isn't an old-app backup", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["a"]]), "Sheet1");
    expect(() => readRestoreWorkbook(XLSX as never, wb, "THB")).toThrow(/isn't a backup from the old MoneyMgr/);
  });

  it("flags currencies the new app doesn't know, and an old default that differs from the base currency", () => {
    const r = readRestoreWorkbook(XLSX as never, oldAppBackup(), "THB");
    expect(currencyCheck(r, ["THB", "NPR", "USD"], "THB")).toEqual({ unknown: [], oldDefault: null });
    expect(currencyCheck(r, ["THB", "USD"], "USD")).toEqual({ unknown: ["NPR"], oldDefault: "THB" });
  });

  it("splits large lists into API-sized requests", () => {
    expect(chunks(Array.from({ length: 25_001 }, (_, i) => i)).map((c) => c.length)).toEqual([10_000, 10_000, 5_001]);
  });
});
