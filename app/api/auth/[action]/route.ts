import { badGateway, forwardedFor } from "@/lib/server/http";
import { API_URL } from "@/lib/server/session";

// Public, token-free auth endpoints (no session involved), proxied as-is. Anything else under /api/auth is 404.
const ALLOWED = new Set(["forgot-password", "reset-password", "verify-email"]);

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (!ALLOWED.has(action)) return Response.json({ error: { code: "not_found", message: "Not found" } }, { status: 404 });
  let up: Response;
  try {
    up = await fetch(`${API_URL}/v1/auth/${action}`, { method: "POST", headers: { "content-type": "application/json", ...forwardedFor(req) }, body: await req.text(), cache: "no-store" });
  } catch {
    return badGateway();
  }
  return new Response(up.status === 204 ? null : await up.text(), { status: up.status, headers: { "content-type": "application/json", "cache-control": "private, no-store" } });
}
