// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const callApi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/upstream", () => ({ callApi }));

import { DELETE, GET, POST } from "./route";

const ctx = (...path: string[]) => ({ params: Promise.resolve({ path }) }) as never;
const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(`http://localhost${url}`, init);
beforeEach(() => { callApi.mockReset(); }); // braces: returning the mock would make vitest call it as a cleanup hook

describe("API gateway route", () => {
  it("forwards GET with its query string and never adds a body", async () => {
    callApi.mockResolvedValue(new Response('{"data":[]}', { status: 200, headers: { "content-type": "application/json" } }));
    const res = await GET(req("/api/v1/transactions?from=2025-01-01&kind=expense"), ctx("transactions"));
    expect(callApi).toHaveBeenCalledWith("/v1/transactions?from=2025-01-01&kind=expense", { method: "GET", body: undefined, headers: undefined });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"data":[]}');
  });

  it("forwards POST bodies with the content type", async () => {
    callApi.mockResolvedValue(new Response("{}", { status: 201 }));
    await POST(req("/api/v1/accounts", { method: "POST", body: '{"name":"x"}', headers: { "content-type": "application/json" } }), ctx("accounts"));
    expect(callApi).toHaveBeenCalledWith("/v1/accounts", { method: "POST", body: '{"name":"x"}', headers: { "content-type": "application/json" } });
  });

  it("sends DELETE with NO body and NO content-type (Fastify rejects an empty JSON body)", async () => {
    callApi.mockResolvedValue(new Response(null, { status: 204 }));
    const res = await DELETE(req("/api/v1/transactions/abc", { method: "DELETE" }), ctx("transactions", "abc"));
    expect(callApi).toHaveBeenCalledWith("/v1/transactions/abc", { method: "DELETE", body: undefined, headers: undefined });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("still forwards a JSON body on DELETE when there is one (account deletion sends the password)", async () => {
    callApi.mockResolvedValue(new Response(null, { status: 204 }));
    await DELETE(req("/api/v1/me", { method: "DELETE", body: '{"password":"pw"}', headers: { "content-type": "application/json" } }), ctx("me"));
    expect(callApi).toHaveBeenCalledWith("/v1/me", { method: "DELETE", body: '{"password":"pw"}', headers: { "content-type": "application/json" } });
  });

  it("encodes path segments", async () => {
    callApi.mockResolvedValue(new Response("{}"));
    await GET(req("/api/v1/x"), ctx("a b", "c/d"));
    expect(callApi.mock.calls[0]![0]).toBe("/v1/a%20b/c%2Fd");
  });

  it("never proxies the auth endpoints (tokens must stay server-side)", async () => {
    const res = await POST(req("/api/v1/auth/login", { method: "POST", body: "{}" }), ctx("auth", "login"));
    expect(res.status).toBe(404);
    expect(callApi).not.toHaveBeenCalled();
  });

  it("marks every response private and uncacheable and passes upstream status through", async () => {
    callApi.mockResolvedValue(new Response('{"error":{"code":"not_found"}}', { status: 404, headers: { "content-type": "application/json" } }));
    const res = await GET(req("/api/v1/accounts/x"), ctx("accounts", "x"));
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("answers 502 (not a crash) when the API is unreachable", async () => {
    callApi.mockRejectedValue(new TypeError("fetch failed"));
    const res = await GET(req("/api/v1/accounts"), ctx("accounts"));
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("bad_gateway");
  });
});
