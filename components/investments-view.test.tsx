import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { baseRoutes } from "@/test/fixtures";
import { mockFetch, renderWithClient } from "@/test/utils";
import { InvestmentsView } from "./investments-view";

const asset = (id: string, symbol: string, o: object = {}) => ({ id, userId: "u1", symbol, name: `${symbol} Ltd`, class: "stock", currency: "NPR", tracking: "units", costMethod: "wavg", archived: false, createdAt: "2025-01-01T00:00:00.000Z", deletedAt: null, ...o });
const holding = (a: ReturnType<typeof asset>, o: object = {}) => ({
  asset: a, quantity: 13, avgCostMinor: 35_615, remainingCostMinor: 463_000, totalBoughtMinor: 463_000, totalSoldMinor: 0, contributedMinor: 0, withdrawnMinor: 0, feesMinor: 0, dividendsMinor: 0,
  realisedPnlMinor: 0, latestPrice: null, marketValueMinor: null, unrealisedPnlMinor: null, returnPct: null, xirrPct: null, closed: false, tradeCount: 2,
  firstTradedOn: "2025-01-01", lastTradedOn: "2025-02-01", lastBuyPriceMinor: 43_300, lastSellPriceMinor: null, ...o,
});
const portfolio = {
  baseCurrency: "THB", asOf: "2026-11-26", investedMinor: 0, marketValueMinor: 0, unrealisedPnlMinor: 0, realisedPnlMinor: 0, dividendsMinor: 0, xirrPct: null, approximate: false, pricedAll: false,
  allocation: [], excluded: [],
  holdings: [
    holding(asset("a1", "ILI"), { quantity: 0, closed: true, remainingCostMinor: 0, totalBoughtMinor: 941_600, totalSoldMinor: 1_012_000, realisedPnlMinor: 70_400, lastBuyPriceMinor: 42_800, lastSellPriceMinor: 46_000 }),
    holding(asset("a2", "SNLI")),
  ],
};

describe("investments list", () => {
  beforeEach(() => window.history.replaceState(null, "", "/investments")); // the open tab lives in the URL
  it("shows each holding's figures and latest prices, open ones first and closed ones faded", async () => {
    mockFetch({ ...baseRoutes, "GET /investments/portfolio": { data: portfolio }, "GET /investments/portfolio/history": { data: { baseCurrency: "THB", points: [] } }, "GET /investments/trades": { data: [] } });
    renderWithClient(<InvestmentsView />);
    await userEvent.click(await screen.findByRole("tab", { name: "Stock" }));
    const list = await screen.findByRole("list", { name: "Holdings" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((r) => within(r).getByRole("link").getAttribute("aria-label"))).toEqual(["SNLI", "ILI (closed)"]);
    const [snli, ili] = rows as [HTMLElement, HTMLElement];
    expect(snli).toHaveTextContent("Total bought");
    expect(snli).toHaveTextContent("13 units");
    expect(snli).toHaveTextContent(/Last buy: NPR\s?433/);
    expect(snli).toHaveTextContent("no sells yet");
    expect(ili.className).toMatch(/opacity-55/);
    expect(ili).toHaveTextContent("0 units (closed)");
    expect(ili).toHaveTextContent(/Last sell: NPR\s?460/);
    expect(ili).toHaveTextContent(/\+NPR\s?704/);
  });

  it("has an Overview with a card per type, and a tab per type that keeps its place in the URL", async () => {
    const trades = [
      { id: "x1", userId: "u1", assetId: "a2", type: "buy", quantity: 5, priceMinor: 43_300, amountMinor: 216_500, feeMinor: 0, tradedOn: "2026-11-02", note: null, includeInAvg: true, clientId: null, createdAt: "2026-11-02T00:00:00.000Z" },
    ];
    mockFetch({ ...baseRoutes, "GET /investments/portfolio": { data: portfolio }, "GET /investments/portfolio/history": { data: { baseCurrency: "THB", points: [] } }, "GET /investments/trades": { data: trades } });
    renderWithClient(<InvestmentsView />);
    expect(await screen.findByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Overview", "Stock"]);
    expect(screen.getByRole("button", { name: /Stock capital/ })).toHaveTextContent("4 entries");
    const activity = await screen.findByRole("list", { name: "Recent activity" });
    expect(activity).toHaveTextContent(/Stock · SNLI · Buy 5/);
    await userEvent.click(screen.getByRole("tab", { name: "Stock" }));
    expect(window.location.search).toBe("?tab=stock");
    expect(screen.getByRole("button", { name: "+ Add stock" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Overview" }));
    expect(window.location.search).toBe("");
  });

  it("a type with nothing recorded can be removed (its empty assets are deleted); one with entries can't", async () => {
    const empty = holding(asset("o1", "SSF", { class: "other", tracking: "value" }), { tradeCount: 0, quantity: 0, remainingCostMinor: 0, totalBoughtMinor: 0 });
    const m = mockFetch({
      ...baseRoutes,
      "GET /investments/portfolio": { data: { ...portfolio, holdings: [...portfolio.holdings, empty] } },
      "GET /investments/portfolio/history": { data: { baseCurrency: "THB", points: [] } },
      "GET /investments/trades": { data: [] },
      "DELETE /investments/assets/o1": null,
    });
    renderWithClient(<InvestmentsView />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("tab", { name: "Stock" }));
    expect(screen.getByRole("button", { name: "Remove Stock" })).toBeDisabled();
    expect(screen.getByText(/delete its 4 entries first/)).toBeInTheDocument();

    await u.click(screen.getByRole("tab", { name: "Other" }));
    expect(screen.getByText("No entries yet.")).toBeInTheDocument(); // the chart doesn't load forever
    await u.click(screen.getByRole("button", { name: "Remove Other" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/SSF/);
    await u.click(within(dialog).getByRole("button", { name: "Remove Other" }));
    await waitFor(() => expect(m.calls.some((c) => c.method === "DELETE" && c.path === "/investments/assets/o1")).toBe(true));
  });

  it("adding a crypto asks how it's recorded (amount only by default)", async () => {
    const m = mockFetch({ ...baseRoutes, "GET /investments/portfolio": { data: { ...portfolio, holdings: [] } }, "GET /investments/trades": { data: [] }, "POST /investments/assets": { data: asset("c1", "BTC", { class: "crypto", tracking: "value" }) } });
    renderWithClient(<InvestmentsView />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "+ Add asset" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("radiogroup", { name: "How do you record it?" })).toBeNull(); // stocks: units and price
    await u.selectOptions(within(dialog).getByLabelText("Type"), "crypto");
    expect(within(dialog).getByRole("radio", { name: /Amount only/ })).toBeChecked();
    await u.type(within(dialog).getByLabelText("Symbol / short name"), "btc");
    await u.type(within(dialog).getByLabelText("Name"), "Bitcoin");
    await u.click(within(dialog).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(m.last("POST", "/investments/assets")!.body).toMatchObject({ class: "crypto", tracking: "value", symbol: "btc" }));
  });

  it("shows only the portfolio value, one total per currency (no mixed-currency P/L cards)", async () => {
    mockFetch({ ...baseRoutes, "GET /investments/portfolio": { data: portfolio }, "GET /investments/portfolio/history": { data: { baseCurrency: "THB", points: [] } }, "GET /investments/trades": { data: [] } });
    renderWithClient(<InvestmentsView />);
    const sec = await screen.findByRole("region", { name: "Portfolio value" });
    expect(sec).toHaveTextContent(/Portfolio value\s*NPR\s?4,630.00/); // both holdings are NPR → one total
    expect(screen.queryByText("Unrealised P/L")).toBeNull();
    expect(screen.queryByText("Invested (cost)")).toBeNull();
  });
});
