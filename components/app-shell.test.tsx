import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { baseRoutes } from "@/test/fixtures";
import { mockFetch, renderWithClient } from "@/test/utils";
import { AppShell } from "./app-shell";

const nav = vi.hoisted(() => ({ path: "/budgets", replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path, useRouter: () => ({ replace: nav.replace, refresh: nav.refresh }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
beforeEach(() => { nav.path = "/budgets"; nav.replace.mockReset(); nav.refresh.mockReset(); });

describe("AppShell", () => {
  it("lists every destination in the sidebar and marks the current page", async () => {
    mockFetch(baseRoutes);
    renderWithClient(<AppShell><p>content</p></AppShell>);
    const [side] = screen.getAllByRole("navigation", { name: "Main" });
    for (const label of ["Dashboard", "Transactions", "Transfers", "Budgets", "Investments", "Recurring", "Accounts", "Categories", "Import & export", "Settings"]) {
      expect(within(side!).getByRole("link", { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(within(side!).getByRole("link", { name: /Budgets/ })).toHaveAttribute("aria-current", "page");
    expect(within(side!).getByRole("link", { name: /Dashboard/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByText("content")).toBeInTheDocument();
    expect(await screen.findByText("me@example.com")).toBeInTheDocument();
  });

  it("only treats '/' as active on the dashboard itself", () => {
    nav.path = "/";
    mockFetch(baseRoutes);
    renderWithClient(<AppShell>x</AppShell>);
    const [side] = screen.getAllByRole("navigation", { name: "Main" });
    expect(within(side!).getByRole("link", { name: /Dashboard/ })).toHaveAttribute("aria-current", "page");
    expect(within(side!).getByRole("link", { name: /Budgets/ })).not.toHaveAttribute("aria-current");
  });

  it("keeps four primary tabs on mobile and puts the rest behind a More menu", async () => {
    nav.path = "/accounts";
    mockFetch(baseRoutes);
    renderWithClient(<AppShell>x</AppShell>);
    const bar = screen.getAllByRole("navigation", { name: "Main" })[1]!;
    expect(within(bar).getAllByRole("link").map((l) => l.textContent)).toEqual(["▦Home", "⇅Activity", "◔Budgets", "↗Invest"]);
    const more = within(bar).getByRole("button", { name: /More/ });
    expect(more).toHaveClass("text-primary"); // the current page (Accounts) lives under More
    expect(more).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    const menuLinks = screen.getAllByRole("link", { name: /Recurring|Accounts|Categories|Import|Settings|Transfers/ }).filter((l) => l.closest("div.fixed"));
    expect(menuLinks.map((l) => l.textContent!.replace(/^\W+/, ""))).toEqual(["Transfers", "Recurring", "Accounts", "Categories", "Import & export", "Settings"]);
    await userEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "false");
  });

  it("signs out through the gateway and returns to /login", async () => {
    const m = mockFetch({ ...baseRoutes, "POST /api/auth/logout": null });
    renderWithClient(<AppShell>x</AppShell>);
    await userEvent.click(screen.getAllByRole("button", { name: "Sign out" })[0]!);
    expect(m.last("POST", "/api/auth/logout")).toBeDefined();
    await vi.waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/login"));
  });
});
