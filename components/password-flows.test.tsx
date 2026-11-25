import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorResponse, mockFetch } from "@/test/utils";
import { ForgotPasswordForm, ResetPasswordForm, VerifyEmail } from "./password-flows";

const nav = vi.hoisted(() => ({ token: "t".repeat(40) as string | null, replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.token ? { token: nav.token } : {}), useRouter: () => ({ replace: nav.replace }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
beforeEach(() => { nav.token = "t".repeat(40); nav.replace.mockReset(); });

describe("ForgotPasswordForm", () => {
  it("posts the email and shows the same neutral confirmation whether or not it exists", async () => {
    const m = mockFetch({ "POST /api/auth/forgot-password": { data: { accepted: true } } });
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText("Email"), "me@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByText(/If an account exists for/)).toHaveTextContent("me@example.com");
    expect(m.last("POST", "/api/auth/forgot-password")!.body).toEqual({ email: "me@example.com" });
  });
  it("shows rate-limit errors", async () => {
    mockFetch({ "POST /api/auth/forgot-password": () => errorResponse(429, "rate_limited", "Too many requests") });
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText("Email"), "me@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests");
  });
});

describe("ResetPasswordForm", () => {
  it("takes the token out of the address bar, checks both passwords match, resets and signs this browser out", async () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    const m = mockFetch({ "POST /api/auth/reset-password": null, "POST /api/auth/logout": null });
    render(<ResetPasswordForm />);
    expect(replaceState).toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/^New password/), "new-password-1");
    await userEvent.type(screen.getByLabelText("Repeat new password"), "different-1");
    await userEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("don't match");
    expect(m.calls).toHaveLength(0);
    await userEvent.clear(screen.getByLabelText("Repeat new password"));
    await userEvent.type(screen.getByLabelText("Repeat new password"), "new-password-1");
    await userEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByRole("heading", { name: "Password changed" })).toBeInTheDocument();
    expect(m.last("POST", "/api/auth/reset-password")!.body).toEqual({ token: "t".repeat(40), password: "new-password-1" });
    expect(m.last("POST", "/api/auth/logout")).toBeDefined();
  });
  it("offers a new link when the token has expired", async () => {
    mockFetch({ "POST /api/auth/reset-password": () => errorResponse(400, "invalid_token", "This reset link is invalid or has expired. Request a new one.") });
    render(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText(/^New password/), "new-password-1");
    await userEvent.type(screen.getByLabelText("Repeat new password"), "new-password-1");
    await userEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/forgot-password");
  });
  it("explains a link without a token", () => {
    nav.token = null;
    render(<ResetPasswordForm />);
    expect(screen.getByRole("heading", { name: "Link incomplete" })).toBeInTheDocument();
  });
});

describe("VerifyEmail", () => {
  it("verifies once on load", async () => {
    const m = mockFetch({ "POST /api/auth/verify-email": { data: { verified: true } } });
    render(<VerifyEmail />);
    expect(await screen.findByRole("heading", { name: "Email confirmed" })).toBeInTheDocument();
    expect(m.calls.filter((c) => c.path === "/api/auth/verify-email")).toHaveLength(1);
  });
  it("shows the API's reason when it fails", async () => {
    mockFetch({ "POST /api/auth/verify-email": () => errorResponse(400, "invalid_token", "This verification link is invalid or has expired.") });
    render(<VerifyEmail />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("invalid or has expired"));
  });
});
