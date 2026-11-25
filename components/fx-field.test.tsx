import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorResponse, mockFetch, renderWithClient } from "@/test/utils";
import { rememberFxRate } from "@/lib/fx-memory";
import { FxField } from "./fx-field";

beforeEach(() => localStorage.clear());

describe("FxField", () => {
  it("shows the stored rate it will use and previews the converted amount", async () => {
    const m = mockFetch({ "GET /fx": { data: { from: "NPR", to: "THB", rate: 0.2285, asOf: "2026-11-24", approximate: false } } });
    renderWithClient(<FxField from="NPR" to="THB" date="2026-11-25" value="" onChange={() => {}} amount={400} />);
    expect(await screen.findByText(/stored rate 1 NPR = 0\.2285 THB \(as of 2026-11-24\)/)).toBeInTheDocument();
    expect(screen.getByText("THB 91.40")).toBeInTheDocument();
    expect(m.urls("/fx")[0]).toBe("/api/v1/fx?from=NPR&to=THB&date=2026-11-25");
  });
  it("says when no rate is stored, and previews with the typed rate", async () => {
    mockFetch({ "GET /fx": () => errorResponse(404, "not_found", "FX rate not found") });
    renderWithClient(<FxField from="NPR" to="THB" date="2026-11-25" value="0.25" onChange={() => {}} amount={400} />);
    expect(await screen.findByText(/No stored NPR→THB rate/)).toBeInTheDocument();
    expect(screen.getByText("THB 100.00")).toBeInTheDocument();
    expect(screen.getByText(/at your rate/)).toBeInTheDocument();
  });
  it("offers the last rate typed for the pair", async () => {
    rememberFxRate("NPR", "THB", 0.24);
    mockFetch({ "GET /fx": () => errorResponse(404, "not_found", "none") });
    const onChange = vi.fn();
    renderWithClient(<FxField from="NPR" to="THB" date="2026-11-25" value="" onChange={onChange} />);
    await userEvent.click(await screen.findByRole("button", { name: "Use last: 0.2400" }));
    expect(onChange).toHaveBeenCalledWith("0.24");
  });
});
