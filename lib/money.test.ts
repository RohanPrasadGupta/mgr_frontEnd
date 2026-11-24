import { describe, expect, it } from "vitest";
import { budgetDate, formatMoney, formatPct, formatQty, formatUnitPrice, minorUnit, monthLabel, monthRange, shiftMonth, toMajor, toMinor } from "./money";

const nb = (s: string) => s.replace(/\u00a0/g, " "); // Intl puts a no-break space after currency codes

describe("money", () => {
  it("uses 0 decimals for yen-like currencies and 2 otherwise", () => {
    expect(minorUnit("JPY")).toBe(0);
    expect(minorUnit("THB")).toBe(2);
  });
  it("converts major↔minor without float drift", () => {
    expect(toMinor(19.99, "USD")).toBe(1999);
    expect(toMinor(0.1 + 0.2, "USD")).toBe(30);
    expect(toMinor(1500, "JPY")).toBe(1500);
    expect(toMajor(1999, "USD")).toBe(19.99);
  });
  it("formats with a proper minus sign and optional plus", () => {
    expect(nb(formatMoney(123456, "THB"))).toBe("THB 1,234.56");
    expect(formatMoney(-5000, "USD")).toBe("−$50.00");
    expect(formatMoney(5000, "USD", { sign: true })).toBe("+$50.00");
    expect(formatMoney(0, "USD", { sign: true })).toBe("$0.00");
  });
  it("shows fractional unit prices and trims quantities", () => {
    expect(formatUnitPrice(12345.6789, "USD")).toBe("$123.4568");
    expect(formatQty(1.5)).toBe("1.5");
    expect(formatQty(1234567.12345678)).toBe("1,234,567.12345678");
  });
  it("formats percentages, with null as a dash", () => {
    expect(formatPct(null)).toBe("—");
    expect(formatPct(12.34, true)).toBe("+12.3%");
    expect(formatPct(-3)).toBe("-3.0%");
  });
});

describe("month helpers", () => {
  it("builds month ranges including leap February", () => {
    expect(monthRange(2024, 2)).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(monthRange(2025, 2)).toEqual({ from: "2025-02-01", to: "2025-02-28" });
    expect(monthRange(2025, 12)).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });
  it("shifts months across year boundaries", () => {
    expect(shiftMonth(2025, 1, -1)).toEqual({ year: 2024, month: 12 });
    expect(shiftMonth(2025, 12, 1)).toEqual({ year: 2026, month: 1 });
    expect(shiftMonth(2025, 6, -18)).toEqual({ year: 2023, month: 12 });
  });
  it("labels months in English", () => {
    expect(monthLabel(2025, 8)).toBe("August 2025");
  });
  it("asks for 'today' only in the current month", () => {
    const now = new Date(2025, 7, 15);
    expect(budgetDate(2025, 8, now)).toBeUndefined();
    expect(budgetDate(2025, 7, now)).toBe("2025-07-31");
    expect(budgetDate(2026, 1, now)).toBe("2026-01-31");
  });
});
