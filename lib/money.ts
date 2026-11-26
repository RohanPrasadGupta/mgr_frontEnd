/** Decimal places per ISO 4217 (most use 2). Keep in step with mgr_backend/packages/shared/src/money.ts. */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "UGX", "PYG", "XAF", "XOF", "XPF", "KMF", "DJF", "GNF", "RWF", "VUV", "BIF"]);
const THREE_DECIMAL = new Set(["BHD", "KWD", "OMR", "JOD", "TND", "LYD", "IQD"]);
export const minorUnit = (c: string) => (ZERO_DECIMAL.has(c) ? 0 : THREE_DECIMAL.has(c) ? 3 : 2);
export const toMinor = (major: number, c: string) => Math.round(major * 10 ** minorUnit(c));
export const toMajor = (minor: number, c: string) => minor / 10 ** minorUnit(c);

export function formatMoney(minor: number, currency: string, opts: { sign?: boolean; compact?: boolean } = {}) {
  const v = toMajor(minor, currency);
  const s = new Intl.NumberFormat("en", { style: "currency", currency, ...(opts.compact ? { notation: "compact", maximumFractionDigits: 1 } : {}) }).format(Math.abs(v));
  return `${v < 0 ? "−" : opts.sign && v > 0 ? "+" : ""}${s}`;
}

/** YYYY-MM-DD helpers for month navigation (no timezone drift). */
export const pad = (n: number) => String(n).padStart(2, "0");
export function monthRange(year: number, month: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
}
export const monthLabel = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en", { month: "long", year: "numeric", timeZone: "UTC" });
export function shiftMonth(year: number, month: number, delta: number) {
  const i = year * 12 + (month - 1) + delta;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}

/** Date to ask budget status for: undefined = "today" (API decides) for the current month, else that month's last day. */
export function budgetDate(year: number, month: number, now = new Date()) {
  return year === now.getFullYear() && month === now.getMonth() + 1 ? undefined : monthRange(year, month).to;
}

/** Per-unit prices can be fractional minor units (crypto, gold): show up to 4 decimals. */
export function formatUnitPrice(minor: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency, minimumFractionDigits: minorUnit(currency), maximumFractionDigits: 4 }).format(toMajor(minor, currency));
}
export const formatQty = (q: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 8 }).format(q);
export const formatPct = (p: number | null, sign = false) => (p === null ? "—" : `${sign && p > 0 ? "+" : ""}${p.toFixed(1)}%`);
