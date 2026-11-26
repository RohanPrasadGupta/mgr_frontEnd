import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { baseRoutes, me } from "@/test/fixtures";
import { mockFetch, renderWithClient } from "@/test/utils";
import { CurrencyOptions } from "./currency-options";
import { MyCurrenciesCard } from "./settings-view";

describe("currency picker", () => {
  it("lists your currencies first, then every other one", async () => {
    mockFetch(baseRoutes); // me: THB (base), NPR · all: THB, NPR, USD, EUR
    renderWithClient(<select aria-label="Currency"><CurrencyOptions /></select>);
    const yours = await screen.findByRole("group", { name: "Your currencies" });
    expect(within(yours).getAllByRole("option").map((o) => o.textContent)).toEqual(["THB", "NPR"]);
    expect(within(screen.getByRole("group", { name: "Other currencies" })).getAllByRole("option").map((o) => o.textContent)).toEqual(["EUR", "USD"]);
  });
});

describe("My currencies", () => {
  it("adds and removes currencies; the base currency can't be removed", async () => {
    const m = mockFetch({ ...baseRoutes, "PATCH /me": ({ body }: { body: { currencies: string[] } }) => ({ data: { ...me, currencies: body.currencies } }) });
    renderWithClient(<MyCurrenciesCard />);
    const u = userEvent.setup();
    expect(await screen.findByRole("button", { name: "Remove NPR" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove THB" })).toBeNull();

    await u.selectOptions(screen.getByLabelText("Add a currency"), "USD");
    await u.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(m.last("PATCH", "/me")!.body).toEqual({ currencies: ["THB", "NPR", "USD"] }));

    await u.click(screen.getByRole("button", { name: "Remove NPR" }));
    await waitFor(() => expect(m.last("PATCH", "/me")!.body).toEqual({ currencies: ["THB"] }));
  });
});
