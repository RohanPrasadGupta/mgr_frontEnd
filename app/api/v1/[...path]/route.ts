import type { NextRequest } from "next/server";
import { badGateway } from "@/lib/server/http";
import { callApi } from "@/lib/server/upstream";

// Same-origin gateway to the MoneyMgr API: attaches the bearer token from httpOnly cookies,
// refreshes it when needed, and never exposes tokens to browser JS.
async function handle(req: NextRequest, ctx: RouteContext<"/api/v1/[...path]">) {
  const { path } = await ctx.params;
  if (path[0] === "auth") return Response.json({ error: { code: "not_found", message: "Use /api/auth/*" } }, { status: 404 });
  const text = ["GET", "HEAD"].includes(req.method) ? "" : await req.text();
  const hasBody = text.length > 0; // DELETE etc. carry no body; Fastify rejects an empty JSON body
  let upstream: Response;
  try {
    upstream = await callApi(`/v1/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`, {
    method: req.method,
    body: hasBody ? text : undefined,
    headers: hasBody ? { "content-type": req.headers.get("content-type") ?? "application/json" } : undefined,
    });
  } catch {
    return badGateway(); // API unreachable: a clean 502 instead of an unhandled 500
  }
  const body = upstream.status === 204 ? null : await upstream.text();
  return new Response(body, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "private, no-store" } });
}
export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
