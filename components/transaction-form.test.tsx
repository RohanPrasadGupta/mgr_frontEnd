import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { T0, accounts, baseRoutes, me, npr } from "@/test/fixtures";
import { errorResponse, mockFetch, renderWithClient } from "@/test/utils";
import type { Transaction } from "@/lib/api/types";
import { TransactionForm } from "./transaction-form";

const routes = (extra: Record<string, unknown> = {}) => ({ ...baseRoutes, "POST /transactions": { data: { id: "t1" } }, ...extra });
const tx = (o: Partial<Transaction> = {}): Transaction => ({ ...T0, id: "t9", accountId: "a-cash", categoryId: "c-food", kind: "expense", amountMinor: 12_345, currency: "THB", fxRate: 1, baseAmountMinor: 12_345, occurredAt: "2025-08-26T06:30:00.000Z", occurredOn: "2025-08-26", note: "lunch", transferGroupId: null, recurringId: null, ...o });
async function open(ui: React.ReactElement, ready: () => Promise<unknown> = () => screen.findByRole("option", { name: /Cash \(THB\)/ })) { const r = renderWithClient(ui); await ready(); return r; }
const categoriesLoaded = () => screen.findByRole("option", { name: /Food/ });

describe("TransactionForm — add", () => {
  it("posts an expense in minor units with the chosen category and a client id", async () => {
    const m = mockFetch(routes());
    const onClose = vi.fn();
    await open(<TransactionForm open onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/^Amount/), "123.45");
    await userEvent.selectOptions(screen.getByLabelText("Category"), "c-food");
    await userEvent.type(screen.getByLabelText("Note"), "pad thai");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const body = m.last("POST", "/transactions")!.body;
    expect(body).toMatchObject({ accountId: "a-cash", kind: "expense", amountMinor: 12_345, categoryId: "c-food", note: "pad thai" });
    expect(body.clientId).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(body.occurredAt).toString()).not.toBe("Invalid Date");
    expect(body.fxRate).toBeUndefined();
  });

  it("refuses a zero amount without calling the API", async () => {
    const m = mockFetch(routes());
    await open(<TransactionForm open onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^Amount/), "0");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("greater than 0");
    expect(m.last("POST", "/transactions")).toBeUndefined();
  });

  it("only offers categories of the selected type", async () => {
    mockFetch(routes());
    await open(<TransactionForm open onClose={vi.fn()} />);
    const cat = screen.getByLabelText("Category");
    expect(within(cat).queryByRole("option", { name: /Food/ })).toBeInTheDocument();
    expect(within(cat).queryByRole("option", { name: /Salary/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Income" }));
    expect(within(cat).queryByRole("option", { name: /Salary/ })).toBeInTheDocument();
    expect(within(cat).queryByRole("option", { name: /Food/ })).not.toBeInTheDocument();
  });

  it("asks for an FX rate only for accounts outside the base currency, and sends it", async () => {
    const m = mockFetch(routes());
    await open(<TransactionForm open onClose={vi.fn()} />);
    expect(screen.queryByLabelText(/FX rate/)).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Account"), npr.id);
    const fx = await screen.findByLabelText(/FX rate NPR → THB/);
    await userEvent.type(fx, "0.25");
    await userEvent.type(screen.getByLabelText(/^Amount \(NPR\)/), "400");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("POST", "/transactions")).toBeDefined());
    expect(m.last("POST", "/transactions")!.body).toMatchObject({ accountId: npr.id, amountMinor: 40_000, fxRate: 0.25 });
  });

  it("shows the API's reason when the save fails and keeps the dialog open", async () => {
    mockFetch(routes({ "POST /transactions": () => errorResponse(422, "fx_rate_required", "No FX rate available for NPR→THB; supply fxRate") }));
    const onClose = vi.fn();
    await open(<TransactionForm open onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/^Amount/), "5");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No FX rate");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("refreshes balances, insights and budgets after saving", async () => {
    mockFetch(routes());
    const { client } = await open(<TransactionForm open onClose={vi.fn()} />);
    const spy = vi.spyOn(client, "invalidateQueries");
    await userEvent.type(screen.getByLabelText(/^Amount/), "5");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(spy.mock.calls.map((c) => (c[0]!.queryKey as string[])[0])).toEqual(expect.arrayContaining(["transactions", "accounts", "insights", "budgets"])));
  });
});

describe("TransactionForm — edit", () => {
  it("prefills, patches only editable fields, and can delete after confirming", async () => {
    const m = mockFetch(routes({ "PATCH /transactions/t9": { data: {} }, "DELETE /transactions/t9": null }));
    const onClose = vi.fn();
    await open(<TransactionForm open tx={tx()} onClose={onClose} />, categoriesLoaded);
    expect(screen.getByLabelText(/^Amount/)).toHaveValue(123.45);
    expect(screen.getByLabelText("Note")).toHaveValue("lunch");
    expect(screen.queryByLabelText("Account")).not.toBeInTheDocument(); // account can't change
    await userEvent.clear(screen.getByLabelText(/^Amount/));
    await userEvent.type(screen.getByLabelText(/^Amount/), "200");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(m.last("PATCH", "/transactions/t9")!.body).toMatchObject({ amountMinor: 20_000, categoryId: "c-food", note: "lunch" });

    vi.stubGlobal("confirm", vi.fn(() => false));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(m.last("DELETE", "/transactions/t9")).toBeUndefined(); // declined
    vi.stubGlobal("confirm", vi.fn(() => true));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(m.last("DELETE", "/transactions/t9")).toBeDefined());
  });

  it("treats transfers as date/note-only", async () => {
    const m = mockFetch(routes({ "PATCH /transactions/t9": { data: {} } }));
    await open(<TransactionForm open tx={tx({ kind: "transfer_out", categoryId: null, transferGroupId: "g1" })} onClose={vi.fn()} />, () => screen.findByRole("heading", { name: "Edit transfer" }));
    expect(screen.getByRole("heading", { name: "Edit transfer" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Amount/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Note"));
    await userEvent.type(screen.getByLabelText("Note"), "moved");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("PATCH", "/transactions/t9")).toBeDefined());
    const body = m.last("PATCH", "/transactions/t9")!.body;
    expect(body.note).toBe("moved");
    expect(body).not.toHaveProperty("amountMinor");
    expect(body).not.toHaveProperty("categoryId");
  });
});

it("fixture sanity: base currency is THB and four accounts exist", () => { expect(me.baseCurrency).toBe("THB"); expect(accounts).toHaveLength(4); });
