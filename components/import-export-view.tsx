"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { call, client } from "@/lib/api/client";
import { invalidateInvestments, invalidateLedger, qk, useAccounts, useCategories, useMe } from "@/lib/api/hooks";
import type { ImportReport, InvestmentImportReport, Page, Transaction } from "@/lib/api/types";
import { REQUIRED, buildRows, csvCell, detectColumns, parseJsonDocs, type Field, type ImportRow } from "@/lib/import";
import { toMajor } from "@/lib/money";
import { Button, Card, ErrorNote, Field as FormField, Input, Segmented, Select, cx } from "./ui";

type Tab = "transactions" | "investments" | "export";

export function ImportExportView() {
  const [tab, setTab] = useState<Tab>("transactions");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Import & export</h1>
      <Segmented value={tab} onChange={setTab} options={[{ value: "transactions", label: "Import transactions" }, { value: "investments", label: "Import investments" }, { value: "export", label: "Export CSV" }]} />
      {tab === "transactions" && <ImportTransactions />}
      {tab === "investments" && <ImportInvestments />}
      {tab === "export" && <ExportCsv />}
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
  { value: "sip-capital", label: "SIP capital" },
  { value: "ssf-capital", label: "SSF capital" },
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
