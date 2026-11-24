// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ readSession: vi.fn(), setSession: vi.fn(), clearSession: vi.fn() }));
vi.mock("./session", () => ({ API_URL: "http://api.test", ...session }));

import { callApi } from "./upstream";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const tokens = (n: string) => ({ accessToken: `at-${n}`, refreshToken: `rt-${n}`, expiresIn: 900 });
let n = 0;
const uid = () => String(++n); // refresh tokens are cached per value, so every test uses its own

beforeEach(() => { session.readSession.mockReset(); session.setSession.mockReset(); session.clearSession.mockReset(); });

describe("callApi", () => {
  it("sends the access token and does not refresh when it is accepted", async () => {
    session.readSession.mockResolvedValue({ accessToken: "good", refreshToken: `rt-${uid()}` });
    const f = vi.fn(async () => json(200, { ok: true }));
    vi.stubGlobal("fetch", f);
    const res = await callApi("/v1/accounts", { method: "GET" });
    expect(res.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith("http://api.test/v1/accounts", expect.objectContaining({ headers: { authorization: "Bearer good" }, cache: "no-store" }));
    expect(session.setSession).not.toHaveBeenCalled();
  });

  it("refreshes when the access cookie has expired (missing) and stores the new tokens", async () => {
    const id = uid();
    session.readSession.mockResolvedValue({ accessToken: undefined, refreshToken: `rt-${id}` });
    const f = vi.fn(async (url: string, init?: RequestInit) => (url.endsWith("/v1/auth/refresh") ? json(200, { data: tokens("new" + id) }) : json(200, { auth: (init?.headers as Record<string, string>).authorization })));
    vi.stubGlobal("fetch", f);
    const res = await callApi("/v1/me", { method: "GET" });
    expect(await res.json()).toEqual({ auth: `Bearer at-new${id}` });
    expect(session.setSession).toHaveBeenCalledWith(tokens("new" + id));
  });

  it("retries once with fresh tokens when the API answers 401", async () => {
    const id = uid();
    session.readSession.mockResolvedValue({ accessToken: "stale", refreshToken: `rt-${id}` });
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/v1/auth/refresh")) return json(200, { data: tokens("n" + id) });
      return (init?.headers as Record<string, string>).authorization === "Bearer stale" ? json(401, {}) : json(200, { ok: 1 });
    });
    vi.stubGlobal("fetch", f);
    const res = await callApi("/v1/me", { method: "GET" });
    expect(res.status).toBe(200);
    expect(f.mock.calls.map((c) => String(c[0]).replace("http://api.test", ""))).toEqual(["/v1/me", "/v1/auth/refresh", "/v1/me"]);
  });

  it("clears the session and answers 401 when the refresh token is rejected", async () => {
    session.readSession.mockResolvedValue({ accessToken: "stale", refreshToken: `rt-${uid()}` });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.endsWith("/v1/auth/refresh") ? json(401, {}) : json(401, {}))));
    const res = await callApi("/v1/me", { method: "GET" });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
    expect(session.clearSession).toHaveBeenCalled();
  });

  it("answers 401 immediately when there are no cookies at all", async () => {
    session.readSession.mockResolvedValue({});
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const res = await callApi("/v1/me", { method: "GET" });
    expect(res.status).toBe(401);
    expect(f).not.toHaveBeenCalled();
    expect(session.clearSession).toHaveBeenCalled();
  });

  it("shares ONE refresh between parallel requests (rotating tokens must not be reused)", async () => {
    const id = uid();
    session.readSession.mockResolvedValue({ accessToken: "stale", refreshToken: `rt-${id}` });
    let refreshes = 0;
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/v1/auth/refresh")) { refreshes++; await new Promise((r) => setTimeout(r, 20)); return json(200, { data: tokens("p" + id) }); }
      return (init?.headers as Record<string, string>).authorization === "Bearer stale" ? json(401, {}) : json(200, { ok: 1 });
    });
    vi.stubGlobal("fetch", f);
    const results = await Promise.all([callApi("/v1/a", { method: "GET" }), callApi("/v1/b", { method: "GET" }), callApi("/v1/c", { method: "GET" })]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(refreshes).toBe(1);
  });

  it("late arrivals holding the old cookie reuse the cached refresh result", async () => {
    const id = uid();
    session.readSession.mockResolvedValue({ accessToken: undefined, refreshToken: `rt-${id}` });
    let refreshes = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.endsWith("/v1/auth/refresh") ? (refreshes++, json(200, { data: tokens("l" + id) })) : json(200, {}))));
    await callApi("/v1/a", { method: "GET" });
    await callApi("/v1/b", { method: "GET" });
    expect(refreshes).toBe(1);
  });
});
