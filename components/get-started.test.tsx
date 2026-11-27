import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { T0, baseRoutes, me } from "@/test/fixtures";
import { mockFetch, renderWithClient, selectOption } from "@/test/utils";
import { GetStarted } from "./get-started";
import { PortfolioChart } from "./portfolio-chart";

vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
beforeEach(() => localStorage.clear());

const fresh = { "GET /transactions": { data: [], meta: { nextCursor: null } }, "GET /budgets/status": { data: { date: "2026-11-25", baseCurrency: "THB", items: [] } }, "GET /goals": { data: [] } };

describe("GetStarted", () => {
  it("shows a new user what's left, ticking off steps from their real data", async () => {
    mockFetch({ ...baseRoutes, "GET /me": { data: { ...me, emailVerified: false } }, ...fresh });
    renderWithClient(<GetStarted />);
    const card = await screen.findByRole("heading", { name: /Get started, Me/ });
    const root = card.closest("div.rounded-2xl") as HTMLElement;
    expect(within(root).getByText("1 of 5 done — a few minutes to set things up.")).toBeInTheDocument(); // accounts exist already
    expect(within(root).getByText("Add an account", { exact: false }).textContent).toContain("(done)");
    expect(within(root).getByRole("link", { name: "Import a spreadsheet" })).toHaveAttribute("href", "/import");
    expect(within(root).getByRole("button", { name: "Resend email" })).toBeInTheDocument();
  });

  it("disappears once everything is done", async () => {
    const m = mockFetch({
      ...baseRoutes,
      "GET /transactions": { data: [{ ...T0, id: "t1", accountId: "a-cash", categoryId: null, kind: "expense", amountMinor: 100, currency: "THB", fxRate: 1, baseAmountMinor: 100, occurredAt: "2026-11-01T00:00:00Z", occurredOn: "2026-11-01", note: null, transferGroupId: null, recurringId: null }], meta: { nextCursor: null } },
      "GET /budgets/status": { data: { date: "2026-11-25", baseCurrency: "THB", items: [{ id: "b1" }] } },
      "GET /goals": { data: [{ id: "g1" }] },
    });
    const { container } = renderWithClient(<GetStarted />);
    await waitFor(() => expect(m.urls("/goals").length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it("can be hidden, and stays hidden for this user", async () => {
    mockFetch({ ...baseRoutes, ...fresh });
    const first = renderWithClient(<GetStarted />);
    await userEvent.click(await screen.findByRole("button", { name: "Hide the get started checklist" }));
    expect(screen.queryByRole("heading", { name: /Get started/ })).not.toBeInTheDocument();
    first.unmount();
    renderWithClient(<GetStarted />);
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByRole("heading", { name: /Get started/ })).not.toBeInTheDocument();
    expect(localStorage.getItem("mm_get_started_hidden_u1")).toBe("1");
  });
});

describe("PortfolioChart", () => {
  it("plots value against invested and reports the change over the range", async () => {
    const m = mockFetch({ "GET /investments/portfolio/history": { data: { baseCurrency: "THB", asOf: "2026-11-25", approximate: true, excluded: [], points: [
      { date: "2026-09-30", valueMinor: 15_000, investedMinor: 15_000 }, { date: "2026-10-31", valueMinor: 17_000, investedMinor: 15_000 }, { date: "2026-11-25", valueMinor: 18_000, investedMinor: 15_000 }] } } });
    renderWithClient(<PortfolioChart />);
    expect(await screen.findByRole("img", { name: /Portfolio value and invested amount in THB, last 3 months/ })).toBeInTheDocument();
    expect(screen.getByText("+THB 30.00 (+20.0%)")).toBeInTheDocument(); // gain over invested, not raw growth
    expect(m.urls("/investments/portfolio/history")[0]).toContain("months=12");
    await userEvent.click(screen.getByRole("radio", { name: "5Y" }));
    await waitFor(() => expect(m.urls("/investments/portfolio/history").at(-1)).toContain("months=60"));
    await userEvent.click(screen.getByRole("radio", { name: "All" }));
    await waitFor(() => expect(m.urls("/investments/portfolio/history").at(-1)).toContain("all=true"));
  });
  it("can show the chart in another of the user's currencies", async () => {
    const hist = (currency: string) => ({ data: { baseCurrency: "THB", currency, asOf: "2026-11-25", approximate: true, excluded: [], points: [
      { date: "2026-10-31", valueMinor: 15_000, investedMinor: 15_000 }, { date: "2026-11-25", valueMinor: 18_000, investedMinor: 15_000 }] } });
    const m = mockFetch({ "GET /me": { data: { ...me, currencies: ["THB", "NPR"] } }, "GET /investments/portfolio/history": ({ url }: { url: URL }) => hist(url.searchParams.get("currency") ?? "THB") });
    renderWithClient(<PortfolioChart />);
    const pick = await screen.findByRole("combobox", { name: "Show in currency" });
    expect(m.urls("/investments/portfolio/history")[0]).not.toContain("currency=");
    await selectOption(pick, "NPR");
    await waitFor(() => expect(m.urls("/investments/portfolio/history").at(-1)).toContain("currency=NPR"));
    expect(await screen.findByText("NPR 180.00")).toBeInTheDocument();
  });
  it("explains an empty history instead of drawing a flat line", async () => {
    mockFetch({ "GET /investments/portfolio/history": { data: { baseCurrency: "THB", asOf: "2026-11-25", approximate: true, excluded: [], points: [] } } });
    renderWithClient(<PortfolioChart />);
    expect(await screen.findByText(/Record a trade or contribution/)).toBeInTheDocument();
  });
});
