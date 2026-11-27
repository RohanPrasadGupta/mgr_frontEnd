import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { baseRoutes, bank, cash, npr, usd } from "@/test/fixtures";
import { mockFetch, renderWithClient, selectOption, valueOf, optionValuesOf } from "@/test/utils";
import { TransferDialog } from "./transfer-dialog";

const routes = (accounts = baseRoutes["GET /accounts"]) => ({ ...baseRoutes, "GET /accounts": accounts, "POST /transfers": { data: { transferGroupId: "g1", legs: [] } } });
async function open(onClose = vi.fn(), defaultFrom?: string) { const r = renderWithClient(<TransferDialog open onClose={onClose} defaultFrom={defaultFrom} />); await screen.findByLabelText("From"); await waitFor(() => expect((screen.getByLabelText("From") as HTMLSelectElement).value).not.toBe("")); return { onClose, ...r }; }
const pick = (label: string, id: string) => selectOption(screen.getByLabelText(label), id);

describe("TransferDialog", () => {
  it("defaults to the first two accounts and sends a same-currency transfer without a received amount", async () => {
    const m = mockFetch(routes());
    const { onClose } = await open();
    expect(screen.queryByLabelText(/Amount received/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Amount sent/), "400");
    await userEvent.type(screen.getByLabelText("Note"), "top-up");
    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(m.last("POST", "/transfers")!.body).toMatchObject({ fromAccountId: cash.id, toAccountId: bank.id, amountMinor: 40_000, note: "top-up" });
    expect(m.last("POST", "/transfers")!.body.toAmountMinor).toBeUndefined();
  });

  it("preselects the account it was opened from", async () => {
    mockFetch(routes());
    await open(vi.fn(), bank.id);
    expect(valueOf(screen.getByLabelText("From"))).toBe(bank.id);
    expect(valueOf(screen.getByLabelText("To"))).not.toBe(bank.id);
  });

  it("cannot pick the same account on both sides, and swap flips them", async () => {
    mockFetch(routes());
    await open();
    expect(await optionValuesOf(screen.getByLabelText("To"))).not.toContain(cash.id);
    await userEvent.click(screen.getByRole("button", { name: "Swap accounts" }));
    expect(valueOf(screen.getByLabelText("From"))).toBe(bank.id);
    expect(valueOf(screen.getByLabelText("To"))).toBe(cash.id);
    await pick("From", usd.id);
    expect(valueOf(screen.getByLabelText("To"))).not.toBe(usd.id);
  });

  it("requires the received amount across currencies, shows the implied rate, and sends toAmountMinor", async () => {
    const m = mockFetch(routes());
    await open();
    await pick("To", npr.id);
    const received = await screen.findByLabelText(/Amount received \(NPR\)/);
    await userEvent.type(screen.getByLabelText(/^Amount sent/), "100");
    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));
    expect(m.last("POST", "/transfers")).toBeUndefined(); // native `required` blocks submit
    await userEvent.type(received, "400");
    expect(screen.getByText(/1 THB = 4\.0000 NPR/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));
    await waitFor(() => expect(m.last("POST", "/transfers")).toBeDefined());
    expect(m.last("POST", "/transfers")!.body).toMatchObject({ amountMinor: 10_000, toAmountMinor: 40_000, toAccountId: npr.id });
  });

  it("shows the FX field only when exactly one side is outside the base currency", async () => {
    mockFetch(routes());
    await open();
    expect(screen.queryByLabelText(/Exchange rate/)).not.toBeInTheDocument(); // THB → THB
    await pick("To", npr.id);
    expect(await screen.findByLabelText(/Exchange rate NPR → THB/)).toBeInTheDocument(); // THB → NPR
    await pick("From", usd.id);
    await pick("To", npr.id);
    await waitFor(() => expect(screen.queryByLabelText(/Exchange rate/)).not.toBeInTheDocument()); // USD → NPR: both foreign
  });

  it("warns (without blocking) when the amount exceeds the balance", async () => {
    mockFetch(routes());
    await open();
    await userEvent.type(screen.getByLabelText(/^Amount sent/), "999999");
    expect(screen.getByText(/more than the account's current balance/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transfer" })).toBeEnabled();
  });

  it("explains when fewer than two accounts exist", async () => {
    mockFetch(routes({ data: [cash] } as never));
    renderWithClient(<TransferDialog open onClose={vi.fn()} />);
    expect(await screen.findByText(/at least two active accounts/)).toBeInTheDocument();
  });
});
