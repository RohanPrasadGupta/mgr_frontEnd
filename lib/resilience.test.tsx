import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { shouldRetry } from "@/app/providers";
import { ApiError, authCall, call, client } from "./api/client";
import { useOnline } from "./use-online";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("shouldRetry", () => {
  it("retries network failures and 5xx at most twice", () => {
    for (const s of [0, 500, 502, 503]) {
      const e = new ApiError(s, "x", "x");
      expect(shouldRetry(0, e)).toBe(true);
      expect(shouldRetry(1, e)).toBe(true);
      expect(shouldRetry(2, e)).toBe(false);
    }
  });
  it("never retries client errors", () => {
    for (const s of [400, 401, 403, 404, 409, 422, 429]) expect(shouldRetry(0, new ApiError(s, "x", "x"))).toBe(false);
  });
  it("retries unknown errors once", () => {
    expect(shouldRetry(0, new Error("?"))).toBe(true);
    expect(shouldRetry(1, new Error("?"))).toBe(false);
  });
});

describe("network failures", () => {
  it("call() maps a rejected fetch to a friendly ApiError(0, network_error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const e = await call(client.GET("/me")).catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 0, code: "network_error", message: "Can't reach the server. Please try again in a moment." });
  });
  it("says so when the browser is offline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const e = await call(client.GET("/me")).catch((x) => x);
    expect(e.message).toMatch(/offline/i);
  });
  it("authCall() maps a rejected fetch too", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(authCall("login", { email: "a@b.c", password: "x" })).rejects.toMatchObject({ status: 0, code: "network_error" });
  });
});

describe("useOnline", () => {
  it("follows the browser's online/offline events", () => {
    const get = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
    act(() => { get.mockReturnValue(false); window.dispatchEvent(new Event("offline")); });
    expect(result.current).toBe(false);
    act(() => { get.mockReturnValue(true); window.dispatchEvent(new Event("online")); });
    expect(result.current).toBe(true);
  });
});
