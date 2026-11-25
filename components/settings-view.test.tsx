import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { baseRoutes } from "@/test/fixtures";
import { errorResponse, mockFetch, renderWithClient } from "@/test/utils";
import { SettingsView } from "./settings-view";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
beforeEach(() => { delete document.documentElement.dataset.theme; router.replace.mockReset(); router.refresh.mockReset(); });
const ready = () => screen.findByLabelText("Name");

describe("SettingsView", () => {
  it("loads the profile and keeps Save disabled until something changes", async () => {
    mockFetch(baseRoutes);
    renderWithClient(<SettingsView />);
    expect(await ready()).toHaveValue("Me");
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByLabelText(/Base currency/)).toHaveValue("THB");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Name"), "x");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("saves name, time zone and week start", async () => {
    const m = mockFetch({ ...baseRoutes, "PATCH /me": { data: {} } });
    renderWithClient(<SettingsView />);
    await ready();
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "New Name");
    await userEvent.selectOptions(screen.getByLabelText("Week starts on"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Saved.");
    expect(m.last("PATCH", "/me")!.body).toEqual({ name: "New Name", baseCurrency: "THB", timezone: "Asia/Bangkok", weekStart: 0 });
  });

  it("warns about a base-currency change and sends nothing if the user declines", async () => {
    const m = mockFetch({ ...baseRoutes, "PATCH /me": { data: {} } });
    renderWithClient(<SettingsView />);
    await ready();
    await userEvent.selectOptions(await screen.findByLabelText(/Base currency/), "NPR");
    expect(screen.getByRole("alert")).toHaveTextContent(/does not convert your existing transactions/);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const dlg = await screen.findByRole("dialog", { name: "Change base currency?" });
    expect(dlg).toHaveTextContent(/NPR/);
    await userEvent.click(within(dlg).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(m.last("PATCH", "/me")).toBeUndefined(); // declined → nothing sent
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Change currency" }));
    await waitFor(() => expect(m.last("PATCH", "/me")!.body.baseCurrency).toBe("NPR"));
  });

  it("applies and persists the theme choice, and clears it for System", async () => {
    mockFetch(baseRoutes);
    renderWithClient(<SettingsView />);
    await ready();
    await userEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("mm_theme")).toBe("dark");
    await userEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    await userEvent.click(screen.getByRole("radio", { name: "System" }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem("mm_theme")).toBeNull();
  });

  it("restores the saved theme selection on load", async () => {
    localStorage.setItem("mm_theme", "dark");
    mockFetch(baseRoutes);
    renderWithClient(<SettingsView />);
    await ready();
    await waitFor(() => expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked());
  });
});

describe("Delete account", () => {
  const openDialog = async () => { await ready(); await userEvent.click(screen.getByRole("button", { name: /Delete my account/ })); return screen.findByRole("heading", { name: "Delete your account?" }); };

  it("explains what is lost and offers a data download first", async () => {
    mockFetch(baseRoutes);
    renderWithClient(<SettingsView />);
    await ready();
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download your transactions first/ })).toHaveAttribute("href", "/import");
  });

  it("keeps the destructive button disabled until the password and the confirmation word are entered", async () => {
    mockFetch(baseRoutes);
    renderWithClient(<SettingsView />);
    await openDialog();
    const go = screen.getByRole("button", { name: "Delete everything" });
    expect(go).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Your password"), "hunter2hunter2");
    expect(go).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Type DELETE/), "delete"); // case matters
    expect(go).toBeDisabled();
    await userEvent.clear(screen.getByLabelText(/Type DELETE/));
    await userEvent.type(screen.getByLabelText(/Type DELETE/), "DELETE");
    expect(go).toBeEnabled();
  });

  it("deletes through the API, clears the session and leaves for /login", async () => {
    const m = mockFetch({ ...baseRoutes, "DELETE /me": null, "POST /api/auth/logout": null });
    const { client } = renderWithClient(<SettingsView />);
    client.setQueryData(["accounts"], [{ id: "x" }]);
    await openDialog();
    await userEvent.type(screen.getByLabelText("Your password"), "hunter2hunter2");
    await userEvent.type(screen.getByLabelText(/Type DELETE/), "DELETE");
    await userEvent.click(screen.getByRole("button", { name: "Delete everything" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(m.last("DELETE", "/me")!.body).toEqual({ password: "hunter2hunter2" });
    expect(m.last("POST", "/api/auth/logout")).toBeDefined();
    expect(client.getQueryData(["accounts"])).toBeUndefined(); // cache wiped
  });

  it("shows the API's message for a wrong password and stays on the page", async () => {
    mockFetch({ ...baseRoutes, "DELETE /me": () => errorResponse(403, "incorrect_password", "Incorrect password") });
    renderWithClient(<SettingsView />);
    await openDialog();
    await userEvent.type(screen.getByLabelText("Your password"), "wrongwrong");
    await userEvent.type(screen.getByLabelText(/Type DELETE/), "DELETE");
    await userEvent.click(screen.getByRole("button", { name: "Delete everything" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect password");
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete everything" })).toBeEnabled(); // can retry
  });

  it("shows the lock-out message after too many attempts", async () => {
    mockFetch({ ...baseRoutes, "DELETE /me": () => errorResponse(429, "too_many_attempts", "Too many incorrect passwords. Try again in a few minutes.") });
    renderWithClient(<SettingsView />);
    await openDialog();
    await userEvent.type(screen.getByLabelText("Your password"), "x");
    await userEvent.type(screen.getByLabelText(/Type DELETE/), "DELETE");
    await userEvent.click(screen.getByRole("button", { name: "Delete everything" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Too many incorrect passwords/);
  });

  it("cancel closes the dialog without calling the API and forgets what was typed", async () => {
    const m = mockFetch({ ...baseRoutes, "DELETE /me": null });
    renderWithClient(<SettingsView />);
    await openDialog();
    await userEvent.type(screen.getByLabelText("Your password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("heading", { name: "Delete your account?" })).not.toBeInTheDocument();
    expect(m.last("DELETE", "/me")).toBeUndefined();
    await userEvent.click(screen.getByRole("button", { name: /Delete my account/ }));
    expect(screen.getByLabelText("Your password")).toHaveValue("");
  });
});
