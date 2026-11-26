/**
 * Reads the Excel backup made by the old MoneyMgr ("Export Data → Download Excel backup") and turns each sheet into
 * the rows the import endpoints take. Sheet names and headers are the contract with the old app's
 * app/components/exportPage/backupWorkbook.js — change both together.
 */
import { buildRows, cellToDate, detectColumns, normaliseType, type ImportRow } from "./import";

export const INVESTMENT_SHEETS = [
  { source: "stock-transactions", sheet: "Stock trades", label: "Stock trades" },
  { source: "stock-capital", sheet: "Stock capital", label: "Stock capital" },
  { source: "coin-capital", sheet: "Coin capital", label: "Coin capital" },
  { source: "sip-capital", sheet: "SIP capital", label: "SIP contributions" },
  { source: "ssf-capital", sheet: "SSF capital", label: "SSF contributions" },
] as const;
export type InvestmentSource = (typeof INVESTMENT_SHEETS)[number]["source"];

export interface NoteRow { title: string; body: string; date?: string }
export interface CategoryRow { name: string; type: string }
export interface OldCurrency { code: string; name: string; symbol: string; isDefault: boolean }
export interface Restore {
  categories: CategoryRow[];
  /** Not imported (the new app knows every currency); checked against it so nothing in the file is unsupported. */
  currencies: OldCurrency[];
  transactions: ImportRow[];
  notes: NoteRow[];
  investments: Record<InvestmentSource, Record<string, unknown>[]>;
}

type Row = Record<string, unknown>;
type Ssf = Parameters<typeof cellToDate>[2];
interface Book { SheetNames: string[]; Sheets: Record<string, unknown> }
interface Xlsx { utils: { sheet_to_json: <T>(sheet: never, opts: object) => T[] }; SSF: unknown }

const text = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
const num = (v: unknown) => (typeof v === "number" ? v : text(v) === "" ? undefined : Number(text(v).replace(/[,\s]/g, "")));
/** A calendar date for the investment importer: noon UTC, so it lands on the same day in any user's time zone. */
const day = (v: unknown, ssf: Ssf) => { const d = cellToDate(v, false, ssf)?.slice(0, 10); return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00.000Z` : text(v); };
const bool = (v: unknown) => v === true || /^(true|yes|1)$/i.test(text(v));

/** Each old-app sheet row back into the document shape the investment importer reads (the old database's field names). */
const TO_DOC: Record<InvestmentSource, (r: Row, ssf: Ssf) => Row> = {
  "stock-transactions": (r, s) => ({ _id: text(r["ID"]), investedDate: day(r["Date"], s), stockSymbol: text(r["Symbol"]), stockName: text(r["Name"]), type: text(r["Type"]), price: num(r["Price"]), quantity: num(r["Quantity"]), totalAmount: num(r["Total"]), currency: text(r["Currency"]), useForAvgPrice: bool(r["Use for avg price"]) }),
  "stock-capital": (r, s) => ({ _id: text(r["ID"]), date: day(r["Date"], s), type: text(r["Type"]), amount: num(r["Amount"]), currency: text(r["Currency"]) }),
  "coin-capital": (r, s) => ({ _id: text(r["ID"]), date: day(r["Date"], s), type: text(r["Type"]), amount: num(r["Amount"]), transactionCharge: num(r["Charge"]), totalAmount: num(r["Total"]), currency: text(r["Currency"]) }),
  "sip-capital": (r, s) => ({ _id: text(r["ID"]), date: day(r["Date"], s), name: text(r["Name"]), amount: num(r["Amount"]), currency: text(r["Currency"]) }),
  "ssf-capital": (r, s) => ({ _id: text(r["ID"]), dateAdded: day(r["Date added"], s), paidDate: day(r["Paid date"], s), amount: num(r["Amount"]), monthsPaid: num(r["Months paid"]), totalAmount: num(r["Total"]), currency: text(r["Currency"]), notes: text(r["Notes"]) }),
};

export function readRestoreWorkbook(XLSX: Xlsx, wb: Book, defaultCurrency: string): Restore {
  const ssf = XLSX.SSF as Ssf;
  const rows = (name: string): Row[] => (wb.Sheets[name] ? XLSX.utils.sheet_to_json<Row>(wb.Sheets[name] as never, { raw: true, defval: "" }) : []);
  if (!wb.SheetNames.includes("Transactions") && !INVESTMENT_SHEETS.some((s) => wb.SheetNames.includes(s.sheet))) {
    throw new Error(`This isn't a backup from the old MoneyMgr (sheets found: ${wb.SheetNames.join(", ") || "none"}). Use "Import transactions" for other spreadsheets.`);
  }
  const tx = rows("Transactions");
  const strip = (o: Row) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")); // let the API apply its defaults
  return {
    categories: rows("Categories").map((r) => ({ name: text(r["Name"]), type: normaliseType(r["Type"]) })),
    currencies: rows("Currencies").map((r) => ({ code: text(r["Code"]).toUpperCase(), name: text(r["Name"]), symbol: text(r["Symbol"]), isDefault: bool(r["Default"]) })).filter((c) => c.code),
    // The old app writes dates as "YYYY-MM-DD HH:mm:ss" text, which passes through unchanged.
    transactions: tx.length ? buildRows(tx, detectColumns(Object.keys(tx[0]!)), { dmy: true, defaultCurrency, ssf }) : [],
    notes: rows("Notes").map((r) => ({ title: text(r["Title"]), body: String(r["Content"] ?? ""), ...(cellToDate(r["Date"], true, ssf) ? { date: cellToDate(r["Date"], true, ssf)! } : {}) })),
    investments: Object.fromEntries(INVESTMENT_SHEETS.map(({ source, sheet }) => [source, rows(sheet).map((r) => strip(TO_DOC[source](r, ssf)))])) as Restore["investments"],
  };
}

/**
 * Currency codes used anywhere in the backup that the new app doesn't know (rows in them would be rejected),
 * and the old app's default currency when it differs from the user's base currency.
 */
export function currencyCheck(r: Restore, known: string[], baseCurrency: string): { unknown: string[]; oldDefault: string | null } {
  const have = new Set(known);
  const used = new Set<string>([...r.currencies.map((c) => c.code), ...r.transactions.map((t) => t.currency)]);
  for (const docs of Object.values(r.investments)) for (const d of docs) if (typeof d["currency"] === "string" && d["currency"]) used.add((d["currency"] as string).toUpperCase());
  const oldDefault = r.currencies.find((c) => c.isDefault)?.code ?? null;
  return { unknown: [...used].filter((c) => !have.has(c)).sort(), oldDefault: oldDefault && oldDefault !== baseCurrency ? oldDefault : null };
}

/** The API takes at most 10,000 rows per request. */
export function chunks<T>(list: T[], size = 10_000): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
