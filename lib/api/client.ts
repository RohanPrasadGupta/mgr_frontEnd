import createClient from "openapi-fetch";
import type { paths } from "./schema";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}

/** Same-origin fetch: unauthorised responses send the user to /login, everything is uncached. */
async function gatewayFetch(input: Request): Promise<Response> {
  const res = await fetch(input, { cache: "no-store" });
  if (res.status === 401 && typeof window !== "undefined") window.location.assign("/login");
  return res;
}

/**
 * Typed client generated from the API's OpenAPI document (lib/api/schema.d.ts — regenerate with `npm run api:sync`).
 * Paths, params, request bodies and responses are all checked by the compiler. It talks to the Next.js gateway,
 * which attaches the access token from httpOnly cookies.
 */
export const client = createClient<paths>({
  baseUrl: `${typeof window !== "undefined" ? window.location.origin : "http://localhost"}/api/v1`,
  fetch: gatewayFetch as unknown as typeof fetch,
});

type Result<T> = { data?: T; error?: unknown; response: Response };

/** Unwraps a client result: returns the body, or throws an ApiError carrying the API's code/message/details. */
export async function call<T>(result: Promise<Result<T>>): Promise<T> {
  const { data, error, response } = await result;
  if (error !== undefined || !response.ok) {
    const e = (error as { error?: { code?: string; message?: string; details?: unknown } } | undefined)?.error;
    throw new ApiError(response.status, e?.code ?? "error", e?.message ?? `Request failed (${response.status})`, e?.details);
  }
  return data as T;
}

export async function authCall(kind: "login" | "register", body: unknown) {
  const res = await fetch(`/api/auth/${kind}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? "error", json?.error?.message ?? "Request failed", json?.error?.details);
  return json.data.user;
}
