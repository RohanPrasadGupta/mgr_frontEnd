import "server-only";
import { API_URL, clearSession, readSession, setSession, type Tokens } from "./session";

/**
 * Refresh tokens rotate and the API revokes the whole family on reuse, so parallel requests that all
 * notice an expired access token must share ONE refresh call. Results are kept briefly so late arrivals
 * (still holding the old cookie) get the new tokens instead of triggering a reuse alarm.
 */
const inflight = new Map<string, { p: Promise<Tokens | null>; at: number }>();
function refreshOnce(refreshToken: string): Promise<Tokens | null> {
  const now = Date.now();
  for (const [k, v] of inflight) if (now - v.at > 20_000) inflight.delete(k);
  const hit = inflight.get(refreshToken);
  if (hit) return hit.p;
  const p = fetch(`${API_URL}/v1/auth/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken }), cache: "no-store" })
    .then(async (r) => (r.ok ? ((await r.json()).data as Tokens) : null))
    .catch(() => null);
  inflight.set(refreshToken, { p, at: now });
  return p;
}

export async function callApi(path: string, init: { method: string; body?: BodyInit | null; headers?: HeadersInit }): Promise<Response> {
  const send = (token?: string) =>
    fetch(`${API_URL}${path}`, { ...init, headers: { ...(init.headers as Record<string, string>), ...(token ? { authorization: `Bearer ${token}` } : {}) }, cache: "no-store" });

  const { accessToken, refreshToken } = await readSession();
  let res = accessToken ? await send(accessToken) : null;
  if (res && res.status !== 401) return res;
  if (!refreshToken) { await clearSession(); return res ?? new Response(JSON.stringify({ error: { code: "unauthorized", message: "Not signed in" } }), { status: 401, headers: { "content-type": "application/json" } }); }

  const fresh = await refreshOnce(refreshToken);
  if (!fresh) { await clearSession(); return new Response(JSON.stringify({ error: { code: "unauthorized", message: "Session expired" } }), { status: 401, headers: { "content-type": "application/json" } }); }
  await setSession(fresh);
  res = await send(fresh.accessToken);
  return res;
}
