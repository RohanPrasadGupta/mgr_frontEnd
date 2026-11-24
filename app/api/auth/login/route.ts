import { badGateway } from "@/lib/server/http";
import { API_URL, setSession } from "@/lib/server/session";

export async function POST(req: Request) {
  const body = await req.text();
  let up: Response;
  try {
    up = await fetch(`${API_URL}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json", "user-agent": req.headers.get("user-agent") ?? "web" }, body, cache: "no-store" });
  } catch {
    return badGateway();
  }
  const json = await up.json().catch(() => ({ error: { code: "bad_gateway", message: "API unavailable" } }));
  if (!up.ok) return Response.json(json, { status: up.status });
  const { user, ...tokens } = json.data;
  await setSession(tokens);
  return Response.json({ data: { user } }, { headers: { "cache-control": "private, no-store" } });
}
