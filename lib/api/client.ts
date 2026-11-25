import createClient from "openapi-fetch";
import type { paths } from "./schema";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}

/** Same-origin fetch: unauthorised responses send the user to /login, everything is uncached. */
async function gatewayFetch(input: Request): Promise<Response> {
  const res = await fetch(input, { cache: "no-store" });
  if (res.status === 401 && typeof window !== "undefined") window.location.replace("/login"); // full reload drops every cached query of the expired session
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
  let r: Result<T>;
  try {
    r = await result;
  } catch {
    // fetch() itself rejected: no connection, DNS failure, aborted… There is no HTTP response to read.
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    throw new ApiError(0, "network_error", offline ? "You're offline. Check your connection and try again." : "Can't reach the server. Please try again in a moment.");
  }
  const { data, error, response } = r;
  if (error !== undefined || !response.ok) {
    const e = (error as { error?: { code?: string; message?: string; details?: unknown } } | undefined)?.error;
    throw new ApiError(response.status, e?.code ?? "error", e?.message ?? `Request failed (${response.status})`, e?.details);
  }
  return data as T;
}

export async function authCall(kind: "login" | "register", body: unknown) {
  let res: Response;
  try {
    res = await fetch(`/api/auth/${kind}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "network_error", "Can't reach the server. Please try again in a moment.");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? "error", json?.error?.message ?? "Request failed", json?.error?.details);
  return json.data.user;
}

/** Token-based auth actions that need no session (password reset, email verification). */
export async function publicAuth<T = unknown>(action: "forgot-password" | "reset-password" | "verify-email", body: unknown): Promise<T | undefined> {
  let res: Response;
  try {
    res = await fetch(`/api/auth/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "network_error", "Can't reach the server. Please try again in a moment.");
  }
  if (res.status === 204) return undefined;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? "error", json?.error?.message ?? "Request failed", json?.error?.details);
  return json?.data as T;
}

/** multipart upload through the gateway (openapi-fetch only speaks JSON). */
export async function uploadAttachment(transactionId: string, file: File) {
  const form = new FormData();
  form.append("file", file, file.name);
  let res: Response;
  try {
    res = await fetch(`/api/v1/transactions/${encodeURIComponent(transactionId)}/attachments`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, "network_error", "Can't reach the server. Please try again in a moment.");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? "error", json?.error?.message ?? `Upload failed (${res.status})`);
  return json.data as { id: string; fileName: string; contentType: string; sizeBytes: number; transactionId: string; createdAt: string };
}
export const attachmentUrl = (id: string) => `/api/v1/attachments/${encodeURIComponent(id)}/file`;
