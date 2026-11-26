"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { call, client } from "@/lib/api/client";
import { invalidateInvestments, invalidateLedger, invalidateNotes, qk, useAccounts, useCategories, useCurrencies, useMe } from "@/lib/api/hooks";
import type { ImportReport, InvestmentImportReport, Transaction } from "@/lib/api/types";
import { REQUIRED, buildRows, csvCell, detectColumns, parseJsonDocs, type Field, type ImportRow } from "@/lib/import";
import { toMajor } from "@/lib/money";
import { INVESTMENT_SHEETS, chunks, currencyCheck, readRestoreWorkbook, type Restore } from "@/lib/restore";
import { Button, Card, ErrorNote, Field as FormField, Input, Segmented, Select, cx } from "./ui";

type Tab = "restore" | "transactions" | "investments" | "export";

export function ImportExportView() {
  const [tab, setTab] = useState<Tab>("transactions");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Import & export</h1>
      <Segmented value={tab} onChange={setTab} options={[{ value: "transactions", label: "Import transactions" }, { value: "investments", label: "Import investments" }, { value: "restore", label: "Restore from old app" }, { value: "export", label: "Export CSV" }]} />
      {tab === "restore" && <RestoreFromOldApp />}
      {tab === "transactions" && <ImportTransactions />}
      {tab === "investments" && <ImportInvestments />}
      {tab === "export" && <ExportCsv />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
/** One part of the restore (a sheet of the old app's Excel backup), with the API's report(s) added up. */
interface PartResult { label: string; total: number; imported: number; duplicates: number; invalid: { row: number; reason: string }[]; problems: string[] }

function RestoreFromOldApp() {
  const { data: me } = useMe();
  const { data: currencies } = useCurrencies();
  const qc = useQueryClient();
  const [fileName, setFileName] = useState("");
  const [data, setData] = useState<Restore | null>(null);
  const [results, setResults] = useState<PartResult[] | null>(null);
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState<"parse" | "check" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parts = data ? [
    { label: "Categories", count: data.categories.length },
    { label: "Currencies", count: data.currencies.length },
    { label: "Transactions", count: data.transactions.length },
    { label: "Notes", count: data.notes.length },
    ...INVESTMENT_SHEETS.map((s) => ({ label: s.label, count: data.investments[s.source].length })),
  ] : [];

  async function onFile(file: File | undefined) {
    setError(null); setResults(null); setChecked(false); setDone(false); setData(null);
    if (!file) return;
    setFileName(file.name);
    if (file.size > 15 * 1024 * 1024) { setError("That file is larger than 15 MB, which is bigger than any backup from the old app."); return; }
    setBusy("parse");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", bookVBA: false, cellHTML: false });
      setData(readRestoreWorkbook(XLSX as never, wb, me?.baseCurrency ?? "THB"));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not read the file"); }
    finally { setBusy(null); }
  }

  const ccy = data && currencies && me ? currencyCheck(data, currencies.map((c) => c.code), me.baseCurrency) : null;

  /** Every non-empty part, in order: categories (first, so they keep their icons), transactions, notes, then each investment sheet (each split into ≤10,000-row requests). */
  async function run(dryRun: boolean) {
    if (!data) return;
    setError(null); setBusy(dryRun ? "check" : "import");
    const out: PartResult[] = [];
    const add = (label: string, offset: number, r: { total: number; imported: number; duplicates: number; invalid: { row: number; reason: string }[] }, problems: string[] = []) => {
      const prev = out.find((p) => p.label === label);
      const invalid = r.invalid.map((i) => ({ row: i.row + offset, reason: i.reason }));
      if (prev) Object.assign(prev, { total: prev.total + r.total, imported: prev.imported + r.imported, duplicates: prev.duplicates + r.duplicates, invalid: [...prev.invalid, ...invalid], problems: [...prev.problems, ...problems] });
      else out.push({ label, total: r.total, imported: r.imported, duplicates: r.duplicates, invalid, problems });
    };
    try {
      let offset = 0;
      for (const rows of chunks(data.categories)) { add("Categories", offset, (await call(client.POST("/imports/categories", { body: { rows, dryRun } }))).data); offset += rows.length; }
      offset = 0;
      for (const rows of chunks(data.transactions)) { add("Transactions", offset, (await call(client.POST("/imports/transactions", { body: { rows, dryRun } }))).data); offset += rows.length; }
      offset = 0;
      for (const rows of chunks(data.notes)) { add("Notes", offset, (await call(client.POST("/imports/notes", { body: { rows, dryRun } }))).data); offset += rows.length; }
      for (const s of INVESTMENT_SHEETS) {
        offset = 0;
        for (const rows of chunks(data.investments[s.source])) {
          const r = (await call(client.POST("/imports/investments", { body: { source: s.source, rows, dryRun } }))).data;
          add(s.label, offset, r, r.positionErrors.map((p) => `${p.symbol}: ${p.message}`)); offset += rows.length;
        }
      }
      setResults(out); setChecked(dryRun); setDone(!dryRun);
      if (!dryRun) { await invalidateLedger(qc); await qc.invalidateQueries({ queryKey: qk.categories }); await invalidateNotes(qc); await invalidateInvestments(qc); }
    } catch (e) {
      setResults(out.length ? out : null);
      setError(`${e instanceof Error ? e.message : "Import failed"}${!dryRun && out.length ? " — the parts listed below were already saved; run the import again to finish (nothing is duplicated)." : ""}`);
    } finally { setBusy(null); }
  }

  const empty = parts.every((p) => p.label === "Currencies" || p.count === 0);
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <p className="text-sm text-muted">In the old MoneyMgr, open <b>Export Data</b> and click <b>Download Excel backup</b>. Choose that <code>.xlsx</code> file here: its categories, transactions, notes, stock trades and investment records are brought in together (currencies are checked). Press <b>Check</b> first — nothing is saved until you press Import, and importing the same file again never creates duplicates.</p>
        <Input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="Choose the backup file" onChange={(e) => onFile(e.target.files?.[0])} />
        {busy === "parse" && <p className="text-sm text-muted">Reading the file…</p>}
        {error && <ErrorNote error={new Error(error)} />}
        {data && (
          <div className="space-y-3">
            <p className="text-sm">{fileName}</p>
            <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">{parts.map((p) => <li key={p.label} className="rounded-lg border border-border px-3 py-2"><span className="block text-xs text-muted">{p.label}</span><span className="font-semibold tabular-nums">{p.count.toLocaleString()}</span></li>)}</ul>
            {ccy && ccy.unknown.length > 0 && <p className="text-sm text-expense">MoneyMgr doesn&apos;t support {ccy.unknown.join(", ")} — rows in {ccy.unknown.length === 1 ? "that currency" : "those currencies"} will be skipped.</p>}
            {ccy?.oldDefault && <p className="text-sm text-muted">Your old app&apos;s default currency was {ccy.oldDefault}; here it is {me?.baseCurrency}. Totals are shown in {me?.baseCurrency} — change it in Settings if you prefer {ccy.oldDefault}.</p>}
            {data.currencies.length > 0 && !ccy?.unknown.length && <p className="text-sm text-muted">Currencies ({data.currencies.map((c) => c.code).join(", ")}) are all supported — nothing to import for them.</p>}
            {empty ? <p className="text-sm text-muted">The backup is empty.</p> : (
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => run(true)} disabled={busy !== null}>{busy === "check" ? "Checking…" : "Check (nothing is saved)"}</Button>
                <Button onClick={() => run(false)} disabled={busy !== null || !checked}>{busy === "import" ? "Importing…" : "Import everything"}</Button>
              </div>
            )}
          </div>
        )}
      </Card>
      {results && (
        <Card className="space-y-3" role="status">
          <h2 className="text-sm font-semibold">{checked ? "Check result — nothing saved yet" : "Import result"}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-normal">Sheet</th><th className="py-1 text-right font-normal">Rows</th><th className="py-1 text-right font-normal">{checked ? "Will be imported" : "Imported"}</th><th className="py-1 text-right font-normal">Already present</th><th className="py-1 text-right font-normal">Skipped</th></tr></thead>
              <tbody>{results.map((r) => <tr key={r.label} className="border-t border-border"><td className="py-1.5">{r.label}</td><td className="text-right tabular-nums">{r.total.toLocaleString()}</td><td className="text-right tabular-nums">{r.imported.toLocaleString()}</td><td className="text-right tabular-nums">{r.duplicates.toLocaleString()}</td><td className={cx("text-right tabular-nums", r.invalid.length > 0 && "text-expense")}>{r.invalid.length.toLocaleString()}</td></tr>)}</tbody>
            </table>
          </div>
          {results.filter((r) => r.problems.length).map((r) => <p key={r.label} className="text-sm text-expense">{r.label}: {r.problems.join("; ")} — this sheet can&apos;t be imported until that&apos;s fixed.</p>)}
          {results.filter((r) => r.invalid.length).map((r) => (
            <details key={r.label} className="text-sm"><summary className="cursor-pointer text-expense">{r.label}: {r.invalid.length} row(s) will be skipped</summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs">{r.invalid.slice(0, 100).map((i) => <li key={i.row}>Row {i.row + 1}: {i.reason}</li>)}</ul>
            </details>
          ))}
          {done && <p className="text-sm text-income">Done. Everything imported is now available across the app.</p>}
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function ImportTransactions() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [fileName, setFileName] = useState("");
  const [raw, setRaw] = useState<Record<string, unknown>[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dmy, setDmy] = useState(true);
  const [ssf, setSsf] = useState<Parameters<typeof buildRows>[2]["ssf"]>();
  const [report, setReport] = useState<ImportReport | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState<"parse" | "check" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mapping = useMemo(() => detectColumns(headers), [headers]);
  const missing = REQUIRED.filter((f) => !mapping[f]);
  const rows: ImportRow[] = useMemo(() => (raw && missing.length === 0 ? buildRows(raw, mapping, { dmy, defaultCurrency: me?.baseCurrency ?? "THB", ssf }) : []), [raw, mapping, missing.length, dmy, me?.baseCurrency, ssf]);

  async function onFile(file: File | undefined) {
    setError(null); setReport(null); setChecked(false); setRaw(null);
    if (!file) return;
    setFileName(file.name);
    // Spreadsheet parsing runs on the main thread: refuse files far larger than any real export instead of freezing the tab.
    if (file.size > 15 * 1024 * 1024) { setError("That file is larger than 15 MB. Export a smaller date range and import it in parts."); return; }
    setBusy("parse");
    try {
      const XLSX = await import("xlsx"); // loaded on demand: only this screen needs it
      // CSV must be decoded as UTF-8 text: handing SheetJS raw bytes makes it assume Latin-1 and garble emoji / Thai / Nepali text. `raw` stops SheetJS guessing dates (it assumes US month/day) so our day/month setting decides.
      const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
      const wb = isCsv ? XLSX.read(await file.text(), { type: "string", raw: true, sheets: 0 }) : XLSX.read(await file.arrayBuffer(), { type: "array", sheets: 0, bookVBA: false, cellHTML: false });
      const sheet = wb.Sheets[wb.SheetNames[0]!];
      if (!sheet) throw new Error("The file has no sheets");
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true, defval: "" });
      if (json.length === 0) throw new Error("No rows found in the first sheet");
      if (json.length > 10_000) throw new Error(`${json.length.toLocaleString()} rows is more than the 10,000 per import — split the file`);
      setSsf(XLSX.SSF as unknown as Parameters<typeof buildRows>[2]["ssf"]);
      setHeaders(Object.keys(json[0]!)); setRaw(json);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not read the file"); }
    finally { setBusy(null); }
  }

  async function run(dryRun: boolean) {
    setError(null); setBusy(dryRun ? "check" : "import");
    try {
      const r = (await call(client.POST("/imports/transactions", { body: { rows, dryRun } }))).data;
      setReport(r); setChecked(dryRun);
      if (!dryRun) { await invalidateLedger(qc); await qc.invalidateQueries({ queryKey: qk.categories }); }
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed"); }
    finally { setBusy(null); }
  }

  const labels: Record<Field, string> = { date: "Date", account: "Account", category: "Category", note: "Note", currency: "Currency", amount: "Amount", type: "Income/Expense" };
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <p className="text-sm text-muted">Upload your Money Manager export (<code>.xls</code>, <code>.xlsx</code>) or a CSV with the columns <b>Date, Account, Category, Note, Currency, Amount, Income/Expense</b>. Nothing is saved until you press Import, and importing the same file again never creates duplicates.</p>
        <Input type="file" accept=".xls,.xlsx,.csv" aria-label="Choose a file" onChange={(e) => onFile(e.target.files?.[0])} />
        {busy === "parse" && <p className="text-sm text-muted">Reading {fileName}…</p>}
        {error && <ErrorNote error={new Error(error)} />}
      </Card>

      {raw && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{fileName} · {raw.length.toLocaleString()} rows</h2>
            <label className="flex items-center gap-2 text-xs text-muted">Dates written as text are
              <Select value={dmy ? "dmy" : "mdy"} onChange={(e) => { setDmy(e.target.value === "dmy"); setChecked(false); setReport(null); }} className="w-auto"><option value="dmy">Day/Month/Year</option><option value="mdy">Month/Day/Year</option></Select>
            </label>
          </div>
          <ul className="flex flex-wrap gap-2 text-xs">
            {(Object.keys(labels) as Field[]).map((f) => (
              <li key={f} className={cx("rounded-full px-2.5 py-1", mapping[f] ? "bg-income/15 text-income" : REQUIRED.includes(f) ? "bg-expense/15 text-expense" : "bg-border text-muted")}>
                {labels[f]}: {mapping[f] ?? (REQUIRED.includes(f) ? "missing" : "default")}
              </li>
            ))}
          </ul>
          {missing.length > 0 ? <ErrorNote error={new Error(`Required column(s) not found: ${missing.map((f) => labels[f]).join(", ")}. Columns in the file: ${headers.join(", ")}`)} /> : (
            <>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[34rem] text-left text-xs">
                  <thead className="bg-border/40 text-muted"><tr>{["Date", "Account", "Category", "Note", "Cur.", "Amount", "Type"].map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr></thead>
                  <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i} className="border-t border-border"><td className="px-2 py-1.5">{r.date}</td><td className="px-2 py-1.5">{r.account}</td><td className="px-2 py-1.5">{r.category}</td><td className="max-w-40 truncate px-2 py-1.5">{r.note}</td><td className="px-2 py-1.5">{r.currency}</td><td className="px-2 py-1.5 tabular-nums">{r.amount}</td><td className="px-2 py-1.5">{r.type}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => run(true)} disabled={busy !== null}>{busy === "check" ? "Checking…" : "Check (nothing is saved)"}</Button>
                <Button onClick={() => run(false)} disabled={busy !== null || !checked || report?.dryRun === false}>{busy === "import" ? "Importing…" : `Import ${(report?.imported ?? rows.length).toLocaleString()} rows`}</Button>
              </div>
              {!checked && !report && <p className="text-xs text-muted">Run the check first to see what will be created.</p>}
            </>
          )}
        </Card>
      )}
      {report && <ReportCard title={report.dryRun ? "Check result — nothing saved yet" : "Import finished"} rows={[["Rows in file", report.total], [report.dryRun ? "Will be imported" : "Imported", report.imported], ["Already present (skipped)", report.duplicates], ["Invalid rows", report.invalid.length]]} invalid={report.invalid} created={[["New accounts", report.createdAccounts], ["New categories", report.createdCategories.map((c) => c.replace(/^\w+:/, ""))]]} note={report.approximateFxRows ? `${report.approximateFxRows} row(s) used an approximate FX rate.` : undefined} done={!report.dryRun} />}
    </div>
  );
}

function ReportCard({ title, rows, invalid, created, note, done }: { title: string; rows: [string, number][]; invalid: { row: number; reason: string }[]; created: [string, string[]][]; note?: string; done?: boolean }) {
  return (
    <Card className="space-y-3" role="status">
      <h2 className="text-sm font-semibold">{title}</h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{rows.map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="text-lg font-semibold tabular-nums">{v.toLocaleString()}</dd></div>)}</dl>
      {created.filter(([, v]) => v.length).map(([k, v]) => <p key={k} className="text-sm"><span className="text-muted">{k}: </span>{v.slice(0, 40).join(", ")}{v.length > 40 && ` … +${v.length - 40}`}</p>)}
      {note && <p className="text-sm text-muted">{note}</p>}
      {invalid.length > 0 && (
        <details className="text-sm"><summary className="cursor-pointer text-expense">{invalid.length} row(s) will be skipped</summary>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs">{invalid.slice(0, 100).map((i) => <li key={i.row}>Row {i.row + 1}: {i.reason}</li>)}</ul>
        </details>
      )}
      {done && <p className="text-sm text-income">Done. The imported data is now available across the app.</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
const SOURCES = [
  { value: "stock-transactions", label: "Stock trades (transactions)" },
  { value: "stock-capital", label: "Stock capital" },
  { value: "coin-capital", label: "Coin capital" },
  { value: "sip-capital", label: "SIP / mutual fund contributions" },
  { value: "ssf-capital", label: "Pension / retirement fund contributions" },
] as const;

function ImportInvestments() {
  const qc = useQueryClient();
  const [source, setSource] = useState<(typeof SOURCES)[number]["value"]>("stock-transactions");
  const [docs, setDocs] = useState<unknown[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<InvestmentImportReport | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    setError(null); setReport(null); setChecked(false); setDocs(null);
    if (!file) return;
    try {
      const list = parseJsonDocs(await file.text());
      if (list.length === 0) throw new Error("The file has no documents");
      if (list.length > 10_000) throw new Error("More than 10,000 documents — split the file");
      setDocs(list); setFileName(file.name);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not read the file"); }
  }
  async function run(dryRun: boolean) {
    setError(null); setBusy(true);
    try {
      const r = (await call(client.POST("/imports/investments", { body: { source, rows: docs ?? [], dryRun } }))).data;
      setReport(r); setChecked(dryRun);
      if (!dryRun) await invalidateInvestments(qc);
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed"); }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <p className="text-sm text-muted">Import documents exported from your old stock backend’s MongoDB collections (JSON array, or one JSON per line as <code>mongoexport</code> writes it). Pick which collection the file came from.</p>
        <FormField label="Collection"><Select value={source} onChange={(e) => { setSource(e.target.value as typeof source); setReport(null); setChecked(false); }}>{SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></FormField>
        <Input type="file" accept=".json,.jsonl,.ndjson,application/json" aria-label="Choose a JSON file" onChange={(e) => onFile(e.target.files?.[0])} />
        {error && <ErrorNote error={new Error(error)} />}
        {docs && (
          <div className="space-y-2">
            <p className="text-sm">{fileName} · {docs.length.toLocaleString()} documents</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => run(true)} disabled={busy}>{busy && !checked ? "Working…" : "Check (nothing is saved)"}</Button>
              <Button onClick={() => run(false)} disabled={busy || !checked}>Import {(report?.imported ?? docs.length).toLocaleString()} documents</Button>
            </div>
          </div>
        )}
      </Card>
      {report && <ReportCard title={report.dryRun ? "Check result — nothing saved yet" : "Import finished"} rows={[["Documents", report.total], [report.dryRun ? "Will be imported" : "Imported", report.imported], ["Already present", report.duplicates], ["Invalid", report.invalid.length]]} invalid={report.invalid} created={[["New assets", report.createdAssets], ["Problems", report.positionErrors.map((p) => `${p.symbol}: ${p.message}`)]]} note={report.positionErrors.length ? "These would oversell a holding; fix the data (or import the buys first) — nothing can be imported until then." : undefined} done={!report.dryRun} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function ExportCsv() {
  const accounts = useAccounts();
  const categories = useCategories();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setError(null); setMsg(null); setBusy(true);
    try {
      const all: Transaction[] = [];
      let cursor: string | undefined;
      do {
        const page = await call(client.GET("/transactions", { params: { query: { limit: 200, from: from || undefined, to: to || undefined, cursor } } }));
        all.push(...page.data); cursor = page.meta.nextCursor ?? undefined;
      } while (cursor);
      const acct = new Map(accounts.data?.map((a) => [a.id, a.name]));
      const cat = new Map(categories.data?.map((c) => [c.id, c.name]));
      const kind = { income: "Income", expense: "Expense", transfer_out: "Transfer out", transfer_in: "Transfer in" } as const;
      const lines = [["Date", "Time", "Account", "Category", "Note", "Currency", "Amount", "Type"].join(",")];
      for (const t of all) {
        const d = new Date(t.occurredAt);
        lines.push([t.occurredOn, d.toTimeString().slice(0, 8), acct.get(t.accountId) ?? "", t.categoryId ? (cat.get(t.categoryId) ?? "") : "", t.note ?? "", t.currency, toMajor(t.amountMinor, t.currency), kind[t.kind]].map(csvCell).join(","));
      }
      const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `moneymgr-transactions${from || to ? `-${from || "start"}-to-${to || "now"}` : ""}.csv`; a.click();
      URL.revokeObjectURL(url);
      setMsg(`Exported ${all.length.toLocaleString()} transactions.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Export failed"); }
    finally { setBusy(false); }
  }
  return (
    <Card className="space-y-3">
      <p className="text-sm text-muted">Download your transactions as a CSV (opens in Excel or Google Sheets). Leave the dates empty to export everything.</p>
      <div className="grid gap-3 sm:grid-cols-2"><FormField label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></FormField><FormField label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></FormField></div>
      {error && <ErrorNote error={new Error(error)} />}
      {msg && <p role="status" className="text-sm text-income">{msg}</p>}
      <Button onClick={download} disabled={busy || accounts.isPending || categories.isPending}>{busy ? "Preparing…" : "Download CSV"}</Button>
    </Card>
  );
}
