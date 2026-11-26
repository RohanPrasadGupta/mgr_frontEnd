import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockFetch, renderWithClient } from "@/test/utils";
import { AssetView } from "./asset-view";

const ID = "11111111-1111-4111-8111-111111111111";
vi.mock("next/navigation", () => ({ useParams: () => ({ id: ID }), useRouter: () => ({ replace: vi.fn() }) }));

const asset = { id: ID, userId: ID, symbol: "SSHL", name: "Shiva Shree Hydropower", class: "stock", currency: "THB", tracking: "units", costMethod: "wavg", archived: false, createdAt: "2025-01-01T00:00:00.000Z", deletedAt: null };
const holding = { asset, quantity: 10, avgCostMinor: 19740, remainingCostMinor: 197400, totalBoughtMinor: 197400, totalSoldMinor: 0, contributedMinor: 0, withdrawnMinor: 0, feesMinor: 0, dividendsMinor: 0, realisedPnlMinor: 0, latestPrice: null, marketValueMinor: null, unrealisedPnlMinor: null, returnPct: null, xirrPct: null, closed: false, tradeCount: 2, firstTradedOn: "2026-01-14", lastTradedOn: "2026-01-29" };
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
});
