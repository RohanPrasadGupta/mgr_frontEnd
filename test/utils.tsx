import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { vi } from "vitest";
import { FeedbackProvider } from "@/components/feedback";

export function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}><FeedbackProvider>{ui}</FeedbackProvider></QueryClientProvider>) };
}

type Handler = (req: { url: URL; body: any; method: string }) => unknown;
export interface Call { method: string; path: string; body: any; url: string }

/** Stubs global fetch with "METHOD /path" → JSON handlers (path without query). Unhandled calls fail loudly. */
export function mockFetch(routes: Record<string, Handler | unknown>) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    // openapi-fetch hands over a Request object; hand-written callers pass (url, init)
    const isReq = typeof Request !== "undefined" && input instanceof Request;
    const url = new URL(isReq ? input.url : String(input), "http://localhost");
    const method = (isReq ? input.method : (init?.method ?? "GET")).toUpperCase();
    const isForm = !isReq && typeof FormData !== "undefined" && init?.body instanceof FormData;
    const text = isReq ? await input.clone().text() : init?.body && !isForm ? String(init.body) : "";
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const body = isForm ? init!.body : text ? JSON.parse(text) : undefined; // FormData (uploads) is handed over as-is
    calls.push({ method, path, body, url: url.pathname + url.search });
    const key = `${method} ${path}`;
    if (!(key in routes)) throw new Error(`Unhandled fetch: ${key}`);
    const h = routes[key];
    const out = await (typeof h === "function" ? (h as Handler)({ url, body, method }) : h); // handlers may be async (to hold a response back)
    if (out instanceof Response) return out;
    if (out === null) return new Response(null, { status: 204 });
    return new Response(JSON.stringify(out), { status: 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fn);
  return { calls, fn, urls: (prefix = "") => calls.filter((c) => c.path.startsWith(prefix)).map((c) => c.url), last: (method: string, path: string) => [...calls].reverse().find((c) => c.method === method && c.path === path) };
}

export const errorResponse = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ error: { code, message } }), { status, headers: { "content-type": "application/json" } });
