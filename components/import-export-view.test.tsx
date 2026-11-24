import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { baseRoutes } from "@/test/fixtures";
import { mockFetch, renderWithClient } from "@/test/utils";
import { ImportExportView } from "./import-export-view";

const report = (o: object = {}) => ({ data: { dryRun: true, total: 2, imported: 2, duplicates: 0, invalid: [], createdAccounts: [], createdCategories: ["expense:Food"], approximateFxRows: 0, ...o } });
const csv = (body: string, name = "m.csv") => new File([body], name, { type: "text/csv" });
const CSV = "Date,Account,Category,Note,Currency,Amount,Income/Expense\n26/08/2025 08:46:49,Cash,🍜 Food,pad thai,THB,\"1,040.50\",Expense\n2025-08-25,Cash,Salary,,THB,30000,income\n";
const upload = (f: File) => userEvent.upload(screen.getByLabelText("Choose a file"), f);

describe("Import transactions", () => {
  it("parses a CSV, shows the detected columns and a preview, and only imports after a check", async () => {
    const m = mockFetch({ ...baseRoutes, "POST /imports/transactions": ({ body }: { body: { dryRun: boolean } }) => report({ dryRun: body.dryRun }) });
    renderWithClient(<ImportExportView />);
    await upload(csv(CSV));
    expect(await screen.findByText(/m\.csv · 2 rows/)).toBeInTheDocument();
    expect(screen.getByText("Date: Date")).toBeInTheDocument();
    expect(screen.getByText("Income/Expense: Income/Expense")).toBeInTheDocument();
    expect(screen.getByText("pad thai")).toBeInTheDocument();
    const importBtn = screen.getByRole("button", { name: /^Import 2 rows$/ });
    expect(importBtn).toBeDisabled(); // must run the check first

    await userEvent.click(screen.getByRole("button", { name: /Check/ }));
    expect(await screen.findByText("Check result — nothing saved yet")).toBeInTheDocument();
    const dry = m.last("POST", "/imports/transactions")!.body;
    expect(dry.dryRun).toBe(true);
    expect(dry.rows[0]).toEqual({ date: "2025-08-26 08:46:49", account: "Cash", category: "🍜 Food", note: "pad thai", currency: "THB", amount: 1040.5, type: "Expense" });
    expect(dry.rows[1]).toMatchObject({ type: "Income", amount: 30000 });

    await userEvent.click(await screen.findByRole("button", { name: /^Import 2 rows$/ }));
    expect(await screen.findByText("Import finished")).toBeInTheDocument();
    expect(m.calls.filter((c) => c.path === "/imports/transactions").map((c) => c.body.dryRun)).toEqual([true, false]);
    expect(screen.getByRole("button", { name: /^Import 2 rows$/ })).toBeDisabled(); // no accidental double import
  });

  it("re-reads text dates when the day/month order is switched, and invalidates the old check", async () => {
    const m = mockFetch({ ...baseRoutes, "POST /imports/transactions": () => report() });
    renderWithClient(<ImportExportView />);
    await upload(csv("Date,Amount,Type\n03/04/2025,5,Expense\n"));
    await screen.findByText(/m\.csv · 1 rows/);
    await userEvent.click(screen.getByRole("button", { name: /Check/ }));
    await screen.findByText("Check result — nothing saved yet");
    expect(m.last("POST", "/imports/transactions")!.body.rows[0].date).toBe("2025-04-03");
    await userEvent.selectOptions(screen.getByLabelText(/Dates written as text are/), "mdy");
    expect(screen.queryByText("Check result — nothing saved yet")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Check/ }));
    await waitFor(() => expect(m.calls.filter((c) => c.path === "/imports/transactions")).toHaveLength(2));
    expect(m.last("POST", "/imports/transactions")!.body.rows[0].date).toBe("2025-03-04");
  });

  it("explains which required column is missing and offers no import", async () => {
    mockFetch(baseRoutes);
    renderWithClient(<ImportExportView />);
    await upload(csv("When,Money\n2025-01-01,5\n"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Required column\(s\) not found: Date, Amount, Income\/Expense/);
    expect(screen.queryByRole("button", { name: /Check/ })).not.toBeInTheDocument();
  });

  it("keeps emoji and non-English text intact in CSV files (UTF-8)", async () => {
    const m = mockFetch({ ...baseRoutes, "POST /imports/transactions": () => report() });
    renderWithClient(<ImportExportView />);
    await upload(csv("Date,Amount,Type,Category,Note\n2025-01-01,5,Expense,🍜 อาหาร,गुड मर्निङ\n"));
    await screen.findByText(/m\.csv · 1 rows/);
    await userEvent.click(screen.getByRole("button", { name: /Check/ }));
    await screen.findByText("Check result — nothing saved yet");
    expect(m.last("POST", "/imports/transactions")!.body.rows[0]).toMatchObject({ category: "🍜 อาหาร", note: "गुड मर्निङ" });
  });

  it("lists skipped rows with the API's reasons", async () => {
    mockFetch({ ...baseRoutes, "POST /imports/transactions": () => report({ imported: 1, invalid: [{ row: 2, reason: "no FX rate for NPR→THB" }] }) });
    renderWithClient(<ImportExportView />);
    await upload(csv("Date,Amount,Type,Currency\n2025-01-01,5,Expense,THB\n2025-01-02,5,Expense,NPR\n"));
    await screen.findByText(/m\.csv · 2 rows/);
    await userEvent.click(screen.getByRole("button", { name: /Check/ }));
    await userEvent.click(await screen.findByText(/1 row\(s\) will be skipped/));
    expect(screen.getByText(/Row 3: no FX rate for NPR→THB/)).toBeInTheDocument(); // +1 for the header row
  });
});

describe("Import transactions — Excel files", () => {
  it("reads a real .xlsx workbook: Excel date serials become timestamps, numbers stay numbers", async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([["Date", "Account", "Category", "Amount", "Currency", "Income/Expense"], [45895.5, "Cash", "🌐 work", 30, "THB", "Expense"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const m = mockFetch({ ...baseRoutes, "POST /imports/transactions": () => report() });
    renderWithClient(<ImportExportView />);
    await userEvent.upload(screen.getByLabelText("Choose a file"), new File([bytes], "export.xlsx"));
    await screen.findByText(/export\.xlsx · 1 rows/);
    await userEvent.click(screen.getByRole("button", { name: /Check/ }));
    await screen.findByText("Check result — nothing saved yet");
    expect(m.last("POST", "/imports/transactions")!.body.rows[0]).toEqual({ date: "2025-08-26 12:00:00", account: "Cash", category: "🌐 work", note: "", currency: "THB", amount: 30, type: "Expense" });
  });
});

describe("Import investments", () => {
  it("reads mongoexport JSON lines and sends the chosen collection", async () => {
    const m = mockFetch({ ...baseRoutes, "POST /imports/investments": () => ({ data: { source: "sip-capital", dryRun: true, total: 2, imported: 2, duplicates: 0, invalid: [], createdAssets: ["fund:NIC"], positionErrors: [] } }) });
    renderWithClient(<ImportExportView />);
    await userEvent.click(screen.getByRole("radio", { name: "Import investments" }));
    await userEvent.selectOptions(screen.getByLabelText("Collection"), "sip-capital");
    await userEvent.upload(screen.getByLabelText("Choose a JSON file"), new File(['{"name":"NIC","amount":5}\n{"name":"NIC","amount":6}\n'], "sip.jsonl"));
    expect(await screen.findByText(/sip\.jsonl · 2 documents/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Check/ }));
    expect(await screen.findByText(/New assets:/)).toBeInTheDocument();
    expect(m.last("POST", "/imports/investments")!.body).toMatchObject({ source: "sip-capital", dryRun: true, rows: [{ name: "NIC", amount: 5 }, { name: "NIC", amount: 6 }] });
  });
  it("rejects a file that is not JSON", async () => {
    mockFetch(baseRoutes);
    renderWithClient(<ImportExportView />);
    await userEvent.click(screen.getByRole("radio", { name: "Import investments" }));
    await userEvent.upload(screen.getByLabelText("Choose a JSON file"), new File(["{oops"], "bad.json"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Line 1 is not valid JSON");
  });
});
