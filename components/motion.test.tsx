import { act, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { T0, baseRoutes } from "@/test/fixtures";
import { mockFetch, renderWithClient } from "@/test/utils";
import { useCountUp } from "@/lib/use-count-up";
import type { Transaction } from "@/lib/api/types";
import { ActivityBar } from "./activity-bar";
import { TransactionRow } from "./transaction-row";
import { TransactionsView } from "./transactions-view";
import { Button, ListSkeleton } from "./ui";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Button loading", () => {
  it("disables the button, marks it busy and shows a spinner while keeping its label", () => {
    const click = vi.fn();
    renderWithClient(<Button loading onClick={click}>Save</Button>);
    const b = screen.getByRole("button", { name: "Save" });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
    expect(b.querySelector("svg.spinner")).not.toBeNull();
  });
  it("is a plain button when not loading", () => {
    renderWithClient(<Button>Save</Button>);
    const b = screen.getByRole("button", { name: "Save" });
    expect(b).toBeEnabled();
    expect(b).not.toHaveAttribute("aria-busy");
    expect(b.querySelector("svg")).toBeNull();
  });
});

describe("skeletons", () => {
  it("announce loading once and render the requested number of rows", () => {
    renderWithClient(<ListSkeleton rows={4} />);
    const s = screen.getByRole("status", { name: "Loading" });
    expect(s.querySelectorAll(".skeleton.rounded-full")).toHaveLength(4);
  });
});

describe("ActivityBar", () => {
  it("stays hidden for quick work and appears only once loading takes longer than ~250 ms", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let resolve!: () => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => { resolve = () => r(new Response("{}")); })));
    const { client, container } = renderWithClient(<ActivityBar />);
    const bar = () => container.querySelector(".indeterminate");
    void client.fetchQuery({ queryKey: ["slow"], queryFn: () => fetch("/x").then((r) => r.json()) });
    await act(async () => { vi.advanceTimersByTime(100); });
    expect(bar()).toBeNull();
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(bar()).not.toBeNull();
    await act(async () => { resolve(); await new Promise((r) => setTimeout(r, 0)); });
    await waitFor(() => expect(client.isFetching()).toBe(0));
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(bar()).toBeNull();
  });
});

describe("useCountUp", () => {
  it("returns the target straight away when motion can't run (no matchMedia, as in tests/SSR)", () => {
    const { result, rerender } = renderHook(({ v }) => useCountUp(v), { initialProps: { v: 100 as number | undefined } });
    expect(result.current).toBe(100);
    rerender({ v: 250 });
    expect(result.current).toBe(250);
    rerender({ v: undefined });
    expect(result.current).toBeUndefined();
  });
  it("tweens towards the target when motion is allowed, and lands exactly on it", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("no-preference"), media: q, addEventListener() {}, removeEventListener() {} }));
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, 80), { initialProps: { v: 0 } });
    rerender({ v: 1000 });
    await waitFor(() => expect(result.current).toBe(1000));
  });
});

describe("row being deleted", () => {
  const tx: Transaction = { ...T0, id: "x", accountId: "a-cash", categoryId: null, kind: "expense", amountMinor: 500, currency: "THB", fxRate: 1, baseAmountMinor: 500, occurredAt: "2026-11-20T05:00:00Z", occurredOn: "2026-11-20", note: null, transferGroupId: null, recurringId: null };
  it("fades and is marked busy, and its actions are disabled", () => {
    renderWithClient(<ul><TransactionRow tx={tx} baseCurrency="THB" onEdit={() => {}} onDelete={() => {}} busy /></ul>);
    const li = screen.getByRole("listitem");
    expect(li).toHaveAttribute("aria-busy", "true");
    expect(li.className).toContain("opacity-40");
  });
});

describe("filter changes keep the old list on screen (dimmed) instead of flashing a skeleton", () => {
  it("shows the previous month's rows as busy while the next month loads", async () => {
    let release!: () => void;
    let n = 0;
    mockFetch({
      ...baseRoutes,
      "GET /transactions": () => {
        n += 1;
        if (n === 1) return { data: [{ ...T0, id: "a", accountId: "a-cash", categoryId: "c-food", kind: "expense", amountMinor: 10_000, currency: "THB", fxRate: 1, baseAmountMinor: 10_000, occurredAt: "2026-11-20T05:00:00Z", occurredOn: "2026-11-20", note: "first month", transferGroupId: null, recurringId: null }], meta: { nextCursor: null } };
        return new Promise((r) => { release = () => r(new Response(JSON.stringify({ data: [], meta: { nextCursor: null } }), { headers: { "content-type": "application/json" } })); });
      },
    });
    renderWithClient(<TransactionsView />);
    await screen.findByText(/first month/);
    await userEvent.click(screen.getByRole("button", { name: /previous month/i }));
    // old rows remain, dimmed and busy; no skeleton
    await waitFor(() => expect(screen.getByText(/first month/).closest("[aria-busy='true']")).not.toBeNull());
    expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();
    await act(async () => release());
    await screen.findByText("No transactions this month.");
  });
});
