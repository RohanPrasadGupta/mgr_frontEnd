import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { T0, baseRoutes } from "@/test/fixtures";
import { mockFetch, renderWithClient } from "@/test/utils";
import type { Transaction } from "@/lib/api/types";
import { TransactionsView } from "./transactions-view";

const t = (o: Partial<Transaction>): Transaction => ({ ...T0, id: "t", accountId: "a-cash", categoryId: "c-food", kind: "expense", amountMinor: 10_000, currency: "THB", fxRate: 1, baseAmountMinor: 10_000, occurredAt: "2026-11-20T05:00:00Z", occurredOn: "2026-11-20", note: null, transferGroupId: null, recurringId: null, ...o });
const page = (data: Transaction[], nextCursor: string | null = null) => ({ data, meta: { nextCursor } });
const nb = (s: string | null) => (s ?? "").replace(/ /g, " ");

describe("TransactionsView", () => {
  it("groups by day with income/expense totals in the base currency, and labels transfers", async () => {
    mockFetch({ ...baseRoutes, "GET /transactions": page([
      t({ id: "1", note: "lunch", amountMinor: 12_000, baseAmountMinor: 12_000 }),
      t({ id: "2", kind: "income", categoryId: "c-salary", amountMinor: 500_000, baseAmountMinor: 500_000 }),
      t({ id: "3", kind: "expense", currency: "NPR", accountId: "a-npr", amountMinor: 40_000, baseAmountMinor: 9_140 }),
      t({ id: "4", occurredOn: "2026-11-19", kind: "transfer_out", categoryId: null, amountMinor: 20_000, baseAmountMinor: 20_000 }),
    ]) });
    renderWithClient(<TransactionsView />);
    const nov20 = (await screen.findByText(/Fri, Nov 20/)).closest("div[class*='rounded-2xl']") as HTMLElement;
    expect(nb(nov20.textContent)).toContain("+THB 5,000.00");
    expect(nb(nov20.textContent)).toContain("−THB 211.40"); // 120.00 + NPR row converted (91.40), not the raw 400 NPR
    expect(within(nov20).getByText("lunch · Cash")).toBeInTheDocument();
    expect(nb(nov20.textContent)).toContain("≈ THB 91.40"); // foreign-currency row shows its base value
    const nov19 = screen.getByText(/Thu, Nov 19/).closest("div[class*='rounded-2xl']") as HTMLElement;
    expect(within(nov19).getByText("Transfer out")).toBeInTheDocument();
    expect(nov19.querySelector("div.mb-1")!.textContent).not.toMatch(/200/); // transfers are not summed into the day header
  });

  it("filters by type and account through the API, and debounces search", async () => {
    const m = mockFetch({ ...baseRoutes, "GET /transactions": page([t({})]) });
    renderWithClient(<TransactionsView />);
    await screen.findByText(/Fri, Nov 20/);
    const lastUrl = () => decodeURIComponent(m.urls("/transactions").at(-1)!);
    await userEvent.click(screen.getByRole("radio", { name: "Expense" }));
    await waitFor(() => expect(lastUrl()).toContain("kind=expense"));
    await userEvent.selectOptions(screen.getByLabelText("Account"), "a-bank");
    await waitFor(() => expect(lastUrl()).toContain("accountId=a-bank"));
    const before = m.calls.length;
    await userEvent.type(screen.getByLabelText("Search"), "coffee");
    expect(m.calls.length).toBe(before); // nothing sent while typing
    await waitFor(() => expect(lastUrl()).toContain("q=coffee"), { timeout: 2000 });
  });

  it("shows empty states that distinguish 'no data' from 'filtered out'", async () => {
    mockFetch({ ...baseRoutes, "GET /transactions": page([]) });
    renderWithClient(<TransactionsView />);
    expect(await screen.findByText("No transactions this month.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Income" }));
    expect(await screen.findByText("No transactions match these filters.")).toBeInTheDocument();
  });

  it("loads the next page with the cursor", async () => {
    const m = mockFetch({ ...baseRoutes, "GET /transactions": ({ url }: { url: URL }) => (url.searchParams.get("cursor") ? page([t({ id: "9", occurredOn: "2026-11-02", note: "older" })]) : page([t({ id: "1" })], "CUR1")) });
    renderWithClient(<TransactionsView />);
    await userEvent.click(await screen.findByRole("button", { name: "Load more" }));
    expect(await screen.findByText("older · Cash")).toBeInTheDocument();
    expect(m.urls("/transactions").some((u) => u.includes("cursor=CUR1"))).toBe(true);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("opens the editor for a row and the add dialog from the header", async () => {
    mockFetch({ ...baseRoutes, "GET /transactions": page([t({ note: "lunch" })]) });
    renderWithClient(<TransactionsView />);
    await userEvent.click(await screen.findByText("lunch · Cash"));
    expect(await screen.findByRole("heading", { name: "Edit transaction" })).toBeInTheDocument();
  });

  it("shows a retryable error when loading fails", async () => {
    mockFetch({ ...baseRoutes, "GET /transactions": () => new Response("{}", { status: 500 }) });
    renderWithClient(<TransactionsView />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows edit and delete buttons on every row (no hunting for a clickable record)", async () => {
    mockFetch({ ...baseRoutes, "GET /transactions": page([t({ id: "1", note: "lunch" }), t({ id: "2", kind: "income", categoryId: "c-salary" })]) });
    renderWithClient(<TransactionsView />);
    await screen.findByText(/Fri, Nov 20/);
    expect(screen.getAllByRole("button", { name: /^Edit / })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^Delete / })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Edit Food" })).toBeInTheDocument();
  });

  it("Edit opens the edit form for that row", async () => {
    mockFetch({ ...baseRoutes, "GET /transactions": page([t({ id: "1", note: "lunch" })]) });
    renderWithClient(<TransactionsView />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit Food" }));
    expect(await screen.findByRole("heading", { name: "Edit transaction" })).toBeInTheDocument();
  });

  it("Delete asks in a dialog first; Cancel sends nothing, confirming deletes and shows a success toast", async () => {
    const m = mockFetch({ ...baseRoutes, "GET /transactions": page([t({ id: "1", note: "lunch" })]), "DELETE /transactions/1": null });
    renderWithClient(<TransactionsView />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete Food" }));
    let dlg = await screen.findByRole("dialog", { name: "Delete transaction?" });
    await userEvent.click(within(dlg).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(m.last("DELETE", "/transactions/1")).toBeUndefined();

    await userEvent.click(screen.getByRole("button", { name: "Delete Food" }));
    dlg = await screen.findByRole("dialog", { name: "Delete transaction?" });
    await userEvent.click(within(dlg).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(m.last("DELETE", "/transactions/1")).toBeDefined());
    expect(await screen.findByText("Transaction deleted")).toBeInTheDocument();
  });
});
