import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { baseRoutes, me } from "@/test/fixtures";
import { mockFetch, renderWithClient, selectOption } from "@/test/utils";
import { CurrencySelect } from "./currency-options";
import { MyCurrenciesCard } from "./settings-view";

describe("currency picker", () => {
  it("lists your currencies first, then every other one", async () => {
    mockFetch(baseRoutes); // me: THB (base), NPR · all: THB, NPR, USD, EUR
    renderWithClient(<CurrencySelect aria-label="Currency" defaultValue="THB" />);
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Currency" })).toHaveTextContent("THB"));
    await userEvent.click(screen.getByRole("combobox", { name: "Currency" }));
    const list = await screen.findByRole("listbox");
    // group headings, then the codes under each: yours first, every other one A→Z
    expect([...list.children].map((li) => li.textContent)).toEqual(["Your currencies", "THB", "NPR", "Other currencies", "EUR", "USD"]);
  });
});

describe("My currencies", () => {
  it("adds and removes currencies; the base currency can't be removed", async () => {
    const m = mockFetch({ ...baseRoutes, "PATCH /me": ({ body }: { body: { currencies: string[] } }) => ({ data: { ...me, currencies: body.currencies } }) });
    renderWithClient(<MyCurrenciesCard />);
    const u = userEvent.setup();
    expect(await screen.findByRole("button", { name: "Remove NPR" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove THB" })).toBeNull();

    await selectOption(screen.getByLabelText("Add a currency"), "USD");
    await u.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(m.last("PATCH", "/me")!.body).toEqual({ currencies: ["THB", "NPR", "USD"] }));

    await u.click(screen.getByRole("button", { name: "Remove NPR" }));
    await waitFor(() => expect(m.last("PATCH", "/me")!.body).toEqual({ currencies: ["THB"] }));
  });
});
