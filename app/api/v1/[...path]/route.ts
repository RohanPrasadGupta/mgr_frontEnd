import type { NextRequest } from "next/server";
import { badGateway, forwardedFor } from "@/lib/server/http";
import { callApi } from "@/lib/server/upstream";

// Same-origin gateway to the MoneyMgr API: attaches the bearer token from httpOnly cookies,
// refreshes it when needed, and never exposes tokens to browser JS.
async function handle(req: NextRequest, ctx: RouteContext<"/api/v1/[...path]">) {
  const { path } = await ctx.params;
  if (path[0] === "auth") return Response.json({ error: { code: "not_found", message: "Use /api/auth/*" } }, { status: 404 });
  const type = req.headers.get("content-type") ?? "";
  // JSON goes through as text; anything else (multipart uploads) as raw bytes so binary data isn't mangled.
  const body: string | ArrayBuffer = ["GET", "HEAD"].includes(req.method) ? "" : type.startsWith("multipart/") ? await req.arrayBuffer() : await req.text();
  const hasBody = (typeof body === "string" ? body.length : body.byteLength) > 0; // DELETE etc. carry no body; Fastify rejects an empty JSON body
  let upstream: Response;
  try {
    upstream = await callApi(`/v1/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`, {
      method: req.method,
      body: hasBody ? body : undefined,
      headers: { ...forwardedFor(req), ...(hasBody ? { "content-type": type || "application/json" } : {}) },
    });
  } catch {
    return badGateway(); // API unreachable: a clean 502 instead of an unhandled 500
  }
  const upType = upstream.headers.get("content-type") ?? "application/json";
  const headers: Record<string, string> = { "content-type": upType, "cache-control": "private, no-store" };
  if (upstream.status === 204) return new Response(null, { status: 204, headers });
  if (upType.includes("json")) return new Response(await upstream.text(), { status: upstream.status, headers });
  // Files (attachments): keep the API's download/safety headers.
  for (const h of ["content-disposition", "content-length", "x-content-type-options", "content-security-policy"]) {
    const v = upstream.headers.get(h);
    if (v) headers[h] = v;
  }
  return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers });
}
export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
