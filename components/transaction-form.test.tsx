import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { T0, accounts, baseRoutes, me, npr } from "@/test/fixtures";
import { errorResponse, mockFetch, optionsOf, renderWithClient, selectOption, valueOf } from "@/test/utils";
import type { Transaction } from "@/lib/api/types";
import { TransactionForm } from "./transaction-form";

const routes = (extra: Record<string, unknown> = {}) => ({ ...baseRoutes, "POST /transactions": { data: { id: "t1" } }, ...extra });
const tx = (o: Partial<Transaction> = {}): Transaction => ({ ...T0, id: "t9", accountId: "a-cash", categoryId: "c-food", kind: "expense", amountMinor: 12_345, currency: "THB", fxRate: 1, baseAmountMinor: 12_345, occurredAt: "2025-08-26T06:30:00.000Z", occurredOn: "2025-08-26", note: "lunch", transferGroupId: null, recurringId: null, ...o });
const accountsLoaded = () => waitFor(() => expect(screen.getByRole("combobox", { name: /^Account/ })).toHaveTextContent(/Cash \(THB\)/));
async function open(ui: React.ReactElement, ready: () => Promise<unknown> = accountsLoaded) { const r = renderWithClient(ui); await ready(); return r; }
const categoriesLoaded = () => waitFor(() => expect(screen.getByRole("combobox", { name: "Category" })).toHaveTextContent(/Food/));

describe("TransactionForm — add", () => {
  it("posts an expense in minor units with the chosen category and a client id", async () => {
    const m = mockFetch(routes());
    const onClose = vi.fn();
    await open(<TransactionForm open onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/^Amount/), "123.45");
    await selectOption(screen.getByLabelText("Category"), "c-food");
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
    let names = await optionsOf(cat);
    expect(names.some((n) => /Food/.test(n))).toBe(true);
    expect(names.some((n) => /Salary/.test(n))).toBe(false);
    await userEvent.click(screen.getByRole("radio", { name: "Income" }));
    names = await optionsOf(screen.getByLabelText("Category"));
    expect(names.some((n) => /Salary/.test(n))).toBe(true);
    expect(names.some((n) => /Food/.test(n))).toBe(false);
  });

  it("asks for an FX rate only for accounts outside the base currency, and sends it", async () => {
    const m = mockFetch(routes());
    await open(<TransactionForm open onClose={vi.fn()} />);
    expect(screen.queryByLabelText(/Exchange rate/)).not.toBeInTheDocument();
    await selectOption(screen.getByLabelText("Account"), npr.id);
    const fx = await screen.findByLabelText(/Exchange rate NPR → THB/);
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
    expect(valueOf(screen.getByLabelText("Account"))).toBe("a-cash"); // the account it's in, and it can change
    await userEvent.clear(screen.getByLabelText(/^Amount/));
    await userEvent.type(screen.getByLabelText(/^Amount/), "200");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(m.last("PATCH", "/transactions/t9")!.body).toMatchObject({ amountMinor: 20_000, categoryId: "c-food", note: "lunch" });
    expect(m.last("PATCH", "/transactions/t9")!.body).not.toHaveProperty("accountId"); // unchanged → not sent

    vi.stubGlobal("confirm", vi.fn(() => false));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(m.last("DELETE", "/transactions/t9")).toBeUndefined(); // declined
    vi.stubGlobal("confirm", vi.fn(() => true));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(m.last("DELETE", "/transactions/t9")).toBeDefined());
  });

  it("moves a transaction to another account; into another currency the amount stays and a rate can be given", async () => {
    const m = mockFetch(routes({ "PATCH /transactions/t9": { data: {} } }));
    await open(<TransactionForm open tx={tx()} onClose={vi.fn()} />, categoriesLoaded);
    await selectOption(screen.getByLabelText(/^Account/), "a-bank");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("PATCH", "/transactions/t9")!.body).toMatchObject({ accountId: "a-bank", amountMinor: 12_345 }));
    expect(m.last("PATCH", "/transactions/t9")!.body).not.toHaveProperty("fxRate");
  });

  it("asks for the rate when an edit moves it into a foreign-currency account", async () => {
    const m = mockFetch(routes({ "PATCH /transactions/t9": { data: {} } }));
    await open(<TransactionForm open tx={tx()} onClose={vi.fn()} />, categoriesLoaded);
    await selectOption(screen.getByLabelText(/^Account/), "a-npr");
    expect(screen.getByText(/now in NPR/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Exchange rate|rate/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("PATCH", "/transactions/t9")!.body).toMatchObject({ accountId: "a-npr", amountMinor: 12_345 }));
  });

  it("treats transfers as date/note-only", async () => {
    const m = mockFetch(routes({ "PATCH /transactions/t9": { data: {} } }));
    await open(<TransactionForm open tx={tx({ kind: "transfer_out", categoryId: null, transferGroupId: "g1" })} onClose={vi.fn()} />, () => screen.findByRole("heading", { name: "Edit transfer" }));
    expect(screen.getByRole("heading", { name: "Edit transfer" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Amount/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Account/)).not.toBeInTheDocument(); // a transfer moves between two accounts; edit both by recreating
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

describe("TransactionForm — tags & receipts", () => {
  const tag = (id: string, name: string) => ({ id, userId: "u1", name, color: null, createdAt: "2025-01-01T00:00:00.000Z", usageCount: 0 });
  it("sends selected tags, creates a new tag inline, and uploads picked receipts after the transaction is saved", async () => {
    const m = mockFetch(routes({
      "GET /tags": { data: [tag("g1", "trip"), tag("g2", "work")] },
      "POST /tags": { data: tag("g3", "food-court") },
      "POST /transactions/t1/attachments": { data: { id: "a1", transactionId: "t1", fileName: "r.png", contentType: "image/png", sizeBytes: 4, createdAt: "2025-01-01T00:00:00.000Z" } },
    }));
    const onClose = vi.fn();
    await open(<TransactionForm open onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/^Amount/), "10");
    await userEvent.click(await screen.findByRole("button", { name: "#trip" }));
    expect(screen.getByRole("button", { name: "#trip" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.type(screen.getByLabelText("New tag"), "food-court{Enter}");
    await waitFor(() => expect(m.last("POST", "/tags")!.body).toEqual({ name: "food-court" }));
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "r.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("Attach files"), file);
    expect(screen.getByText("r.png")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(m.last("POST", "/transactions")!.body.tagIds).toEqual(["g1", "g3"]);
    const up = m.last("POST", "/transactions/t1/attachments")!;
    expect((up.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("rejects files that are too big or of the wrong type before uploading", async () => {
    mockFetch(routes());
    await open(<TransactionForm open onClose={vi.fn()} />);
    const big = new File([new Uint8Array(11 * 1024 * 1024)], "huge.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText("Attach files"), big);
    expect(screen.queryByText("huge.pdf")).not.toBeInTheDocument();
  });

  it("in edit mode lists existing attachments with links and patches the tag set", async () => {
    const m = mockFetch(routes({
      "GET /tags": { data: [tag("g1", "trip")] },
      "GET /transactions/t9/attachments": { data: [{ id: "a1", transactionId: "t9", fileName: "bill.pdf", contentType: "application/pdf", sizeBytes: 2048, createdAt: "2025-01-01T00:00:00.000Z" }] },
      "PATCH /transactions/t9": { data: {} },
    }));
    await open(<TransactionForm open tx={tx({ tagIds: ["g1"], attachmentCount: 1 })} onClose={vi.fn()} />, categoriesLoaded);
    expect(await screen.findByRole("link", { name: /bill\.pdf/ })).toHaveAttribute("href", "/api/v1/attachments/a1/file");
    await userEvent.click(await screen.findByRole("button", { name: "#trip" })); // deselect
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("PATCH", "/transactions/t9")!.body.tagIds).toEqual([]));
  });
});
