import "server-only";

export const badGateway = () =>
  Response.json({ error: { code: "bad_gateway", message: "The server is unavailable. Please try again." } }, { status: 502, headers: { "cache-control": "private, no-store" } });

/**
 * The API rate-limits sign-in per client IP. Everything reaches it through this server, so pass the
 * browser's address along; without it every user would share one bucket.
 * Uses the RIGHTMOST X-Forwarded-For entry: that is the one our own load balancer appended. Entries to its left were
 * sent by the client and can be forged, so trusting the first one would let anyone dodge the limit.
 */
export function forwardedFor(req: Request): Record<string, string> {
  const ip = req.headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean).at(-1) || req.headers.get("x-real-ip")?.trim();
  return ip ? { "x-forwarded-for": ip } : {};
}
