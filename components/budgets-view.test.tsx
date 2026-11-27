import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { T0, baseRoutes } from "@/test/fixtures";
import { mockFetch, renderWithClient } from "@/test/utils";
import type { BudgetStatusItem } from "@/lib/api/types";
import { BudgetsView } from "./budgets-view";

const item = (o: Partial<BudgetStatusItem>): BudgetStatusItem => ({
  id: "b1", userId: T0.userId, createdAt: T0.createdAt, categoryId: "c-food", categoryName: "Food", period: "month", amountMinor: 100_000, currency: "THB", startOn: "2025-01-01", endOn: null, alertThresholdPct: 80,
  window: { from: "2026-11-01", to: "2026-11-30" }, spentMinor: 50_000, remainingMinor: 50_000, pct: 50, state: "ok", ...o,
});
const status = (items: BudgetStatusItem[]) => ({ data: { date: "2026-11-24", baseCurrency: "THB", items } });
const routes = (items: BudgetStatusItem[], extra: Record<string, unknown> = {}) => ({ ...baseRoutes, "GET /budgets/status": status(items), ...extra });
const text = (el: HTMLElement) => el.textContent!.replace(/ /g, " ");

describe("BudgetsView", () => {
  it("shows each budget's progress, remaining amount and state", async () => {
    mockFetch(routes([
      item({}),
      item({ id: "b2", categoryId: null, categoryName: null, amountMinor: 70_000, spentMinor: 85_000, remainingMinor: -15_000, pct: 121.4, state: "over" }),
      item({ id: "b3", categoryName: "Rent", spentMinor: 85_000, remainingMinor: 15_000, pct: 85, state: "warning" }),
    ]));
    renderWithClient(<BudgetsView />);
    expect(await screen.findByText("On track")).toBeInTheDocument();
    expect(screen.getByText("Over budget")).toBeInTheDocument();
    expect(screen.getByText("Close to limit")).toBeInTheDocument();
    expect(screen.getByText("All expenses")).toBeInTheDocument();
    const over = screen.getByRole("progressbar", { name: /All expenses budget used/ });
    expect(over).toHaveAttribute("aria-valuenow", "100"); // clamped, even though 121% is spent
    expect(text(over.closest("div")!.parentElement!)).toContain("THB 150.00 over");
    expect(text(screen.getByRole("progressbar", { name: /Food budget used/ }).parentElement!)).toContain("THB 500.00 left");
  });

  it("asks the API for 'today' in the current month and for month-end when browsing back", async () => {
    const m = mockFetch(routes([]));
    renderWithClient(<BudgetsView />);
    expect(await screen.findByText(/No budgets active/)).toBeInTheDocument();
    expect(m.calls.find((c) => c.path === "/budgets/status")).toBeDefined();
    expect(m.urls("/budgets/status")[0]).toBe("/api/v1/budgets/status"); // no date param
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    await waitFor(() => expect(m.urls("/budgets/status").some((u) => /budgets\/status\?date=\d{4}-\d{2}-\d{2}$/.test(u))).toBe(true));
  });

  it("creates a category budget in minor units", async () => {
    const m = mockFetch(routes([], { "POST /budgets": { data: {} } }));
    renderWithClient(<BudgetsView />);
    await userEvent.click(await screen.findByRole("button", { name: "+ Add budget" }));
    await userEvent.selectOptions(screen.getByLabelText("Category"), "c-food");
    await userEvent.type(screen.getByLabelText(/^Limit/), "1000");
    await userEvent.clear(screen.getByLabelText(/Warn me/));
    await userEvent.type(screen.getByLabelText(/Warn me/), "90");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("POST", "/budgets")).toBeDefined());
    expect(m.last("POST", "/budgets")!.body).toMatchObject({ categoryId: "c-food", period: "month", amountMinor: 100_000, alertThresholdPct: 90 });
  });

  it("repeats by default; switched off, a new monthly budget ends with its first month", async () => {
    const m = mockFetch(routes([], { "POST /budgets": { data: {} } }));
    renderWithClient(<BudgetsView />);
    await userEvent.click(await screen.findByRole("button", { name: "+ Add budget" }));
    const sw = screen.getByRole("switch", { name: "Repeat every month" });
    expect(sw).toHaveAttribute("aria-checked", "true");
    await userEvent.type(screen.getByLabelText(/^Starts/), "2026-02-10");
    await userEvent.type(screen.getByLabelText(/^Limit/), "100");
    await userEvent.click(sw);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("POST", "/budgets")).toBeDefined());
    expect(m.last("POST", "/budgets")!.body).toMatchObject({ period: "month", startOn: "2026-02-10", endOn: "2026-02-28" });
  });

  it("editing: switching repeat off stops it after the shown month; on again clears the end", async () => {
    const m = mockFetch(routes([item({}), item({ id: "b2", categoryName: "Rent", endOn: "2026-11-30" })], { "PATCH /budgets/b1": { data: {} }, "PATCH /budgets/b2": { data: {} } }));
    renderWithClient(<BudgetsView />);
    expect(await screen.findByText(/· repeats/)).toBeInTheDocument();
    expect(screen.getByText(/· ends Nov 30/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]!);
    await userEvent.click(screen.getByRole("switch", { name: "Repeat every month" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("PATCH", "/budgets/b1")!.body).toMatchObject({ endOn: "2026-11-30" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Edit" })[1]!);
    expect(screen.getByRole("switch", { name: "Repeat every month" })).toHaveAttribute("aria-checked", "false");
    await userEvent.click(screen.getByRole("switch", { name: "Repeat every month" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("PATCH", "/budgets/b2")!.body).toMatchObject({ endOn: null }));
  });

  it("requires both dates for a custom range", async () => {
    mockFetch(routes([]));
    renderWithClient(<BudgetsView />);
    await userEvent.click(await screen.findByRole("button", { name: "+ Add budget" }));
    await userEvent.selectOptions(screen.getByLabelText("Period"), "custom");
    expect(screen.getByLabelText("To")).toBeRequired();
    expect(screen.getByLabelText("From")).toBeRequired();
  });

  it("edits only the limit and threshold, and deletes after confirming", async () => {
    const m = mockFetch(routes([item({})], { "PATCH /budgets/b1": { data: {} }, "DELETE /budgets/b1": null }));
    renderWithClient(<BudgetsView />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText(/^Limit/)).toHaveValue(1000);
    expect(screen.queryByLabelText("Period")).not.toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/^Limit/));
    await userEvent.type(screen.getByLabelText(/^Limit/), "700");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.last("PATCH", "/budgets/b1")).toBeDefined());
    expect(m.last("PATCH", "/budgets/b1")!.body).toEqual({ amountMinor: 70_000, alertThresholdPct: 80 });

    await userEvent.click(within(await screen.findByRole("progressbar").then((p) => p.closest("div[class*='rounded-2xl']") as HTMLElement)).getByRole("button", { name: "Delete" }));
    const dlg = await screen.findByRole("dialog");
    expect(dlg).toHaveTextContent(/Delete the .* budget\?/);
    await userEvent.click(within(dlg).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(m.last("DELETE", "/budgets/b1")).toBeDefined());
  });

  it("shows a retryable error when the API fails", async () => {
    mockFetch({ ...baseRoutes, "GET /budgets/status": () => new Response("{}", { status: 500 }) });
    renderWithClient(<BudgetsView />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
