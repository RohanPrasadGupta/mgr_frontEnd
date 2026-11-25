import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { baseRoutes } from "@/test/fixtures";
import { errorResponse, mockFetch, renderWithClient } from "@/test/utils";
import { Dashboard } from "./dashboard";

vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));

const summary = (over = {}) => ({ data: { from: "2025-08-01", to: "2025-08-31", baseCurrency: "THB", incomeMinor: 1_000_000, expenseMinor: 600_000, netMinor: 400_000, savingsRatePct: 40, savingsBand: "healthy", transactionCount: 5, ...over } });
const cats = (kind: string) => ({ data: { from: "2025-08-01", to: "2025-08-31", kind, baseCurrency: "THB", totalMinor: 600_000, items: [{ categoryId: "c-food", name: "Food", totalMinor: 400_000, count: 3, pct: 66.7 }, { categoryId: "c-rent", name: "Rent", totalMinor: 200_000, count: 1, pct: 33.3 }] } });
const zeros = Array(12).fill(0);
const full = {
  ...baseRoutes,
  "GET /insights/summary": summary(),
  "GET /insights/by-category": ({ url }: { url: URL }) => cats(url.searchParams.get("kind")!),
  "GET /insights/daily": { data: { from: "2025-08-01", to: "2025-08-31", baseCurrency: "THB", days: [{ date: "2025-08-01", incomeMinor: 0, expenseMinor: 1000 }, { date: "2025-08-02", incomeMinor: 0, expenseMinor: 3000 }] } },
  "GET /insights/trend": { data: { year: 2025, baseCurrency: "THB", incomeMinor: zeros, expenseMinor: zeros.map((_, i) => i * 100), netMinor: zeros, cumulativeNetMinor: zeros } },
  "GET /budgets/status": { data: { date: "2025-08-15", baseCurrency: "THB", items: [] } },
  "GET /transactions": { data: [], meta: { nextCursor: null } },
};

describe("Dashboard", () => {
  it("shows KPIs, the savings gauge and every chart widget with data", async () => {
    mockFetch(full);
    renderWithClient(<Dashboard />);
    expect(await within(screen.getByRole("region", { name: "Summary" })).findByText("THB 10,000.00")).toBeInTheDocument(); // income KPI
    expect(within(screen.getByRole("region", { name: "Summary" })).getByText("THB 6,000.00")).toBeInTheDocument(); // expense KPI
    expect(await screen.findByRole("img", { name: /Savings rate 40/ })).toBeInTheDocument();
    for (const t of [/Income vs expense/, "Where the money went", /Spending per day/, "Income sources", /Net & running total/, "Budgets", "Recent transactions", "Accounts"]) {
      expect(screen.getByRole("heading", { name: t })).toBeInTheDocument();
    }
    expect(await screen.findByRole("img", { name: /Expenses by category/ })).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: /Daily spending/ })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("degrades per widget: a failing endpoint only affects its own card", async () => {
    mockFetch({ ...full, "GET /insights/daily": () => errorResponse(503, "unavailable", "Daily is down") });
    renderWithClient(<Dashboard />);
    expect(await screen.findByRole("img", { name: /Savings rate 40/ })).toBeInTheDocument();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Daily is down");
    expect(screen.getByRole("heading", { name: "Where the money went" })).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: /Expenses by category/ })).toBeInTheDocument();
  });

  it("when the server is down everywhere: page banner + dashes, no crash, and Retry everything recovers", async () => {
    let down = true;
    const gate = (ok: unknown) => () => (down ? errorResponse(503, "unavailable", "The server is unavailable.") : ok);
    const routes = Object.fromEntries(Object.entries(full).map(([k, v]) => [k, k === "GET /me" || k === "GET /accounts" || k === "GET /categories" || k === "GET /currencies" ? v : typeof v === "function" ? (a: never) => (down ? errorResponse(503, "unavailable", "The server is unavailable.") : (v as (x: never) => unknown)(a)) : gate(v)]));
    mockFetch(routes);
    renderWithClient(<Dashboard />);
    const banner = (await screen.findAllByRole("alert"))[0]!;
    expect(banner).toHaveTextContent("The server is unavailable.");
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByText(/couldn’t be shown/)).not.toBeInTheDocument(); // errors are handled, not crashes
    down = false;
    await userEvent.click(within(banner).getByRole("button", { name: "Retry everything" }));
    expect(await screen.findByText("THB 10,000.00")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("jumps to the latest month with data when the current month is empty", async () => {
    const m = mockFetch({
      ...full,
      "GET /insights/summary": ({ url }: { url: URL }) => url.searchParams.get("from") === "2025-08-01" ? summary() : summary({ incomeMinor: 0, expenseMinor: 0, netMinor: 0, savingsRatePct: null, savingsBand: "none", transactionCount: 0 }),
      "GET /transactions": ({ url }: { url: URL }) => url.searchParams.get("limit") === "1" ? { data: [{ id: "t1", occurredOn: "2025-08-12" }], meta: { nextCursor: null } } : { data: [], meta: { nextCursor: null } },
    });
    renderWithClient(<Dashboard />);
    expect(await screen.findByText("THB 10,000.00")).toBeInTheDocument();
    expect(m.calls.some((c) => c.path === "/insights/summary" && c.url.includes("from=2025-08-01"))).toBe(true);
  });
});
