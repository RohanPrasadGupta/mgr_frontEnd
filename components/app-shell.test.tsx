import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { baseRoutes, me } from "@/test/fixtures";
import { mockFetch, renderWithClient } from "@/test/utils";
import { AppShell } from "./app-shell";

const nav = vi.hoisted(() => ({ path: "/budgets", replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path, useRouter: () => ({ replace: nav.replace, refresh: nav.refresh }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a>, useLinkStatus: () => ({ pending: false }) }));
beforeEach(() => { nav.path = "/budgets"; nav.replace.mockReset(); nav.refresh.mockReset(); });

describe("AppShell", () => {
  it("lists every destination in the sidebar and marks the current page", async () => {
    mockFetch(baseRoutes);
    renderWithClient(<AppShell><p>content</p></AppShell>);
    const [side] = screen.getAllByRole("navigation", { name: "Main" });
    for (const label of ["Dashboard", "Transactions", "Transfers", "Budgets", "Investments", "Goals", "Debts", "Reports", "Recurring", "Accounts", "Categories", "Notes", "Import & export", "Settings"]) {
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

  it("has a sidebar burger that toggles icons-only ↔ icons + labels, and remembers the choice", async () => {
    mockFetch(baseRoutes);
    const { unmount } = renderWithClient(<AppShell>x</AppShell>);
    const side = document.querySelector("aside")!;
    expect(side).toHaveAttribute("data-collapsed", "false");
    expect(within(side).getByText("Transactions")).toBeVisible();
    await userEvent.click(within(side).getByRole("button", { name: "Collapse sidebar" }));
    expect(side).toHaveAttribute("data-collapsed", "true");
    expect(within(side).queryByText("Transactions")).not.toBeInTheDocument(); // label gone…
    expect(within(side).getByRole("link", { name: "Transactions" })).toBeInTheDocument(); // …but still named for assistive tech
    expect(localStorage.getItem("mm_nav")).toBe("1");
    unmount();
    renderWithClient(<AppShell>x</AppShell>);
    await vi.waitFor(() => expect(document.querySelector("aside")).toHaveAttribute("data-collapsed", "true"));
    await userEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(localStorage.getItem("mm_nav")).toBe("0");
  });

  it("keeps the sidebar pinned (sticky, full height) so it doesn't scroll with the page", () => {
    mockFetch(baseRoutes);
    renderWithClient(<AppShell>x</AppShell>);
    expect(document.querySelector("aside")).toHaveClass("sticky", "top-0", "h-screen");
  });

  it("on small screens: a burger opens a drawer with every page, and a speed dial offers quick actions", async () => {
    mockFetch(baseRoutes);
    renderWithClient(<AppShell>x</AppShell>);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = await screen.findByRole("presentation");
    const links = within(drawer).getAllByRole("link").map((l) => l.textContent);
    expect(links).toEqual(["Dashboard", "Transactions", "Reports", "Investments", "Categories & tags", "Notes", "Transfers", "Budgets", "Goals", "Debts", "Recurring", "Accounts", "Import & export", "Settings"]);
    await userEvent.click(within(drawer).getByRole("button", { name: "Close menu" }));

    await vi.waitFor(() => expect(document.querySelector(".MuiDrawer-root")).toBeNull()); // modal un-hides the page when it has left
    const dial = await screen.findByRole("button", { name: "Quick actions" });
    await userEvent.click(dial);
    for (const n of ["Add transaction", "New transfer", "Dashboard", "Transactions", "Budgets", "Investments", "All pages"]) {
      expect(await screen.findByRole("menuitem", { name: n })).toBeInTheDocument();
    }
    await userEvent.setup({ pointerEventsCheck: 0 }).click(screen.getByRole("menuitem", { name: "Add transaction" })); // jsdom never finishes the dial's open transition
    expect(await screen.findByRole("dialog", { name: "Add transaction" })).toBeInTheDocument();
  });

  it("signs out through the gateway and returns to /login", async () => {
    const m = mockFetch({ ...baseRoutes, "POST /api/auth/logout": null });
    renderWithClient(<AppShell>x</AppShell>);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(m.last("POST", "/api/auth/logout")).toBeDefined();
    await vi.waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/login"));
  });

  it("asks unverified users to confirm their email and can resend the link", async () => {
    const m = mockFetch({ ...baseRoutes, "GET /me": { data: { ...me, emailVerified: false } }, "POST /me/resend-verification": { data: { accepted: true } } });
    renderWithClient(<AppShell>x</AppShell>);
    const banner = await screen.findByText(/Please confirm/);
    expect(banner).toHaveTextContent(me.email);
    await userEvent.click(screen.getByRole("button", { name: "Resend email" }));
    await vi.waitFor(() => expect(m.last("POST", "/me/resend-verification")).toBeDefined());
    expect(await screen.findByRole("button", { name: "Sent" })).toBeDisabled();
  });

  it("shows no banner once the email is verified", async () => {
    mockFetch(baseRoutes);
    renderWithClient(<AppShell>x</AppShell>);
    await screen.findAllByText("me@example.com");
    expect(screen.queryByText(/Please confirm/)).not.toBeInTheDocument();
  });
});
