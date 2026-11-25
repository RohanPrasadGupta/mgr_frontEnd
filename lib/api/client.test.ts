import { afterEach, describe, expect, it, vi } from "vitest";
import { errorResponse, mockFetch } from "@/test/utils";
import { ApiError, authCall, call, client } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("typed client + call()", () => {
  it("sends JSON bodies to the same-origin gateway with the right method and path params", async () => {
    const m = mockFetch({ "PATCH /accounts/a1": { data: { id: "a1" } } });
    const out = await call(client.PATCH("/accounts/{id}", { params: { path: { id: "a1" } }, body: { name: "New" } }));
    expect(out).toEqual({ data: { id: "a1" } });
    expect(m.calls[0]).toMatchObject({ method: "PATCH", path: "/accounts/a1", body: { name: "New" } });
    expect(m.calls[0]!.url).toBe("/api/v1/accounts/a1");
  });

  it("serialises typed query params and drops undefined ones", async () => {
    const m = mockFetch({ "GET /transactions": { data: [], meta: { nextCursor: null } } });
    await call(client.GET("/transactions", { params: { query: { from: "2025-01-01", kind: "expense", cursor: undefined, limit: 100 } } }));
    const u = new URL(m.calls[0]!.url, "http://x");
    expect(Object.fromEntries(u.searchParams)).toEqual({ from: "2025-01-01", kind: "expense", limit: "100" });
  });

  it("returns undefined for 204 No Content", async () => {
    mockFetch({ "DELETE /transactions/t1": null });
    await expect(call(client.DELETE("/transactions/{id}", { params: { path: { id: "t1" } } }))).resolves.toBeUndefined();
  });

  it("sends no body on bodiless POSTs", async () => {
    const m = mockFetch({ "POST /recurring/run-due": { data: { rules: 0, posted: 0, errors: [] } } });
    await call(client.POST("/recurring/run-due"));
    expect(m.calls[0]!.body).toBeUndefined();
  });

  it("turns API errors into ApiError with status, code, message and details", async () => {
    mockFetch({ "GET /me": () => errorResponse(422, "fx_rate_required", "No FX rate") });
    const e = await call(client.GET("/me")).catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 422, code: "fx_rate_required", message: "No FX rate" });
  });

  it("falls back to a generic message when the error body is not JSON", async () => {
    mockFetch({ "GET /me": () => new Response("<html>bad gateway</html>", { status: 502 }) });
    await expect(call(client.GET("/me"))).rejects.toMatchObject({ status: 502, message: "Request failed (502)" });
  });

  it("sends the user to /login on 401", async () => {
    const replace = vi.fn();
    vi.stubGlobal("location", { replace, origin: "http://localhost:3000" });
    mockFetch({ "GET /me": () => errorResponse(401, "unauthorized", "Session expired") });
    await expect(call(client.GET("/me"))).rejects.toMatchObject({ status: 401 });
    expect(replace).toHaveBeenCalledWith("/login");
  });
});

describe("authCall()", () => {
  it("returns the user on success and surfaces the API message on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { user: { id: "u1" } } }), { status: 200 })));
    await expect(authCall("login", { email: "a", password: "b" })).resolves.toEqual({ id: "u1" });
    vi.stubGlobal("fetch", vi.fn(async () => errorResponse(401, "unauthorized", "Invalid email or password")));
    await expect(authCall("login", {})).rejects.toThrow("Invalid email or password");
  });
});
