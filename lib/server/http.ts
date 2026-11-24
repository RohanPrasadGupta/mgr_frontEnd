import "server-only";

export const badGateway = () =>
  Response.json({ error: { code: "bad_gateway", message: "The server is unavailable. Please try again." } }, { status: 502, headers: { "cache-control": "private, no-store" } });
