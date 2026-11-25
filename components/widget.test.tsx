import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { Widget } from "./widget";

// next/error's catchError needs the Next runtime; model its contract: render children, fall back on throw, retry() resets.
vi.mock("next/error", async () => {
  const React = await import("react");
  return {
    catchError: (Fallback: (p: never, i: { error: Error; retry: () => void }) => React.ReactNode) =>
      class B extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
        state = { error: null as Error | null };
        static getDerivedStateFromError(error: Error) { return { error }; }
        render() {
          const { error } = this.state;
          return error ? (Fallback as (p: unknown, i: unknown) => React.ReactNode)(this.props, { error, retry: () => this.setState({ error: null }) }) : this.props.children;
        }
      },
  };
});

const ok = { isPending: false, error: null, refetch: vi.fn() };
let shouldThrow = true;
const Bomb = () => { if (shouldThrow) throw new Error("boom"); return <p>recovered</p>; };

describe("Widget", () => {
  it("renders children when idle", () => {
    render(<Widget title="T" state={ok}><p>content</p></Widget>);
    expect(screen.getByRole("heading", { name: "T" })).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });
  it("hides children behind a skeleton while pending", () => {
    render(<Widget title="T" state={{ ...ok, isPending: true }}><p>content</p></Widget>);
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });
  it("shows a retryable inline error when the request failed", async () => {
    const refetch = vi.fn();
    render(<Widget title="T" state={{ isPending: false, error: new ApiError(503, "unavailable", "The server is unavailable."), refetch }}><p>content</p></Widget>);
    expect(screen.getByRole("alert")).toHaveTextContent("The server is unavailable.");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
  it("contains a render crash to this card and recovers on Try again", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    shouldThrow = true;
    render(<><Widget title="Broken"><Bomb /></Widget><Widget title="Fine"><p>sibling ok</p></Widget></>);
    expect(screen.getByRole("alert")).toHaveTextContent("“Broken” couldn’t be shown.");
    expect(screen.getByText("sibling ok")).toBeInTheDocument();
    shouldThrow = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("recovered")).toBeInTheDocument();
    spy.mockRestore();
  });
});
