import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Debt, Goal, Note, Report } from "@/lib/api/types";
import { baseRoutes } from "@/test/fixtures";
import { mockFetch, renderWithClient } from "@/test/utils";
import { DebtsView } from "./debts-view";
import { GoalsView } from "./goals-view";
import { NotesView } from "./notes-view";
import { ReportsView, reportCsv } from "./reports-view";

vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
const at = "2026-01-01T00:00:00.000Z";

const goal = (o: Partial<Goal> = {}): Goal => ({ id: "g1", userId: "u1", name: "Laptop", targetMinor: 100_000, currency: "THB", targetDate: "2026-12-31", accountId: null, icon: "💻", color: null, note: null, archived: false, createdAt: at, updatedAt: at, source: "contributions", savedMinor: 25_000, remainingMinor: 75_000, pct: 25, monthlyNeededMinor: 7_500, status: "behind", ...o });

describe("GoalsView", () => {
  it("shows progress, status and the monthly amount needed", async () => {
    mockFetch({ ...baseRoutes, "GET /goals": { data: [goal(), goal({ id: "g2", name: "Fund", accountId: "a-bank", source: "account", status: "reached", savedMinor: 100_000, remainingMinor: 0, pct: 100, monthlyNeededMinor: null })] } });
    renderWithClient(<GoalsView />);
    expect(await screen.findByText("💻 Laptop")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Laptop progress" })).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText("Behind")).toBeInTheDocument();
    expect(screen.getByText(/Save about/)).toHaveTextContent("THB 75.00");
    expect(screen.getByText("Reached")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "+ Add money" })).toHaveLength(1); // not for the account-linked goal
  });
  it("creates a goal and adds money to one", async () => {
    const m = mockFetch({ ...baseRoutes, "GET /goals": { data: [goal()] }, "POST /goals": { data: goal({ id: "g3" }) }, "POST /goals/g1/contributions": { data: { id: "c1", goalId: "g1", amountMinor: 5000, occurredOn: "2026-02-01", note: null, createdAt: at } } });
    renderWithClient(<GoalsView />);
    await userEvent.click(await screen.findByRole("button", { name: "+ New goal" }));
    const dlg = screen.getByRole("dialog", { name: "New goal" });
    await userEvent.type(within(dlg).getByLabelText("Name"), "Trip");
    await userEvent.type(within(dlg).getByLabelText(/^Target \(/), "500");
    await userEvent.click(within(dlg).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("POST", "/goals")!.body).toMatchObject({ name: "Trip", targetMinor: 50_000 }));
    await userEvent.click(screen.getByRole("button", { name: "+ Add money" }));
    const add = screen.getByRole("dialog", { name: "Money · Laptop" });
    await userEvent.click(within(add).getByRole("radio", { name: "Take out" }));
    await userEvent.type(within(add).getByLabelText(/^Amount/), "50");
    await userEvent.click(within(add).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("POST", "/goals/g1/contributions")!.body).toMatchObject({ amountMinor: -5000 }));
  });
  it("folds the history into the card; each entry is edited or deleted in place", async () => {
    const entry = (o = {}) => ({ id: "c1", goalId: "g1", amountMinor: -5000, occurredOn: "2026-02-01", note: "oops", createdAt: at, ...o });
    const m = mockFetch({ ...baseRoutes, "GET /goals": { data: [goal()] }, "GET /goals/g1": { data: { goal: goal(), contributions: [entry(), entry({ id: "c2", amountMinor: 30_000, note: null })] } },
      "PATCH /goals/g1/contributions/c1": { data: entry({ amountMinor: -2000 }) }, "DELETE /goals/g1/contributions/c2": null });
    renderWithClient(<GoalsView />);
    const toggle = await screen.findByRole("button", { name: /^History/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(await screen.findByText("oops")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^History \(2\)/ })).toHaveAttribute("aria-expanded", "true");

    const edits = screen.getAllByRole("button", { name: /^Edit entry of/ });
    await userEvent.click(edits[0]!);
    const dlg = screen.getByRole("dialog", { name: "Edit entry · Laptop" });
    expect(within(dlg).getByRole("radio", { name: "Take out" })).toBeChecked(); // a withdrawal stays a withdrawal
    expect(within(dlg).getByLabelText(/^Amount/)).toHaveValue(50);
    await userEvent.clear(within(dlg).getByLabelText(/^Amount/));
    await userEvent.type(within(dlg).getByLabelText(/^Amount/), "20");
    await userEvent.clear(within(dlg).getByLabelText("Note"));
    await userEvent.click(within(dlg).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("PATCH", "/goals/g1/contributions/c1")!.body).toEqual({ amountMinor: -2000, occurredOn: "2026-02-01", note: null }));

    await userEvent.click(screen.getAllByRole("button", { name: /^Delete entry of/ })[1]!);
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Delete entry?" })).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(m.last("DELETE", "/goals/g1/contributions/c2")).toBeDefined()); // the goal id comes from the card
  });
  it("deletes only after confirming", async () => {
    const m = mockFetch({ ...baseRoutes, "GET /goals": { data: [goal()] }, "DELETE /goals/g1": null });
    renderWithClient(<GoalsView />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete goal Laptop" }));
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Delete goal?" })).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(m.last("DELETE", "/goals/g1")).toBeDefined());
  });
});

const debt = (o: Partial<Debt> = {}): Debt => ({ id: "d1", userId: "u1", direction: "lent", counterparty: "Ronit", principalMinor: 70_000, currency: "THB", startedOn: "2026-01-01", dueOn: "2026-02-01", note: null, createdAt: at, updatedAt: at, paidMinor: 50_000, outstandingMinor: 20_000, status: "overdue", lastPaidOn: "2026-01-15", ...o });

describe("DebtsView", () => {
  it("summarises per currency and lists debts with direction, status and outstanding", async () => {
    mockFetch({ ...baseRoutes, "GET /debts": { data: [debt()] }, "GET /debts/summary": { data: { totals: [{ currency: "THB", owedToMeMinor: 20_000, iOweMinor: 5_000, netMinor: 15_000 }], openCount: 1, overdueCount: 1 } } });
    renderWithClient(<DebtsView />);
    const sum = await screen.findByRole("region", { name: "Debt summary" });
    await within(sum).findByText("THB 200.00");
    expect(sum).toHaveTextContent("+THB 150.00");
    expect(sum).toHaveTextContent("1 overdue");
    expect(screen.getByText("Owes you")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });
  it("records a repayment prefilled with the outstanding amount", async () => {
    const m = mockFetch({ ...baseRoutes, "GET /debts": { data: [debt()] }, "GET /debts/summary": { data: { totals: [], openCount: 1, overdueCount: 0 } }, "POST /debts/d1/payments": { data: { id: "p1", debtId: "d1", amountMinor: 20_000, paidOn: "2026-03-01", note: null, createdAt: at } } });
    renderWithClient(<DebtsView />);
    await userEvent.click(await screen.findByRole("button", { name: "Repayment" }));
    const dlg = screen.getByRole("dialog", { name: "Repayment · Ronit" });
    expect(within(dlg).getByLabelText(/^Amount/)).toHaveValue(200);
    await userEvent.click(within(dlg).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("POST", "/debts/d1/payments")!.body).toMatchObject({ amountMinor: 20_000 }));
  });
  it("edits a debt's currency (a relabel: the amount is sent in the new currency)", async () => {
    const m = mockFetch({ ...baseRoutes, "GET /debts": { data: [debt()] }, "GET /debts/summary": { data: { totals: [], openCount: 1, overdueCount: 0 } }, "PATCH /debts/d1": { data: debt({ currency: "NPR" }) } });
    renderWithClient(<DebtsView />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit debt with Ronit" }));
    const dlg = screen.getByRole("dialog", { name: "Edit debt" });
    const pick = within(dlg).getByRole("combobox", { name: "Currency" });
    expect(pick).toBeEnabled();
    await userEvent.selectOptions(pick, "NPR");
    expect(dlg).toHaveTextContent("now in NPR — repayments too");
    await userEvent.click(within(dlg).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("PATCH", "/debts/d1")!.body).toMatchObject({ currency: "NPR", principalMinor: 70_000 }));
  });
  it("folds repayments under the debt; each one is edited (up to what is owed) or deleted in place", async () => {
    const pay = { id: "p1", debtId: "d1", amountMinor: 50_000, paidOn: "2026-01-15", note: null, createdAt: at };
    const m = mockFetch({ ...baseRoutes, "GET /debts": { data: [debt(), debt({ id: "d2", counterparty: "Milan", paidMinor: 0, outstandingMinor: 70_000, status: "open" })] }, "GET /debts/summary": { data: { totals: [], openCount: 2, overdueCount: 0 } },
      "GET /debts/d1": { data: { debt: debt(), payments: [pay] } }, "PATCH /debts/d1/payments/p1": { data: { ...pay, amountMinor: 60_000 } }, "DELETE /debts/d1/payments/p1": null });
    renderWithClient(<DebtsView />);
    expect(await screen.findAllByRole("button", { name: /^Repayments/ })).toHaveLength(1); // nothing to show for Milan
    await userEvent.click(screen.getByRole("button", { name: /^Repayments/ }));
    await userEvent.click(await screen.findByRole("button", { name: /^Edit repayment of/ }));
    const dlg = screen.getByRole("dialog", { name: "Edit repayment · Ronit" });
    const amount = within(dlg).getByLabelText(/^Amount/);
    expect(amount).toHaveValue(500);
    expect(amount).toHaveAttribute("max", "700"); // 200 still owed + this repayment's 500
    await userEvent.clear(amount);
    await userEvent.type(amount, "600");
    await userEvent.click(within(dlg).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("PATCH", "/debts/d1/payments/p1")!.body).toEqual({ amountMinor: 60_000, paidOn: "2026-01-15", note: null }));
    await userEvent.click(screen.getByRole("button", { name: /^Delete repayment of/ }));
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Delete repayment?" })).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(m.last("DELETE", "/debts/d1/payments/p1")).toBeDefined());
  });
});

const note = (o: Partial<Note> = {}): Note => ({ id: "n1", userId: "u1", title: "Plan", body: "save 20%", pinned: false, createdAt: at, updatedAt: at, ...o });
describe("NotesView", () => {
  it("lists notes, pins and searches (debounced)", async () => {
    const m = mockFetch({ ...baseRoutes, "GET /notes": { data: [note()] }, "PATCH /notes/n1": { data: note({ pinned: true }) } });
    renderWithClient(<NotesView />);
    expect(await screen.findByText("save 20%")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Pin Plan" }));
    await waitFor(() => expect(m.last("PATCH", "/notes/n1")!.body).toEqual({ pinned: true }));
    await userEvent.type(screen.getByLabelText("Search notes"), "tax");
    await waitFor(() => expect(m.urls("/notes").at(-1)).toContain("q=tax"), { timeout: 2000 });
  });
  it("creates a note", async () => {
    const m = mockFetch({ ...baseRoutes, "GET /notes": { data: [] }, "POST /notes": { data: note() } });
    renderWithClient(<NotesView />);
    await userEvent.click(await screen.findByRole("button", { name: "+ New note" }));
    const dlg = screen.getByRole("dialog", { name: "New note" });
    await userEvent.type(within(dlg).getByLabelText("Title"), "Groceries");
    await userEvent.type(within(dlg).getByLabelText("Note"), "milk");
    await userEvent.click(within(dlg).getByRole("checkbox"));
    await userEvent.click(within(dlg).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("POST", "/notes")!.body).toEqual({ title: "Groceries", body: "milk", pinned: true }));
  });
});

const report: Report = {
  period: "month", label: "March 2026", from: "2026-03-01", to: "2026-03-31", previousFrom: "2026-02-01", previousTo: "2026-02-28", baseCurrency: "THB",
  incomeMinor: 100_000, expenseMinor: 60_000, netMinor: 40_000, savingsRatePct: 40, transactionCount: 4, previous: { incomeMinor: 100_000, expenseMinor: 30_000, netMinor: 70_000 }, avgDailyExpenseMinor: 1935,
  expenseByCategory: [{ categoryId: "c-food", name: "=cmd|' /C calc'!A0", totalMinor: 40_000, pct: 66.7, previousMinor: 20_000, changePct: 100 }, { categoryId: null, name: "Uncategorised", totalMinor: 20_000, pct: 33.3, previousMinor: 0, changePct: null }],
  incomeByCategory: [{ categoryId: "c-salary", name: "Salary", totalMinor: 100_000, pct: 100, previousMinor: 100_000, changePct: 0 }],
  series: Array.from({ length: 31 }, (_, i) => ({ label: String(i + 1), from: `2026-03-${String(i + 1).padStart(2, "0")}`, to: `2026-03-${String(i + 1).padStart(2, "0")}`, incomeMinor: i === 0 ? 100_000 : 0, expenseMinor: i === 9 ? 30_000 : 0 })),
  topExpenses: [{ id: "t1", occurredOn: "2026-03-03", amountMinor: 30_000, currency: "THB", baseAmountMinor: 30_000, categoryName: "Food", note: "dinner", accountName: "Cash" }],
  byAccount: [{ accountId: "a-cash", name: "Cash", currency: "THB", incomeMinor: 100_000, expenseMinor: 60_000 }],
  budgets: [{ id: "b1", categoryName: "Food", amountMinor: 30_000, spentMinor: 40_000, pct: 133, state: "over" }],
};
describe("ReportsView", () => {
  it("renders totals with change vs previous period, categories, top expenses and budgets", async () => {
    mockFetch({ ...baseRoutes, "GET /reports": { data: report } });
    renderWithClient(<ReportsView />);
    const totals = await screen.findByRole("region", { name: "Totals" });
    expect(totals).toHaveTextContent("THB 600.00");
    expect(totals).toHaveTextContent("▲ 100% vs previous"); // expenses doubled
    expect(screen.getByText("dinner", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("new")).toBeInTheDocument(); // category with no previous spend
    expect(screen.getByText("Biggest expenses")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Income and expense for March 2026/ })).toBeInTheDocument();
  });
  it("switches to a yearly report", async () => {
    const m = mockFetch({ ...baseRoutes, "GET /reports": { data: report } });
    renderWithClient(<ReportsView />);
    await screen.findByRole("region", { name: "Totals" });
    await userEvent.click(screen.getByRole("radio", { name: "Yearly" }));
    await waitFor(() => expect(m.urls("/reports").at(-1)).toMatch(/period=year&year=\d{4}$/));
  });
  it("has an All time report: no period picker, no comparison", async () => {
    const all = { ...report, period: "all" as const, label: "All time", from: "2021-03-10", previous: { incomeMinor: 0, expenseMinor: 0, netMinor: 0 } };
    const m = mockFetch({ ...baseRoutes, "GET /reports": ({ url }: { url: URL }) => ({ data: url.searchParams.get("period") === "all" ? all : report }) });
    renderWithClient(<ReportsView />);
    await screen.findByRole("region", { name: "Totals" });
    await userEvent.click(screen.getByRole("radio", { name: "All time" }));
    await waitFor(() => expect(m.urls("/reports").at(-1)).toMatch(/period=all$/));
    expect(await screen.findByText(/everything recorded up to today/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous month" })).toBeNull();
    expect(screen.queryByText(/vs previous/)).toBeNull();
  });
  it("CSV export neutralises spreadsheet formulas and quotes properly", () => {
    const csv = reportCsv(report);
    expect(csv).toContain(`"'=cmd|' /C calc'!A0"`.replace(/^"|"$/g, "")); // prefixed with '
    expect(csv.split("\r\n")[0]).toBe("MoneyMgr report,March 2026");
    expect(csv).toContain("Expense,600.00,300.00");
  });
  it("CSV export keeps negative amounts as numbers (not neutralised text)", () => {
    const csv = reportCsv({ ...report, netMinor: -5_000, previous: { ...report.previous, netMinor: -12_345 } });
    expect(csv).toContain("Net,-50.00,-123.45");
    expect(csv).not.toContain("'-");
  });
});
