import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockFetch, renderWithClient } from "@/test/utils";
import { AssetView } from "./asset-view";

const ID = "11111111-1111-4111-8111-111111111111";
vi.mock("next/navigation", () => ({ useParams: () => ({ id: ID }), useRouter: () => ({ replace: vi.fn() }) }));

const asset = { id: ID, userId: ID, symbol: "SSHL", name: "Shiva Shree Hydropower", class: "stock", currency: "THB", tracking: "units", costMethod: "wavg", archived: false, createdAt: "2025-01-01T00:00:00.000Z", deletedAt: null };
const holding = { asset, quantity: 10, avgCostMinor: 19740, remainingCostMinor: 197400, totalBoughtMinor: 197400, totalSoldMinor: 0, contributedMinor: 0, withdrawnMinor: 0, feesMinor: 0, dividendsMinor: 0, realisedPnlMinor: 0, latestPrice: null, marketValueMinor: null, unrealisedPnlMinor: null, returnPct: null, xirrPct: null, closed: false, tradeCount: 2, firstTradedOn: "2026-01-14", lastTradedOn: "2026-01-29", lastBuyPriceMinor: 19740, lastSellPriceMinor: null };
const trade = (id: string, o: object = {}) => ({ id, userId: ID, assetId: ID, type: "buy", quantity: 10, priceMinor: 19740, amountMinor: 197400, feeMinor: 0, tradedOn: "2026-01-29", note: null, includeInAvg: true, clientId: null, createdAt: "2026-01-29T00:00:00.000Z", ...o });
const T1 = "22222222-2222-4222-8222-222222222222";
const T2 = "33333333-3333-4333-8333-333333333333";

function routes(extra: Record<string, unknown> = {}) {
  return {
    [`GET /investments/assets/${ID}`]: { data: holding },
    "GET /investments/trades": { data: [trade(T1), trade(T2, { tradedOn: "2026-01-14", quantity: 19, priceMinor: 15750, amountMinor: 299250 })] },
    [`GET /investments/assets/${ID}/prices`]: { data: [] },
    ...extra,
  };
}

describe("asset trades", () => {
  it("each row has its own Edit and Delete; Delete confirms and removes exactly that entry", async () => {
    const m = mockFetch(routes({ [`DELETE /investments/trades/${T2}`]: null }));
    renderWithClient(<AssetView />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "Delete buy of Jan 14, 2026" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Delete this buy from Jan 14, 2026?");
    await u.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(m.calls.some((c) => c.method === "DELETE" && c.path === `/investments/trades/${T2}`)).toBe(true));
    expect(m.calls.some((c) => c.method === "DELETE" && c.path === `/investments/trades/${T1}`)).toBe(false);
  });

  it("the edit form picks the type with radio buttons and can turn a buy into a sell", async () => {
    const m = mockFetch(routes({ [`PATCH /investments/trades/${T1}`]: { data: trade(T1, { type: "sell" }) } }));
    renderWithClient(<AssetView />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "Edit buy of Jan 29, 2026" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("radio", { name: "Buy" })).toBeChecked();
    expect(within(dialog).queryByRole("combobox")).toBeNull(); // no dropdown for the type
    expect(within(dialog).queryByRole("button", { name: "Delete" })).toBeNull(); // delete lives on the row now
    await u.click(within(dialog).getByRole("radio", { name: "Sell" }));
    await u.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("PATCH", `/investments/trades/${T1}`)!.body).toMatchObject({ type: "sell", quantity: 10, priceMinor: 19740 }));
  });

  it("leaves the type out of the update when it didn't change", async () => {
    const m = mockFetch(routes({ [`PATCH /investments/trades/${T1}`]: { data: trade(T1) } }));
    renderWithClient(<AssetView />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "Edit buy of Jan 29, 2026" }));
    await u.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("PATCH", `/investments/trades/${T1}`)).toBeTruthy());
    expect(m.last("PATCH", `/investments/trades/${T1}`)!.body.type).toBeUndefined();
  });

  it("each buy row has a 'use for average' switch that updates just that buy", async () => {
    const m = mockFetch(routes({ [`PATCH /investments/trades/${T2}`]: { data: trade(T2, { includeInAvg: false }) } }));
    renderWithClient(<AssetView />);
    const u = userEvent.setup();
    const sw = await screen.findByRole("switch", { name: "Use the buy of Jan 14, 2026 for the average price" });
    expect(sw).toHaveAttribute("aria-checked", "true");
    await u.click(sw);
    await waitFor(() => expect(m.last("PATCH", `/investments/trades/${T2}`)!.body).toEqual({ includeInAvg: false }));
  });

  it("the trade form shows the switch for every buy (not only 'selected buys') and sends it", async () => {
    const m = mockFetch(routes({ "POST /investments/trades": { data: trade("44444444-4444-4444-8444-444444444444") } }));
    renderWithClient(<AssetView />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "+ Add trade" }));
    const dialog = await screen.findByRole("dialog");
    const sw = within(dialog).getByRole("switch", { name: "Use for average price" });
    expect(sw).toHaveAttribute("aria-checked", "true"); // on by default
    await u.click(sw);
    await u.type(within(dialog).getByLabelText("Quantity"), "5");
    await u.type(within(dialog).getByLabelText(/^Price per unit/), "100");
    await u.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("POST", "/investments/trades")!.body).toMatchObject({ type: "buy", includeInAvg: false }));
  });

  it("changes the asset's currency after confirming that only the label changes", async () => {
    const m = mockFetch(routes({ [`PATCH /investments/assets/${ID}`]: { data: { ...asset, currency: "NPR" } }, "GET /me": { data: { id: ID, email: "a@b.co", name: "A", baseCurrency: "THB", currencies: ["THB", "NPR"], timezone: "Asia/Bangkok", locale: "en", weekStart: 1, emailVerified: true } }, "GET /currencies": { data: ["THB", "NPR"].map((code) => ({ code, name: code, symbol: code, minorUnit: 2 })) } }));
    renderWithClient(<AssetView />);
    const u = userEvent.setup();
    const select = await screen.findByLabelText("Currency");
    await waitFor(() => expect(within(select).getAllByRole("option").length).toBeGreaterThan(1));
    await u.selectOptions(select, "NPR");
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/only changes the label/);
    await u.click(within(dialog).getByRole("button", { name: "Use NPR" }));
    await waitFor(() => expect(m.last("PATCH", `/investments/assets/${ID}`)!.body).toEqual({ currency: "NPR" }));
  });

  it("amount-only crypto: Buy / Sell with amount + fee, quantity optional (with the implied price), and 'Recorded by' while empty", async () => {
    const coin = { ...asset, symbol: "BTC", class: "crypto", tracking: "value" };
    const m = mockFetch({
      [`GET /investments/assets/${ID}`]: { data: { ...holding, asset: coin, quantity: 0 } },
      "GET /investments/trades": { data: [] },
      [`GET /investments/assets/${ID}/prices`]: { data: [] },
      "POST /investments/trades": { data: trade("55555555-5555-4555-8555-555555555555", { type: "contribution" }) },
      [`PATCH /investments/assets/${ID}`]: { data: { ...coin, tracking: "units" } },
    });
    renderWithClient(<AssetView />);
    const u = userEvent.setup();
    expect(await screen.findByLabelText("Recorded by")).toHaveValue("value");
    await u.click(screen.getByRole("button", { name: "+ Add trade" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByRole("radio").map((r) => r.parentElement!.textContent)).toEqual(["Buy", "Sell", "Dividend", "Fee"]);
    await u.type(within(dialog).getByLabelText(/^Amount/), "500");
    await u.type(within(dialog).getByLabelText(/^Fee \/ charge/), "18.18");
    await u.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("POST", "/investments/trades")!.body).toMatchObject({ type: "contribution", amountMinor: 50_000, feeMinor: 1_818 }));
    expect(m.last("POST", "/investments/trades")!.body.quantity).toBeUndefined(); // no quantity given

    await u.click(screen.getByRole("button", { name: "+ Add trade" }));
    const again = await screen.findByRole("dialog");
    await u.type(within(again).getByLabelText(/^Amount/), "800");
    await u.type(within(again).getByLabelText(/^Quantity/), "0.004");
    expect(within(again).getByText(/≈ THB\s?200,000/)).toBeInTheDocument(); // implied price per unit
    await u.click(within(again).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("POST", "/investments/trades")!.body).toMatchObject({ type: "contribution", amountMinor: 80_000, quantity: 0.004 }));

    await u.selectOptions(screen.getByLabelText("Recorded by"), "units");
    await waitFor(() => expect(m.last("PATCH", `/investments/assets/${ID}`)!.body).toEqual({ tracking: "units" }));
  });
});
