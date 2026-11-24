import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorResponse, mockFetch } from "@/test/utils";
import { AuthForm } from "./auth-form";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
beforeEach(() => { router.replace.mockReset(); router.refresh.mockReset(); });

describe("AuthForm (login)", () => {
  it("posts credentials to the gateway and goes to the dashboard", async () => {
    const m = mockFetch({ "POST /api/auth/login": { data: { user: { id: "u1" } } } });
    render(<AuthForm mode="login" />);
    await userEvent.type(screen.getByLabelText("Email"), "me@example.com");
    await userEvent.type(screen.getByLabelText(/^Password/), "secret-pass");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(m.calls[0]).toMatchObject({ method: "POST", path: "/api/auth/login", body: { email: "me@example.com", password: "secret-pass" } });
  });

  it("shows the API's message on a wrong password and stays on the page", async () => {
    mockFetch({ "POST /api/auth/login": () => errorResponse(401, "unauthorized", "Invalid email or password") });
    render(<AuthForm mode="login" />);
    await userEvent.type(screen.getByLabelText("Email"), "me@example.com");
    await userEvent.type(screen.getByLabelText(/^Password/), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled(); // can retry
  });

  it("links to registration", () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/register");
  });
});

describe("AuthForm (register)", () => {
  it("sends name, upper-cased base currency and the browser's time zone", async () => {
    const m = mockFetch({ "POST /api/auth/register": { data: { user: { id: "u1" } } } });
    render(<AuthForm mode="register" />);
    await userEvent.type(screen.getByLabelText("Name"), "Rohan");
    await userEvent.type(screen.getByLabelText("Email"), "r@example.com");
    await userEvent.type(screen.getByLabelText(/^Password/), "longenough1");
    await userEvent.clear(screen.getByLabelText(/^Base currency/));
    await userEvent.type(screen.getByLabelText(/^Base currency/), "npr");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(m.calls[0]!.body).toMatchObject({ name: "Rohan", email: "r@example.com", baseCurrency: "NPR", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  });
  it("shows a conflict message for an existing email", async () => {
    mockFetch({ "POST /api/auth/register": () => errorResponse(409, "email_taken", "An account with this email already exists") });
    render(<AuthForm mode="register" />);
    await userEvent.type(screen.getByLabelText("Name"), "A");
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText(/^Password/), "longenough1");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
  });
});
