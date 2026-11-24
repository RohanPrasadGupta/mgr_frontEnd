// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ setSession: vi.fn(), clearSession: vi.fn(), readSession: vi.fn() }));
vi.mock("@/lib/server/session", () => ({ API_URL: "http://api.test", ...session }));

import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";
import { POST as register } from "./register/route";

const post = (body: unknown) => new Request("http://localhost/api/auth/x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "user-agent": "jest" } });
const upstreamOk = { data: { user: { id: "u1", email: "a@b.c" }, accessToken: "AT", refreshToken: "RT", expiresIn: 900 } };
beforeEach(() => Object.values(session).forEach((m) => m.mockReset()));

describe.each([["login", login], ["register", register]] as const)("%s route", (name, handler) => {
  it("stores tokens in cookies and returns only the user to the browser", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(upstreamOk), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const res = await handler(post({ email: "a@b.c", password: "x" }));
    const body = await res.json();
    expect(f).toHaveBeenCalledWith(`http://api.test/v1/auth/${name}`, expect.objectContaining({ method: "POST" }));
    expect(session.setSession).toHaveBeenCalledWith({ accessToken: "AT", refreshToken: "RT", expiresIn: 900 });
    expect(body).toEqual({ data: { user: { id: "u1", email: "a@b.c" } } });
    expect(JSON.stringify(body)).not.toContain("AT");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("passes API errors through without setting a session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":{"code":"unauthorized","message":"Invalid email or password"}}', { status: 401 })));
    const res = await handler(post({}));
    expect(res.status).toBe(401);
    expect((await res.json()).error.message).toBe("Invalid email or password");
    expect(session.setSession).not.toHaveBeenCalled();
  });

  it("answers 502 when the API is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const res = await handler(post({}));
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("bad_gateway");
  });
});

describe("logout route", () => {
  it("revokes the refresh token upstream and clears cookies", async () => {
    session.readSession.mockResolvedValue({ refreshToken: "RT" });
    const f = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", f);
    const res = await logout();
    expect(res.status).toBe(204);
    expect(f).toHaveBeenCalledWith("http://api.test/v1/auth/logout", expect.objectContaining({ body: '{"refreshToken":"RT"}' }));
    expect(session.clearSession).toHaveBeenCalled();
  });
  it("still clears cookies when the API is unreachable", async () => {
    session.readSession.mockResolvedValue({ refreshToken: "RT" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect((await logout()).status).toBe(204);
    expect(session.clearSession).toHaveBeenCalled();
  });
});
