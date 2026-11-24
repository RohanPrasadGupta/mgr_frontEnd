import { describe, expect, it } from "vitest";
import { buildRows, cellToDate, csvCell, detectColumns, normaliseType, parseJsonDocs, toNumber } from "./import";

// Mirrors SheetJS SSF.parse_date_code for the one serial used below (45895.36587962963 = 2025-08-26 08:46:49)
const ssf = { parse_date_code: (n: number) => (n === 45895.36587962963 ? { y: 2025, m: 8, d: 26, H: 8, M: 46, S: 49 } : null) };
const V1_HEADERS = ["Date", "Account", "Category", "Subcategory", "Note", "THB", "Income/Expense", "Description", "Amount", "Currency", "Account_1"];

describe("detectColumns", () => {
  it("maps the real v1 export headers, ignoring the duplicate Account_1 and THB columns", () => {
    expect(detectColumns(V1_HEADERS)).toEqual({ date: "Date", account: "Account", category: "Category", note: "Note", currency: "Currency", amount: "Amount", type: "Income/Expense" });
  });
  it("accepts common aliases case-insensitively and reports missing columns as null", () => {
    const m = detectColumns(["DATETIME", "wallet", "Memo", "type", "Amount"]);
    expect(m).toMatchObject({ date: "DATETIME", account: "wallet", note: "Memo", type: "type", amount: "Amount", category: null, currency: null });
  });
});

describe("cellToDate", () => {
  it("converts Excel serials", () => expect(cellToDate(45895.36587962963, true, ssf)).toBe("2025-08-26 08:46:49"));
  it("returns null for a serial it cannot parse", () => expect(cellToDate(1, true, ssf)).toBeNull());
  it("reads text dates as day-first or month-first", () => {
    expect(cellToDate("01/02/2025 23:28:24", true)).toBe("2025-02-01 23:28:24");
    expect(cellToDate("01/02/2025 23:28:24", false)).toBe("2025-01-02 23:28:24");
    expect(cellToDate("3/9/2025", false)).toBe("2025-03-09");
  });
  it("passes ISO-like strings through and rejects blanks/other types", () => {
    expect(cellToDate("2025-08-26 10:00", true)).toBe("2025-08-26 10:00");
    expect(cellToDate("  ", true)).toBeNull();
    expect(cellToDate(undefined, true)).toBeNull();
  });
  it("formats JS dates in local time", () => expect(cellToDate(new Date(2025, 7, 26, 9, 5, 3), true)).toBe("2025-08-26 09:05:03"));
});

describe("normalisers", () => {
  it("normalises type words", () => {
    expect(normaliseType("income")).toBe("Income");
    expect(normaliseType(" EXPENSE ")).toBe("Expense");
    expect(normaliseType("-")).toBe("Expense");
    expect(normaliseType("Transfer")).toBe("Transfer"); // left as-is so the API reports it
  });
  it("parses numbers with thousands separators", () => {
    expect(toNumber("1,234.50")).toBe(1234.5);
    expect(toNumber(30)).toBe(30);
    expect(toNumber("abc")).toBeNaN();
  });
});

describe("buildRows", () => {
  const map = detectColumns(V1_HEADERS);
  it("builds API rows, defaulting account/currency", () => {
    const rows = buildRows(
      [{ Date: 45895.36587962963, Account: "", Category: "🍜 Food", Note: "pad thai", "Income/Expense": "Expense", Amount: "1,040.50", Currency: "" }],
      map,
      { dmy: true, defaultCurrency: "THB", ssf },
    );
    expect(rows).toEqual([{ date: "2025-08-26 08:46:49", account: "Cash", category: "🍜 Food", note: "pad thai", currency: "THB", amount: 1040.5, type: "Expense" }]);
  });
  it("tolerates missing optional columns", () => {
    const m = detectColumns(["Date", "Amount", "Type"]);
    const [r] = buildRows([{ Date: "2025-01-02", Amount: 5, Type: "income" }], m, { dmy: true, defaultCurrency: "NPR" });
    expect(r).toMatchObject({ account: "Cash", category: "", currency: "NPR", type: "Income" });
  });
});

describe("parseJsonDocs", () => {
  it("reads a JSON array", () => expect(parseJsonDocs('[{"a":1},{"a":2}]')).toHaveLength(2));
  it("reads mongoexport-style JSON lines, skipping blanks", () => expect(parseJsonDocs('{"a":1}\n\n{"a":2}\n')).toEqual([{ a: 1 }, { a: 2 }]));
  it("names the bad line", () => expect(() => parseJsonDocs('{"a":1}\n{oops')).toThrow("Line 2 is not valid JSON"));
  it("rejects a non-array top-level value", () => expect(() => parseJsonDocs("[1")).toThrow());
});

describe("csvCell", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("l1\nl2")).toBe('"l1\nl2"');
    expect(csvCell(12.5)).toBe("12.5");
  });
  it("defuses spreadsheet formulas in text but leaves numbers alone", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell(-5)).toBe("-5");
  });
});
